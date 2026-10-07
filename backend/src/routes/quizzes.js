import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { courseAccess, requireCourse } from '../lib/access.js';
import { mezclar, preguntaParaResponder, respuestaValida } from '../lib/preguntas.js';
import {
  cerrarVencidos,
  estadoQuiz,
  finalizarIntento,
  GRACIA_MS,
  intentosPermitidos,
  masFalladas,
  mejoresIntentos,
  num,
  ranking,
} from '../lib/quizzes.js';
import { publicQuestion } from './questions.js';
import * as v from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

// Quizzes (sección 6 del anteproyecto). Solo el docente los crea; los ven los estudiantes
// del curso cuando están publicados. Tiempo total fijado por el docente, envío automático
// al acabarse, un intento salvo que el docente habilite otro, nota de 0,0 a 5,0 por aciertos
// y ranking por nota.
export const quizzesRouter = Router();

function fecha(valor, campo) {
  const d = new Date(valor);
  if (!valor || Number.isNaN(d.getTime())) throw new HttpError(400, `Indique ${campo}.`);
  return d;
}

function entero(valor, min, max, mensaje) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, mensaje);
  return n;
}

// Valida los datos del quiz. Con parcial, solo los campos que llegan.
async function datosQuiz(body, course, parcial = false) {
  const data = {};
  const llega = (campo) => !parcial || body[campo] !== undefined;
  if (llega('title')) {
    const title = String(body.title ?? '').trim();
    if (title.length < 3 || title.length > 200) throw new HttpError(400, 'Escriba el título del quiz.');
    data.title = title;
  }
  if (body.description !== undefined) data.description = String(body.description ?? '').trim().slice(0, 2000) || null;
  if (llega('timeLimitMinutes')) data.timeLimitMinutes = entero(body.timeLimitMinutes, 1, 300, 'El tiempo debe estar entre 1 y 300 minutos.');
  if (llega('opensAt')) data.opensAt = fecha(body.opensAt, 'cuándo abre el quiz');
  if (llega('closesAt')) data.closesAt = fecha(body.closesAt, 'cuándo cierra el quiz');
  if (body.maxAttempts !== undefined) data.maxAttempts = entero(body.maxAttempts, 1, 10, 'Los intentos deben estar entre 1 y 10.');
  if (body.isPractice !== undefined) data.isPractice = Boolean(body.isPractice);
  if (body.shuffleQuestions !== undefined) data.shuffleQuestions = Boolean(body.shuffleQuestions);
  if (body.published !== undefined) data.published = Boolean(body.published);
  if (body.topicId !== undefined) {
    if (body.topicId === null || body.topicId === '') data.topicId = null;
    else {
      const topic = await prisma.topic.findUnique({ where: { id: v.id(body.topicId) } });
      if (!topic || topic.courseId !== course.id) throw new HttpError(400, 'El tema no es de este curso.');
      data.topicId = topic.id;
    }
  }
  return data;
}

// Lista [{ questionId, points }] con preguntas del banco del docente del curso.
async function preguntasQuiz(lista, course) {
  if (!Array.isArray(lista) || lista.length === 0) throw new HttpError(400, 'Agregue al menos una pregunta del banco.');
  if (lista.length > 100) throw new HttpError(400, 'Un quiz puede tener como máximo 100 preguntas.');
  const ids = lista.map((x) => v.id(x.questionId));
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Hay preguntas repetidas.');
  const validas = await prisma.question.count({ where: { id: { in: ids }, createdById: course.teacherId, archived: false } });
  if (validas !== ids.length) throw new HttpError(400, 'Alguna pregunta no está en su banco.');
  return lista.map((x, position) => {
    const points = x.points === undefined ? 1 : Number(x.points);
    if (!(points >= 0.5 && points <= 100)) throw new HttpError(400, 'El valor de cada pregunta debe estar entre 0,5 y 100.');
    return { questionId: ids[position], position, points };
  });
}

function revisarFechas(quiz) {
  if (quiz.closesAt <= quiz.opensAt) throw new HttpError(400, 'El quiz debe cerrar después de abrir.');
}

async function quizConAcceso(req, nivel = 'member') {
  const quiz = await prisma.quiz.findUnique({ where: { id: v.id(req.params.quizId) } });
  if (!quiz) throw new HttpError(404, 'Quiz no encontrado.');
  const { course, acceso } = await requireCourse(req.user, quiz.courseId, nivel);
  // El estudiante no ve los borradores.
  if (acceso !== 'owner' && !quiz.published) throw new HttpError(404, 'Quiz no encontrado.');
  return { quiz, course, acceso };
}

function resumenQuiz(quiz) {
  return {
    id: quiz.id,
    courseId: quiz.courseId,
    topicId: quiz.topicId,
    topic: quiz.topic?.title ?? null,
    title: quiz.title,
    description: quiz.description,
    timeLimitMinutes: quiz.timeLimitMinutes,
    opensAt: quiz.opensAt,
    closesAt: quiz.closesAt,
    maxAttempts: quiz.maxAttempts,
    isPractice: quiz.isPractice,
    shuffleQuestions: quiz.shuffleQuestions,
    published: quiz.published,
    status: estadoQuiz(quiz),
    questionCount: quiz._count?.questions ?? quiz.questions?.length,
  };
}

function resumenIntento(a) {
  return {
    id: a.id,
    attemptNumber: a.attemptNumber,
    startedAt: a.startedAt,
    deadline: a.deadline,
    submittedAt: a.submittedAt,
    autoSubmitted: a.autoSubmitted,
    grade: num(a.grade),
    correctCount: a.correctCount,
  };
}

// GET /api/courses/:id/quizzes: el docente ve todos; el estudiante, los publicados con su avance.
quizzesRouter.get('/courses/:id/quizzes', requireAuth, async (req, res) => {
  const { course, acceso } = await requireCourse(req.user, v.id(req.params.id));
  const docente = acceso === 'owner';
  await cerrarVencidos({ quiz: { courseId: course.id } });
  const quizzes = await prisma.quiz.findMany({
    where: { courseId: course.id, ...(docente ? {} : { published: true }) },
    orderBy: [{ opensAt: 'desc' }, { id: 'desc' }],
    include: {
      topic: { select: { title: true } },
      _count: { select: { questions: true } },
      attempts: docente
        ? { where: { submittedAt: { not: null } }, select: { studentId: true, grade: true } }
        : { where: { studentId: req.user.id }, orderBy: { attemptNumber: 'asc' } },
    },
  });

  const lista = [];
  for (const quiz of quizzes) {
    const item = resumenQuiz(quiz);
    if (docente) {
      const mejores = new Map();
      for (const a of quiz.attempts) mejores.set(a.studentId, Math.max(mejores.get(a.studentId) ?? 0, num(a.grade)));
      const notas = [...mejores.values()];
      item.submittedCount = notas.length;
      item.averageGrade = notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null;
    } else {
      const enviados = quiz.attempts.filter((a) => a.submittedAt);
      item.attemptsUsed = quiz.attempts.length;
      item.attemptsAllowed = await intentosPermitidos(quiz, req.user.id);
      item.inProgressAttemptId = quiz.attempts.find((a) => !a.submittedAt)?.id ?? null;
      item.bestGrade = enviados.length ? Math.max(...enviados.map((a) => num(a.grade))) : null;
    }
    lista.push(item);
  }
  res.json({ course: { id: course.id, name: course.name, period: course.period }, canEdit: docente, quizzes: lista });
});

// POST /api/courses/:id/quizzes { title, description?, topicId?, timeLimitMinutes, opensAt, closesAt,
//   maxAttempts?, isPractice?, shuffleQuestions?, published?, questions: [{ questionId, points }] }
quizzesRouter.post('/courses/:id/quizzes', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  const data = await datosQuiz(req.body, course);
  revisarFechas(data);
  const preguntas = await preguntasQuiz(req.body.questions, course);
  const quiz = await prisma.quiz.create({
    data: { ...data, courseId: course.id, questions: { create: preguntas } },
    include: { _count: { select: { questions: true } } },
  });
  res.status(201).json({ quiz: resumenQuiz(quiz) });
});

// GET /api/quizzes/:quizId: el docente recibe las preguntas con sus respuestas;
// el estudiante, solo el resumen y sus intentos.
quizzesRouter.get('/quizzes/:quizId', requireAuth, async (req, res) => {
  const { quiz, course, acceso } = await quizConAcceso(req);
  await cerrarVencidos({ quizId: quiz.id });
  const completo = await prisma.quiz.findUnique({
    where: { id: quiz.id },
    include: {
      topic: { select: { title: true } },
      questions: { orderBy: { position: 'asc' }, include: { question: { include: { topic: { select: { title: true } } } } } },
    },
  });
  const datos = { course: { id: course.id, name: course.name }, quiz: resumenQuiz(completo), canEdit: acceso === 'owner' };
  if (acceso === 'owner') {
    datos.questions = completo.questions.map((qq) => ({ ...publicQuestion(qq.question), points: num(qq.points) }));
    datos.hasAttempts = (await prisma.quizAttempt.count({ where: { quizId: quiz.id } })) > 0;
  } else {
    const intentos = await prisma.quizAttempt.findMany({ where: { quizId: quiz.id, studentId: req.user.id }, orderBy: { attemptNumber: 'asc' } });
    datos.attempts = intentos.map(resumenIntento);
    datos.attemptsAllowed = await intentosPermitidos(quiz, req.user.id);
    if (datos.attemptsAllowed === Infinity) datos.attemptsAllowed = null;
    datos.totalPoints = completo.questions.reduce((s, q) => s + num(q.points), 0);
  }
  res.json(datos);
});

// PATCH /api/quizzes/:quizId (mismos campos que al crear). Las preguntas solo se cambian
// mientras nadie haya empezado el quiz, para no cambiar notas ya puestas.
quizzesRouter.patch('/quizzes/:quizId', requireAuth, async (req, res) => {
  const { quiz, course } = await quizConAcceso(req, 'owner');
  const data = await datosQuiz(req.body, course, true);
  revisarFechas({ ...quiz, ...data });
  const ops = [];
  if (req.body.questions !== undefined) {
    const intentos = await prisma.quizAttempt.count({ where: { quizId: quiz.id } });
    if (intentos) throw new HttpError(400, 'Ya hay estudiantes que presentaron este quiz: no se pueden cambiar sus preguntas.');
    const preguntas = await preguntasQuiz(req.body.questions, course);
    ops.push(prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } }));
    ops.push(prisma.quizQuestion.createMany({ data: preguntas.map((p) => ({ ...p, quizId: quiz.id })) }));
  }
  ops.push(prisma.quiz.update({ where: { id: quiz.id }, data, include: { _count: { select: { questions: true } } } }));
  const resultado = await prisma.$transaction(ops);
  res.json({ quiz: resumenQuiz(resultado.at(-1)) });
});

// DELETE /api/quizzes/:quizId: borra también los intentos y sus notas.
quizzesRouter.delete('/quizzes/:quizId', requireAuth, async (req, res) => {
  const { quiz } = await quizConAcceso(req, 'owner');
  await prisma.quiz.delete({ where: { id: quiz.id } });
  res.status(204).end();
});

// POST /api/quizzes/:quizId/start: empieza un intento, o devuelve el que está en curso.
quizzesRouter.post('/quizzes/:quizId/start', requireAuth, async (req, res) => {
  const { quiz, acceso } = await quizConAcceso(req);
  if (acceso === 'owner') throw new HttpError(403, 'El quiz lo presentan los estudiantes del curso.');
  await cerrarVencidos({ quizId: quiz.id, studentId: req.user.id });

  const enCurso = await prisma.quizAttempt.findFirst({ where: { quizId: quiz.id, studentId: req.user.id, submittedAt: null } });
  if (enCurso) return res.json({ attemptId: enCurso.id });

  const estado = estadoQuiz(quiz);
  if (estado === 'UPCOMING') throw new HttpError(400, 'El quiz todavía no ha abierto.');
  if (estado === 'CLOSED') throw new HttpError(400, 'El quiz ya cerró.');
  const usados = await prisma.quizAttempt.count({ where: { quizId: quiz.id, studentId: req.user.id } });
  if (usados >= (await intentosPermitidos(quiz, req.user.id))) {
    throw new HttpError(400, 'Ya usó sus intentos. Si necesita otro, pídaselo al docente.');
  }

  const ahora = new Date();
  const deadline = new Date(Math.min(ahora.getTime() + quiz.timeLimitMinutes * 60_000, quiz.closesAt.getTime()));
  try {
    const intento = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: req.user.id, attemptNumber: usados + 1, startedAt: ahora, deadline },
    });
    res.status(201).json({ attemptId: intento.id });
  } catch (e) {
    // Dos clics seguidos: el segundo choca con el número de intento y recibe el mismo intento.
    if (e.code !== 'P2002') throw e;
    const existente = await prisma.quizAttempt.findFirst({ where: { quizId: quiz.id, studentId: req.user.id, submittedAt: null } });
    if (!existente) throw e;
    res.json({ attemptId: existente.id });
  }
});

async function intentoConAcceso(req) {
  const intento = await prisma.quizAttempt.findUnique({
    where: { id: v.id(req.params.attemptId) },
    include: {
      student: { select: { id: true, fullName: true, cedula: true } },
      quiz: { include: { questions: { orderBy: { position: 'asc' }, include: { question: true } } } },
      answers: true,
    },
  });
  if (!intento) throw new HttpError(404, 'Intento no encontrado.');
  const acceso = await courseAccess(req.user, intento.quiz.courseId);
  const propio = intento.studentId === req.user.id;
  if (!propio && acceso !== 'owner') throw new HttpError(404, 'Intento no encontrado.');
  return { intento, docente: acceso === 'owner' && !propio };
}

function ordenPreguntas(intento) {
  const preguntas = intento.quiz.questions;
  return intento.quiz.shuffleQuestions ? mezclar(preguntas, intento.id) : preguntas;
}

// GET /api/quiz-attempts/:attemptId
// En curso: las preguntas sin respuestas correctas, lo guardado y la hora límite.
// Enviado: la nota; la revisión pregunta por pregunta se ve cuando cierra el quiz
// (en los de repaso, de inmediato). El docente la ve siempre.
quizzesRouter.get('/quiz-attempts/:attemptId', requireAuth, async (req, res) => {
  let { intento, docente } = await intentoConAcceso(req);
  if (!intento.submittedAt && Date.now() > intento.deadline.getTime() + GRACIA_MS) {
    await finalizarIntento(intento.id, { automatico: true });
    ({ intento, docente } = await intentoConAcceso(req));
  }
  const quiz = intento.quiz;
  const guardadas = new Map(intento.answers.map((a) => [a.questionId, a]));
  const base = {
    quiz: { id: quiz.id, courseId: quiz.courseId, title: quiz.title, isPractice: quiz.isPractice, closesAt: quiz.closesAt, timeLimitMinutes: quiz.timeLimitMinutes },
    attempt: resumenIntento(intento),
    student: docente ? intento.student : undefined,
    questionCount: quiz.questions.length,
    serverNow: new Date(),
  };

  if (!intento.submittedAt) {
    if (docente) return res.json({ ...base, inProgress: true });
    return res.json({
      ...base,
      inProgress: true,
      questions: ordenPreguntas(intento).map((qq) => ({ ...preguntaParaResponder(qq.question), points: num(qq.points) })),
      answers: Object.fromEntries(intento.answers.map((a) => [a.questionId, a.answer])),
    });
  }

  const revelar = docente || quiz.isPractice || new Date() >= quiz.closesAt;
  res.json({
    ...base,
    inProgress: false,
    revealed: revelar,
    review: revelar
      ? quiz.questions.map((qq) => {
          const r = guardadas.get(qq.questionId);
          return {
            ...preguntaParaResponder(qq.question),
            options: qq.question.options,
            correctAnswer: qq.question.correctAnswer,
            explanation: qq.question.explanation,
            points: num(qq.points),
            answer: r?.answer ?? null,
            score: r?.score ?? 0,
            isCorrect: r?.isCorrect ?? false,
          };
        })
      : null,
  });
});

async function intentoAbierto(req) {
  const { intento, docente } = await intentoConAcceso(req);
  if (docente || intento.studentId !== req.user.id) throw new HttpError(403, 'Solo el estudiante responde su intento.');
  if (intento.submittedAt) throw new HttpError(400, 'Este intento ya se envió.');
  return intento;
}

async function guardarRespuesta(intento, questionId, valor) {
  const qq = intento.quiz.questions.find((q) => q.questionId === questionId);
  if (!qq) throw new HttpError(400, 'La pregunta no es de este quiz.');
  const answer = respuestaValida(qq.question, valor ?? null);
  await prisma.quizAnswer.upsert({
    where: { attemptId_questionId: { attemptId: intento.id, questionId } },
    create: { attemptId: intento.id, questionId, answer },
    update: { answer },
  });
}

const aTiempo = (intento) => Date.now() <= intento.deadline.getTime() + GRACIA_MS;

// PUT /api/quiz-attempts/:attemptId/answers { questionId, answer }: se guarda a medida que responde.
quizzesRouter.put('/quiz-attempts/:attemptId/answers', requireAuth, async (req, res) => {
  const intento = await intentoAbierto(req);
  if (!aTiempo(intento)) {
    await finalizarIntento(intento.id, { automatico: true });
    throw new HttpError(400, 'Se acabó el tiempo. El quiz se envió con lo que alcanzó a responder.');
  }
  await guardarRespuesta(intento, v.id(req.body.questionId), req.body.answer);
  res.json({ saved: true });
});

// POST /api/quiz-attempts/:attemptId/submit { answers?: { [questionId]: respuesta }, auto? }
// Si se acabó el tiempo se califica solo lo que alcanzó a guardar.
quizzesRouter.post('/quiz-attempts/:attemptId/submit', requireAuth, async (req, res) => {
  const intento = await intentoAbierto(req);
  if (aTiempo(intento) && req.body.answers && typeof req.body.answers === 'object') {
    for (const [questionId, valor] of Object.entries(req.body.answers)) {
      await guardarRespuesta(intento, v.id(questionId), valor);
    }
  }
  const final = await finalizarIntento(intento.id, { automatico: Boolean(req.body.auto) });
  res.json({ attempt: resumenIntento(final) });
});

// GET /api/quizzes/:quizId/results: resultados para el docente. Una fila por estudiante
// del curso, con sus intentos, y las preguntas ordenadas de la más fallada a la menos.
quizzesRouter.get('/quizzes/:quizId/results', requireAuth, async (req, res) => {
  const { quiz } = await quizConAcceso(req, 'owner');
  await cerrarVencidos({ quizId: quiz.id });
  const [lista, intentos, permisos] = await Promise.all([
    prisma.rosterEntry.findMany({
      where: { courseId: quiz.courseId },
      orderBy: { cedula: 'asc' },
      include: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.quizAttempt.findMany({ where: { quizId: quiz.id }, orderBy: { attemptNumber: 'asc' }, include: { student: { select: { fullName: true } } } }),
    prisma.quizAllowance.findMany({ where: { quizId: quiz.id } }),
  ]);
  const mejores = mejoresIntentos(intentos);
  const extra = new Map(permisos.map((p) => [p.studentId, p.extraAttempts]));
  const students = lista.map((r) => {
    const propios = r.userId ? intentos.filter((a) => a.studentId === r.userId) : [];
    const mejor = r.userId ? mejores.get(r.userId) : null;
    const enCurso = propios.find((a) => !a.submittedAt);
    return {
      studentId: r.userId,
      cedula: r.cedula,
      fullName: r.user?.fullName ?? r.fullName,
      registered: r.userId !== null,
      status: enCurso ? 'IN_PROGRESS' : mejor ? 'SUBMITTED' : 'NOT_STARTED',
      grade: mejor ? num(mejor.grade) : null,
      bestAttemptId: mejor?.id ?? null,
      attempts: propios.map(resumenIntento),
      attemptsAllowed: quiz.isPractice ? null : quiz.maxAttempts + (extra.get(r.userId) ?? 0),
    };
  });
  const presentaron = students.filter((s) => s.grade !== null);
  const total = await prisma.quizQuestion.count({ where: { quizId: quiz.id } });
  res.json({
    quiz: resumenQuiz({ ...quiz, _count: { questions: total } }),
    summary: {
      students: students.length,
      submitted: presentaron.length,
      average: presentaron.length ? Math.round((presentaron.reduce((s, x) => s + x.grade, 0) / presentaron.length) * 10) / 10 : null,
      passed: presentaron.filter((s) => s.grade >= 3).length,
    },
    students,
    questionStats: await masFalladas({ id: quiz.id }, { limite: Infinity, soloFalladas: false }),
    ranking: ranking(intentos),
  });
});

// GET /api/quizzes/:quizId/ranking: el estudiante lo ve cuando cierra el quiz; el docente, siempre.
quizzesRouter.get('/quizzes/:quizId/ranking', requireAuth, async (req, res) => {
  const { quiz, acceso } = await quizConAcceso(req);
  const abierto = new Date() < quiz.closesAt;
  if (acceso !== 'owner' && abierto) {
    return res.json({ available: false, closesAt: quiz.closesAt, ranking: [] });
  }
  await cerrarVencidos({ quizId: quiz.id });
  const intentos = await prisma.quizAttempt.findMany({
    where: { quizId: quiz.id, submittedAt: { not: null } },
    include: { student: { select: { fullName: true } } },
  });
  const tabla = ranking(intentos).map((fila) => ({ ...fila, isMe: fila.studentId === req.user.id }));
  res.json({ available: true, closesAt: quiz.closesAt, ranking: tabla });
});

// POST /api/quizzes/:quizId/allowances { studentId }: le da un intento más a un estudiante.
quizzesRouter.post('/quizzes/:quizId/allowances', requireAuth, async (req, res) => {
  const { quiz } = await quizConAcceso(req, 'owner');
  const studentId = v.id(req.body.studentId);
  const enLista = await prisma.rosterEntry.findFirst({ where: { courseId: quiz.courseId, userId: studentId } });
  if (!enLista) throw new HttpError(400, 'El estudiante no está en la lista del curso.');
  const permiso = await prisma.quizAllowance.upsert({
    where: { quizId_studentId: { quizId: quiz.id, studentId } },
    create: { quizId: quiz.id, studentId, extraAttempts: 1 },
    update: { extraAttempts: { increment: 1 } },
  });
  res.json({ extraAttempts: permiso.extraAttempts, attemptsAllowed: quiz.maxAttempts + permiso.extraAttempts });
});

// GET /api/courses/:id/quiz-stats: las preguntas más falladas en todos los quizzes del curso (RF-26).
quizzesRouter.get('/courses/:id/quiz-stats', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  await cerrarVencidos({ quiz: { courseId: course.id } });
  res.json({ mostFailed: await masFalladas({ courseId: course.id }, { limite: 10 }) });
});
