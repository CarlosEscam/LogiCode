import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';

after(() => prisma.$disconnect());

// Recorre el flujo principal del modelo de datos: docente, curso, cédula habilitada,
// estudiante, actividad tipo quiz con una pregunta del banco, entrega y foro.
test('el esquema guarda el flujo docente -> curso -> quiz -> entrega', async () => {
  const sufijo = Date.now().toString().slice(-8);
  await prisma.$transaction(async (tx) => {
    const docente = await tx.user.create({
      data: { cedula: `D${sufijo}`, fullName: 'Docente de prueba', email: `d${sufijo}@test.co`, passwordHash: 'x', role: 'TEACHER', status: 'PENDING' },
    });
    const estudiante = await tx.user.create({
      data: { cedula: `E${sufijo}`, fullName: 'Estudiante de prueba', email: `e${sufijo}@test.co`, passwordHash: 'x' },
    });
    const curso = await tx.course.create({ data: { name: 'Pensamiento Computacional', period: '2026-2', teacherId: docente.id } });
    await tx.rosterEntry.create({ data: { courseId: curso.id, cedula: estudiante.cedula, userId: estudiante.id } });
    const tema = await tx.topic.create({ data: { courseId: curso.id, title: 'Estructura condicional', tool: 'PSEINT' } });
    const pregunta = await tx.question.create({
      data: {
        courseId: curso.id, topicId: tema.id, type: 'MULTIPLE_CHOICE', createdById: docente.id,
        statement: '¿Qué palabra abre una condición en PSeInt?', options: ['Si', 'Mientras', 'Para'], correctAnswer: 0,
      },
    });
    const quiz = await tx.activity.create({
      data: {
        courseId: curso.id, topicId: tema.id, type: 'KAHOOT_QUIZ', title: 'Quiz condicionales', submissionType: 'QUESTIONS',
        opensAt: new Date(), closesAt: new Date(Date.now() + 86_400_000), timeLimitMinutes: 30,
        questions: { create: { questionId: pregunta.id, position: 1 } },
      },
    });
    const entrega = await tx.submission.create({
      data: {
        activityId: quiz.id, studentId: estudiante.id, status: 'GRADED', autoGrade: 5, finalGrade: 5,
        answers: { create: { questionId: pregunta.id, answer: 0, isCorrect: true, score: 1 } },
      },
      include: { answers: true },
    });
    assert.equal(entrega.answers.length, 1);
    assert.equal(entrega.finalGrade.toString(), '5');

    const hilo = await tx.forumThread.create({
      data: { category: 'PSEINT', title: 'Dudas de Si-Entonces', authorId: estudiante.id, posts: { create: { authorId: estudiante.id, body: '¿Cómo anido condiciones?' } } },
      include: { posts: true },
    });
    assert.equal(hilo.posts.length, 1);

    // Revierte todo para no dejar datos de prueba.
    throw new RollbackPrueba();
  }).catch((e) => {
    if (!(e instanceof RollbackPrueba)) throw e;
  });
});

class RollbackPrueba extends Error {}
