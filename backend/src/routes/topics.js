import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { requireCourse } from '../lib/access.js';
import { publicMaterial, TOOLS } from '../lib/material.js';
import * as v from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

// Temas del curso (RF-06, RF-07): los organiza el docente; los ven los estudiantes del curso.
export const topicsRouter = Router();

function datosTema(body, parcial = false) {
  const data = {};
  if (!parcial || body.title !== undefined) {
    const title = String(body.title ?? '').trim();
    if (title.length < 2 || title.length > 150) throw new HttpError(400, 'Escriba el título del tema.');
    data.title = title;
  }
  if (body.description !== undefined) data.description = String(body.description).trim() || null;
  if (!parcial || body.tool !== undefined) {
    const tool = body.tool ?? 'GENERAL';
    if (!TOOLS.includes(tool)) throw new HttpError(400, 'Herramienta no válida.');
    data.tool = tool;
  }
  return data;
}

async function temaPropio(req) {
  const topic = await prisma.topic.findUnique({ where: { id: v.id(req.params.topicId) } });
  if (!topic) throw new HttpError(404, 'Tema no encontrado.');
  await requireCourse(req.user, topic.courseId, 'owner');
  return topic;
}

// GET /api/courses/:id/topics: temas en orden con su material.
topicsRouter.get('/courses/:id/topics', requireAuth, async (req, res) => {
  const { course, acceso } = await requireCourse(req.user, v.id(req.params.id));
  const [topics, materiales] = await Promise.all([
    prisma.topic.findMany({ where: { courseId: course.id }, orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
    prisma.material.findMany({
      where: { courseId: course.id },
      orderBy: { createdAt: 'asc' },
      include: { uploadedBy: { select: { fullName: true } } },
    }),
  ]);
  res.json({
    course: { id: course.id, name: course.name, period: course.period },
    canEdit: acceso === 'owner',
    topics: topics.map((t) => ({
      ...t,
      materials: materiales.filter((m) => m.topicId === t.id).map(publicMaterial),
    })),
    otherMaterials: materiales.filter((m) => m.topicId === null).map(publicMaterial),
  });
});

// POST /api/courses/:id/topics { title, description, tool }
topicsRouter.post('/courses/:id/topics', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  const data = datosTema(req.body);
  const ultimo = await prisma.topic.aggregate({ where: { courseId: course.id }, _max: { position: true } });
  const topic = await prisma.topic.create({
    data: { ...data, courseId: course.id, position: (ultimo._max.position ?? -1) + 1 },
  });
  res.status(201).json({ topic });
});

// PATCH /api/topics/:topicId { title?, description?, tool?, isNextClass? }
// Solo un tema por curso puede ser "próxima clase" (RF-08).
topicsRouter.patch('/topics/:topicId', requireAuth, async (req, res) => {
  const topic = await temaPropio(req);
  const data = datosTema(req.body, true);
  const ops = [];
  if (req.body.isNextClass !== undefined) {
    data.isNextClass = Boolean(req.body.isNextClass);
    if (data.isNextClass) {
      ops.push(prisma.topic.updateMany({ where: { courseId: topic.courseId, isNextClass: true }, data: { isNextClass: false } }));
    }
  }
  ops.push(prisma.topic.update({ where: { id: topic.id }, data }));
  const resultado = await prisma.$transaction(ops);
  res.json({ topic: resultado.at(-1) });
});

// POST /api/topics/:topicId/move { direction: 'up' | 'down' }: intercambia con el vecino.
topicsRouter.post('/topics/:topicId/move', requireAuth, async (req, res) => {
  const topic = await temaPropio(req);
  const todos = await prisma.topic.findMany({
    where: { courseId: topic.courseId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  const i = todos.findIndex((t) => t.id === topic.id);
  const j = req.body.direction === 'up' ? i - 1 : i + 1;
  if (j >= 0 && j < todos.length) {
    [todos[i], todos[j]] = [todos[j], todos[i]];
    // Se renumera todo para corregir posiciones repetidas.
    await prisma.$transaction(todos.map((t, pos) => prisma.topic.update({ where: { id: t.id }, data: { position: pos } })));
  }
  res.json({ order: todos.map((t) => t.id) });
});

// DELETE /api/topics/:topicId: el material del tema queda en el curso, sin tema.
topicsRouter.delete('/topics/:topicId', requireAuth, async (req, res) => {
  const topic = await temaPropio(req);
  await prisma.topic.delete({ where: { id: topic.id } });
  res.status(204).end();
});
