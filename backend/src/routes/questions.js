import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { requireCourse } from '../lib/access.js';
import { TOOLS } from '../lib/material.js';
import { datosPregunta, TIPOS_PREGUNTA } from '../lib/preguntas.js';
import { recalificar } from '../lib/quizzes.js';
import * as v from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

// Banco de preguntas (RF-25). Es del docente: las preguntas que crea en un curso
// le sirven para los quizzes de todos sus cursos y semestres.
export const questionsRouter = Router();

export function publicQuestion(q) {
  return {
    id: q.id,
    courseId: q.courseId,
    topicId: q.topicId,
    topic: q.topic?.title ?? null,
    type: q.type,
    tool: q.tool,
    statement: q.statement,
    code: q.code,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    archived: q.archived,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    usedInQuizzes: q._count?.quizzes,
    answered: q._count?.quizAnswers,
  };
}

// Prisma pide DbNull para dejar vacía una columna JSON.
function paraGuardar(data) {
  const copia = { ...data };
  for (const campo of ['options', 'correctAnswer']) if (copia[campo] === null) copia[campo] = Prisma.DbNull;
  return copia;
}

async function temaDelCurso(topicId, courseId) {
  if (topicId === undefined || topicId === null || topicId === '') return null;
  const topic = await prisma.topic.findUnique({ where: { id: v.id(topicId) } });
  if (!topic || topic.courseId !== courseId) throw new HttpError(400, 'El tema no es de este curso.');
  return topic.id;
}

async function preguntaPropia(req) {
  const question = await prisma.question.findUnique({ where: { id: v.id(req.params.questionId) } });
  if (!question) throw new HttpError(404, 'Pregunta no encontrada.');
  if (req.user.role !== 'ADMIN' && question.createdById !== req.user.id) {
    throw new HttpError(403, 'Esta pregunta no es suya.');
  }
  return question;
}

const incluir = { topic: { select: { title: true } }, _count: { select: { quizzes: true, quizAnswers: true } } };

// GET /api/courses/:id/questions?tool=&type=&topicId=&q=&archived=1
questionsRouter.get('/courses/:id/questions', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  const where = { createdById: course.teacherId, archived: req.query.archived === '1' };
  if (TOOLS.includes(req.query.tool)) where.tool = req.query.tool;
  if (TIPOS_PREGUNTA.includes(req.query.type)) where.type = req.query.type;
  if (req.query.topicId) where.topicId = v.id(req.query.topicId);
  const q = String(req.query.q ?? '').trim();
  if (q) where.statement = { contains: q, mode: 'insensitive' };
  const questions = await prisma.question.findMany({ where, include: incluir, orderBy: { updatedAt: 'desc' }, take: 500 });
  res.json({ questions: questions.map(publicQuestion) });
});

// POST /api/courses/:id/questions { type, tool, topicId?, statement, code?, options?, correctAnswer, explanation? }
questionsRouter.post('/courses/:id/questions', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  const data = datosPregunta(req.body);
  const topicId = await temaDelCurso(req.body.topicId, course.id);
  const question = await prisma.question.create({
    data: { ...paraGuardar(data), topicId, courseId: course.id, createdById: course.teacherId },
    include: incluir,
  });
  res.status(201).json({ question: publicQuestion(question) });
});

// PATCH /api/questions/:questionId (mismos campos; también { archived })
// Si la pregunta ya se respondió, se recalculan las notas: así el docente corrige una clave mal puesta.
questionsRouter.patch('/questions/:questionId', requireAuth, async (req, res) => {
  const actual = await preguntaPropia(req);
  let data = {};
  if (req.body.archived !== undefined && Object.keys(req.body).length === 1) {
    data = { archived: Boolean(req.body.archived) };
  } else {
    data = datosPregunta({ ...actual, ...req.body });
    if (data.type !== actual.type) {
      const respondida = await prisma.quizAnswer.count({ where: { questionId: actual.id } });
      if (respondida) throw new HttpError(400, 'Esta pregunta ya se respondió en un quiz: no se puede cambiar su tipo.');
    }
    if (req.body.topicId !== undefined) data.topicId = await temaDelCurso(req.body.topicId, actual.courseId);
  }
  const question = await prisma.question.update({ where: { id: actual.id }, data: paraGuardar(data), include: incluir });

  const intentos = await prisma.quizAttempt.findMany({
    where: { submittedAt: { not: null }, answers: { some: { questionId: actual.id } } },
    select: { id: true },
  });
  if (data.correctAnswer !== undefined || data.options !== undefined) await recalificar(intentos.map((a) => a.id));
  res.json({ question: publicQuestion(question), regraded: intentos.length });
});

// DELETE /api/questions/:questionId: si ya está en un quiz, se archiva en vez de borrarse.
questionsRouter.delete('/questions/:questionId', requireAuth, async (req, res) => {
  const question = await preguntaPropia(req);
  const usos = await prisma.quizQuestion.count({ where: { questionId: question.id } });
  if (usos) {
    await prisma.question.update({ where: { id: question.id }, data: { archived: true } });
    return res.json({ archived: true });
  }
  await prisma.question.delete({ where: { id: question.id } });
  res.status(204).end();
});
