import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { calificar } from './preguntas.js';

// Lógica de los intentos de quiz: cierre, calificación y ranking.

// Margen para respuestas que llegan justo cuando se acaba el tiempo (latencia de la red).
export const GRACIA_MS = 15_000;

export const num = (d) => (d === null || d === undefined ? null : Number(d));

// Nota de 0,0 a 5,0 a partir de los puntajes (0 a 1) y el valor de cada pregunta.
export function notaDe(preguntas, puntajes) {
  const total = preguntas.reduce((s, q) => s + num(q.points), 0);
  if (total === 0) return 0;
  const obtenido = preguntas.reduce((s, q) => s + num(q.points) * (puntajes.get(q.questionId) ?? 0), 0);
  return Math.round((obtenido / total) * 50) / 10;
}

// Califica todas las respuestas del intento y guarda la nota.
// Las preguntas sin responder quedan como incorrectas, para el panel de más falladas.
async function calificarIntento(tx, attemptId) {
  const intento = await tx.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true, quiz: { include: { questions: { include: { question: true } } } } },
  });
  const porPregunta = new Map(intento.answers.map((a) => [a.questionId, a]));
  const puntajes = new Map();
  for (const qq of intento.quiz.questions) {
    const guardada = porPregunta.get(qq.questionId);
    const score = calificar(qq.question, guardada?.answer ?? null);
    puntajes.set(qq.questionId, score);
    await tx.quizAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: qq.questionId } },
      create: { attemptId, questionId: qq.questionId, answer: Prisma.DbNull, score, isCorrect: score === 1 },
      update: { score, isCorrect: score === 1 },
    });
  }
  const grade = notaDe(intento.quiz.questions, puntajes);
  const correctCount = [...puntajes.values()].filter((s) => s === 1).length;
  return tx.quizAttempt.update({ where: { id: attemptId }, data: { grade, correctCount } });
}

// Envía el intento una sola vez (si llegan dos envíos, el segundo no hace nada).
export async function finalizarIntento(attemptId, { automatico = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const intento = await tx.quizAttempt.findUnique({ where: { id: attemptId } });
    const ahora = new Date();
    const vencido = ahora.getTime() > intento.deadline.getTime();
    const marcado = await tx.quizAttempt.updateMany({
      where: { id: attemptId, submittedAt: null },
      data: { submittedAt: vencido ? intento.deadline : ahora, autoSubmitted: automatico || vencido },
    });
    if (marcado.count === 0) return tx.quizAttempt.findUnique({ where: { id: attemptId } });
    return calificarIntento(tx, attemptId);
  });
}

// Recalcula la nota de intentos ya enviados, por ejemplo cuando el docente corrige una pregunta.
export async function recalificar(attemptIds) {
  for (const id of attemptIds) {
    await prisma.$transaction((tx) => calificarIntento(tx, id));
  }
}

// Cierra los intentos cuyo tiempo se acabó sin que el estudiante los enviara
// (cerró la página, se quedó sin conexión...). Se llama antes de mostrar resultados.
export async function cerrarVencidos(where = {}) {
  const vencidos = await prisma.quizAttempt.findMany({
    where: { ...where, submittedAt: null, deadline: { lt: new Date(Date.now() - GRACIA_MS) } },
    select: { id: true },
  });
  for (const { id } of vencidos) await finalizarIntento(id, { automatico: true });
}

// Intentos que tiene un estudiante: los del quiz más los que le habilitó el docente.
// Los quizzes de repaso no tienen límite.
export async function intentosPermitidos(quiz, studentId) {
  if (quiz.isPractice) return Infinity;
  const extra = await prisma.quizAllowance.findUnique({ where: { quizId_studentId: { quizId: quiz.id, studentId } } });
  return quiz.maxAttempts + (extra?.extraAttempts ?? 0);
}

export function estadoQuiz(quiz, ahora = new Date()) {
  if (!quiz.published) return 'DRAFT';
  if (ahora < quiz.opensAt) return 'UPCOMING';
  if (ahora >= quiz.closesAt) return 'CLOSED';
  return 'OPEN';
}

// Mejor intento enviado de cada estudiante: mayor nota y, si empatan, el que tardó menos.
export function mejoresIntentos(intentos) {
  const mejor = new Map();
  for (const a of intentos) {
    if (!a.submittedAt) continue;
    const actual = mejor.get(a.studentId);
    if (!actual || compararIntentos(a, actual) < 0) mejor.set(a.studentId, a);
  }
  return mejor;
}

const duracion = (a) => a.submittedAt.getTime() - a.startedAt.getTime();

function compararIntentos(a, b) {
  return num(b.grade) - num(a.grade) || duracion(a) - duracion(b);
}

// Ranking por nota; a igual nota, primero quien terminó en menos tiempo.
export function ranking(intentos) {
  return [...mejoresIntentos(intentos).values()]
    .sort(compararIntentos)
    .map((a, i) => ({
      position: i + 1,
      studentId: a.studentId,
      fullName: a.student?.fullName,
      grade: num(a.grade),
      correctCount: a.correctCount,
      seconds: Math.round(duracion(a) / 1000),
    }));
}

// Preguntas que más se fallan. quizWhere filtra los quizzes (uno solo o todos los del curso).
export async function masFalladas(quizWhere, { limite = 10, soloFalladas = true } = {}) {
  const respuestas = await prisma.quizAnswer.findMany({
    where: { attempt: { submittedAt: { not: null }, quiz: quizWhere } },
    select: { questionId: true, score: true },
  });
  const stats = new Map();
  for (const r of respuestas) {
    const s = stats.get(r.questionId) ?? { answered: 0, failed: 0, scoreSum: 0 };
    s.answered += 1;
    s.scoreSum += r.score ?? 0;
    if ((r.score ?? 0) < 1) s.failed += 1;
    stats.set(r.questionId, s);
  }
  const preguntas = await prisma.question.findMany({
    where: { id: { in: [...stats.keys()] } },
    select: { id: true, statement: true, type: true, tool: true, topic: { select: { title: true } } },
  });
  return preguntas
    .map((q) => {
      const s = stats.get(q.id);
      return {
        questionId: q.id,
        statement: q.statement,
        type: q.type,
        tool: q.tool,
        topic: q.topic?.title ?? null,
        answered: s.answered,
        failed: s.failed,
        failRate: Math.round((s.failed / s.answered) * 100),
        averageScore: Math.round((s.scoreSum / s.answered) * 100),
      };
    })
    .filter((q) => !soloFalladas || q.failed > 0)
    .sort((a, b) => b.failRate - a.failRate || b.failed - a.failed)
    .slice(0, limite);
}
