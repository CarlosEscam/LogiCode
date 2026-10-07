import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { calificar, normalizar } from '../src/lib/preguntas.js';
import { crearUsuario, crearCurso, cleanup } from './helpers.js';

after(cleanup);

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const horas = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

async function escenario() {
  const docente = await crearUsuario({ role: 'TEACHER' });
  const curso = await crearCurso(docente.user.id);
  const estudiantes = [];
  for (let i = 0; i < 2; i++) {
    const e = await crearUsuario();
    await prisma.rosterEntry.create({ data: { courseId: curso.id, cedula: e.user.cedula, userId: e.user.id } });
    estudiantes.push(e);
  }
  const ajeno = await crearUsuario();
  return { docente, curso, estudiantes, ajeno };
}

async function crearPregunta(token, cursoId, datos) {
  const res = await request(app).post(`/api/courses/${cursoId}/questions`).set(auth(token)).send(datos);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.question;
}

async function bancoBasico(token, cursoId) {
  return [
    await crearPregunta(token, cursoId, {
      type: 'MULTIPLE_CHOICE', tool: 'PSEINT', statement: '¿Qué instrucción muestra un mensaje?',
      options: ['Leer', 'Escribir', 'Definir'], correctAnswer: 1,
    }),
    await crearPregunta(token, cursoId, { type: 'TRUE_FALSE', tool: 'DFD', statement: 'El rombo es una decisión.', correctAnswer: true }),
    await crearPregunta(token, cursoId, {
      type: 'OUTPUT', tool: 'PSEINT', statement: '¿Qué muestra?', code: 'Para i<-1 Hasta 3 Hacer\n  Escribir i\nFinPara',
      correctAnswer: ['1\n2\n3'],
    }),
    await crearPregunta(token, cursoId, {
      type: 'ORDER_STEPS', tool: 'GENERAL', statement: 'Ordene los pasos',
      options: ['Inicio', 'Leer dato', 'Mostrar resultado', 'Fin'],
    }),
  ];
}

async function crearQuiz(token, cursoId, preguntas, datos = {}) {
  const res = await request(app)
    .post(`/api/courses/${cursoId}/quizzes`)
    .set(auth(token))
    .send({
      title: 'Quiz de ciclos', timeLimitMinutes: 30, opensAt: horas(-1), closesAt: horas(2), published: true,
      questions: preguntas.map((q) => ({ questionId: q.id, points: 1 })),
      ...datos,
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.quiz;
}

test('calificación automática por tipo de pregunta', () => {
  assert.equal(normalizar('  Hola   Mundo \n\n'), 'hola mundo');
  assert.equal(normalizar('Árbol'), 'arbol');
  const mc = { type: 'MULTIPLE_CHOICE', options: ['a', 'b'], correctAnswer: 1 };
  assert.equal(calificar(mc, 1), 1);
  assert.equal(calificar(mc, 0), 0);
  assert.equal(calificar(mc, null), 0);
  assert.equal(calificar({ type: 'TRUE_FALSE', correctAnswer: false }, false), 1);
  assert.equal(calificar({ type: 'SHORT_ANSWER', correctAnswer: ['Mientras', 'ciclo mientras'] }, ' CICLO  mientras '), 1);
  assert.equal(calificar({ type: 'OUTPUT', correctAnswer: ['1\n2\n3'] }, '1\r\n2 \n3\n'), 1);
  const orden = { type: 'ORDER_STEPS', options: ['a', 'b', 'c', 'd'] };
  assert.equal(calificar(orden, ['a', 'b', 'd', 'c']), 0.5);
  assert.equal(calificar(orden, ['a', 'b', 'c', 'd']), 1);
});

test('el docente maneja su banco de preguntas; los estudiantes no lo ven', async () => {
  const { docente, curso, estudiantes } = await escenario();
  const [mc] = await bancoBasico(docente.token, curso.id);

  const malas = [
    { type: 'MULTIPLE_CHOICE', statement: 'x', options: ['solo una'], correctAnswer: 0 },
    { type: 'MULTIPLE_CHOICE', statement: 'x', options: ['a', 'b'], correctAnswer: 5 },
    { type: 'TRUE_FALSE', statement: 'x' },
    { type: 'OUTPUT', statement: 'x', correctAnswer: ['1'] },
    { type: 'ORDER_STEPS', statement: 'x', options: ['a', 'b'] },
    { type: 'OPEN', statement: 'x' },
    { type: 'TRUE_FALSE', statement: 'x', correctAnswer: true, tool: 'COBOL' },
  ];
  for (const datos of malas) {
    const res = await request(app).post(`/api/courses/${curso.id}/questions`).set(auth(docente.token)).send(datos);
    assert.equal(res.status, 400, JSON.stringify(datos));
  }

  const filtro = await request(app).get(`/api/courses/${curso.id}/questions?tool=DFD`).set(auth(docente.token));
  assert.equal(filtro.status, 200);
  assert.deepEqual(filtro.body.questions.map((q) => q.type), ['TRUE_FALSE']);
  const busqueda = await request(app).get(`/api/courses/${curso.id}/questions?q=mensaje`).set(auth(docente.token));
  assert.equal(busqueda.body.questions.length, 1);

  // El banco sirve en otro curso del mismo docente (otro semestre).
  const otroCurso = await crearCurso(docente.user.id);
  const enOtro = await request(app).get(`/api/courses/${otroCurso.id}/questions`).set(auth(docente.token));
  assert.equal(enOtro.body.questions.length, 4);

  const editada = await request(app).patch(`/api/questions/${mc.id}`).set(auth(docente.token)).send({ statement: '¿Cuál muestra un mensaje en pantalla?' });
  assert.equal(editada.status, 200);
  assert.equal(editada.body.question.correctAnswer, 1);

  assert.equal((await request(app).get(`/api/courses/${curso.id}/questions`).set(auth(estudiantes[0].token))).status, 403);
  assert.equal((await request(app).patch(`/api/questions/${mc.id}`).set(auth(estudiantes[0].token)).send({ statement: 'hack' })).status, 403);

  const borrada = await request(app).delete(`/api/questions/${mc.id}`).set(auth(docente.token));
  assert.equal(borrada.status, 204);
});

test('el estudiante presenta el quiz, recibe su nota y tiene un solo intento', async () => {
  const { docente, curso, estudiantes, ajeno } = await escenario();
  const preguntas = await bancoBasico(docente.token, curso.id);
  const quiz = await crearQuiz(docente.token, curso.id, preguntas);
  const borrador = await crearQuiz(docente.token, curso.id, preguntas, { title: 'Borrador', published: false });
  const [ana, luis] = estudiantes;

  const lista = await request(app).get(`/api/courses/${curso.id}/quizzes`).set(auth(ana.token));
  assert.equal(lista.status, 200);
  assert.deepEqual(lista.body.quizzes.map((q) => q.id), [quiz.id]);
  assert.equal((await request(app).get(`/api/quizzes/${borrador.id}`).set(auth(ana.token))).status, 404);
  assert.equal((await request(app).get(`/api/courses/${curso.id}/quizzes`).set(auth(ajeno.token))).status, 403);
  assert.equal((await request(app).post(`/api/quizzes/${quiz.id}/start`).set(auth(ajeno.token))).status, 403);

  const inicio = await request(app).post(`/api/quizzes/${quiz.id}/start`).set(auth(ana.token));
  assert.equal(inicio.status, 201);
  const intentoId = inicio.body.attemptId;
  // Volver a entrar devuelve el mismo intento (el reloj sigue corriendo).
  assert.equal((await request(app).post(`/api/quizzes/${quiz.id}/start`).set(auth(ana.token))).body.attemptId, intentoId);

  const enCurso = await request(app).get(`/api/quiz-attempts/${intentoId}`).set(auth(ana.token));
  assert.equal(enCurso.status, 200);
  assert.equal(enCurso.body.inProgress, true);
  assert.equal(enCurso.body.questions.length, 4);
  assert.ok(enCurso.body.questions.every((q) => q.correctAnswer === undefined));
  const orden = enCurso.body.questions.find((q) => q.type === 'ORDER_STEPS');
  assert.notDeepEqual(orden.options, ['Inicio', 'Leer dato', 'Mostrar resultado', 'Fin']);

  // Otro estudiante no puede ver ni responder el intento.
  assert.equal((await request(app).get(`/api/quiz-attempts/${intentoId}`).set(auth(luis.token))).status, 404);

  const [mc, vf, salida, pasos] = preguntas;
  assert.equal((await request(app).put(`/api/quiz-attempts/${intentoId}/answers`).set(auth(ana.token)).send({ questionId: mc.id, answer: 'Escribir' })).status, 400);
  const guardada = await request(app).put(`/api/quiz-attempts/${intentoId}/answers`).set(auth(ana.token)).send({ questionId: mc.id, answer: 1 });
  assert.equal(guardada.status, 200);

  const envio = await request(app)
    .post(`/api/quiz-attempts/${intentoId}/submit`)
    .set(auth(ana.token))
    .send({ answers: { [vf.id]: false, [salida.id]: '1\n2\n3', [pasos.id]: ['Inicio', 'Leer dato', 'Fin', 'Mostrar resultado'] } });
  assert.equal(envio.status, 200);
  // 1 + 0 + 1 + 0,5 de 4 puntos = 2,5/4 -> 3,1
  assert.equal(envio.body.attempt.grade, 3.1);
  assert.equal(envio.body.attempt.correctCount, 2);
  assert.equal((await request(app).post(`/api/quiz-attempts/${intentoId}/submit`).set(auth(ana.token))).status, 400);

  // Las respuestas correctas y el ranking se ven cuando cierra el quiz.
  const resultado = await request(app).get(`/api/quiz-attempts/${intentoId}`).set(auth(ana.token));
  assert.equal(resultado.body.revealed, false);
  assert.equal(resultado.body.review, null);
  assert.equal((await request(app).get(`/api/quizzes/${quiz.id}/ranking`).set(auth(ana.token))).body.available, false);

  // Un solo intento, salvo que el docente habilite otro.
  const otra = await request(app).post(`/api/quizzes/${quiz.id}/start`).set(auth(ana.token));
  assert.equal(otra.status, 400);
  const permiso = await request(app).post(`/api/quizzes/${quiz.id}/allowances`).set(auth(docente.token)).send({ studentId: ana.user.id });
  assert.equal(permiso.status, 200);
  assert.equal(permiso.body.attemptsAllowed, 2);
  const segundo = await request(app).post(`/api/quizzes/${quiz.id}/start`).set(auth(ana.token));
  assert.equal(segundo.status, 201);
  const todo = { [mc.id]: 1, [vf.id]: true, [salida.id]: '1 \n2\n3', [pasos.id]: ['Inicio', 'Leer dato', 'Mostrar resultado', 'Fin'] };
  const perfecto = await request(app).post(`/api/quiz-attempts/${segundo.body.attemptId}/submit`).set(auth(ana.token)).send({ answers: todo });
  assert.equal(perfecto.body.attempt.grade, 5);

  // Luis se queda sin tiempo: el intento se cierra solo con lo que guardó.
  const deLuis = await request(app).post(`/api/quizzes/${quiz.id}/start`).set(auth(luis.token));
  await request(app).put(`/api/quiz-attempts/${deLuis.body.attemptId}/answers`).set(auth(luis.token)).send({ questionId: vf.id, answer: true });
  await prisma.quizAttempt.update({ where: { id: deLuis.body.attemptId }, data: { deadline: new Date(Date.now() - 60_000) } });
  const tarde = await request(app).put(`/api/quiz-attempts/${deLuis.body.attemptId}/answers`).set(auth(luis.token)).send({ questionId: mc.id, answer: 1 });
  assert.equal(tarde.status, 400);

  const resultados = await request(app).get(`/api/quizzes/${quiz.id}/results`).set(auth(docente.token));
  assert.equal(resultados.status, 200);
  assert.equal(resultados.body.summary.submitted, 2);
  const filaLuis = resultados.body.students.find((s) => s.studentId === luis.user.id);
  assert.equal(filaLuis.grade, 1.3);
  assert.equal(filaLuis.attempts[0].autoSubmitted, true);
  assert.equal(resultados.body.students.find((s) => s.studentId === ana.user.id).grade, 5);
  assert.deepEqual(resultados.body.ranking.map((r) => r.studentId), [ana.user.id, luis.user.id]);
  // La más fallada primero: la de selección múltiple no la respondió Luis y la de salida tampoco.
  const stats = resultados.body.questionStats;
  assert.equal(stats.length, 4);
  assert.ok(stats[0].failRate >= stats.at(-1).failRate);
  assert.equal(stats.find((s) => s.questionId === vf.id).failed, 1);

  const panel = await request(app).get(`/api/courses/${curso.id}/quiz-stats`).set(auth(docente.token));
  assert.equal(panel.status, 200);
  assert.ok(panel.body.mostFailed.length > 0);
  assert.equal((await request(app).get(`/api/quizzes/${quiz.id}/results`).set(auth(ana.token))).status, 403);

  // El docente ve cualquier intento con las respuestas correctas.
  const revision = await request(app).get(`/api/quiz-attempts/${intentoId}`).set(auth(docente.token));
  assert.equal(revision.body.revealed, true);
  assert.equal(revision.body.review.length, 4);

  // Las preguntas no se cambian cuando ya hay intentos.
  const cambio = await request(app).patch(`/api/quizzes/${quiz.id}`).set(auth(docente.token)).send({ questions: [{ questionId: mc.id }] });
  assert.equal(cambio.status, 400);

  // Si el docente corrige la clave de una pregunta, las notas se recalculan.
  const corregida = await request(app).patch(`/api/questions/${vf.id}`).set(auth(docente.token)).send({ correctAnswer: false });
  assert.equal(corregida.status, 200);
  assert.equal(corregida.body.regraded, 3);
  const primerIntento = await prisma.quizAttempt.findUnique({ where: { id: intentoId } });
  assert.equal(Number(primerIntento.grade), 4.4);

  // Al cerrar el quiz se publican el ranking y la revisión.
  await prisma.quiz.update({ where: { id: quiz.id }, data: { closesAt: new Date(Date.now() - 1000), opensAt: new Date(Date.now() - 7_200_000) } });
  const rankingFinal = await request(app).get(`/api/quizzes/${quiz.id}/ranking`).set(auth(luis.token));
  assert.equal(rankingFinal.body.available, true);
  assert.equal(rankingFinal.body.ranking.find((r) => r.isMe).studentId, luis.user.id);
  const revelado = await request(app).get(`/api/quiz-attempts/${intentoId}`).set(auth(ana.token));
  assert.equal(revelado.body.revealed, true);
  assert.equal((await request(app).post(`/api/quizzes/${quiz.id}/start`).set(auth(luis.token))).status, 400);

  // La pregunta usada no se borra: se archiva.
  const archivar = await request(app).delete(`/api/questions/${mc.id}`).set(auth(docente.token));
  assert.equal(archivar.body.archived, true);
});

test('validaciones al crear el quiz y quiz de repaso sin límite de intentos', async () => {
  const { docente, curso, estudiantes } = await escenario();
  const preguntas = await bancoBasico(docente.token, curso.id);
  const base = { title: 'Quiz', timeLimitMinutes: 30, opensAt: horas(-1), closesAt: horas(1), questions: [{ questionId: preguntas[0].id }] };
  const casos = [
    { ...base, questions: [] },
    { ...base, closesAt: horas(-2) },
    { ...base, timeLimitMinutes: 0 },
    { ...base, questions: [{ questionId: 999999999 }] },
  ];
  for (const datos of casos) {
    assert.equal((await request(app).post(`/api/courses/${curso.id}/quizzes`).set(auth(docente.token)).send(datos)).status, 400);
  }
  assert.equal((await request(app).post(`/api/courses/${curso.id}/quizzes`).set(auth(estudiantes[0].token)).send(base)).status, 403);

  const repaso = await crearQuiz(docente.token, curso.id, preguntas.slice(0, 1), { isPractice: true });
  for (let i = 0; i < 2; i++) {
    const inicio = await request(app).post(`/api/quizzes/${repaso.id}/start`).set(auth(estudiantes[0].token));
    assert.equal(inicio.status, 201);
    await request(app).post(`/api/quiz-attempts/${inicio.body.attemptId}/submit`).set(auth(estudiantes[0].token)).send({ answers: { [preguntas[0].id]: 1 } });
    // En el repaso la revisión se ve de inmediato.
    const r = await request(app).get(`/api/quiz-attempts/${inicio.body.attemptId}`).set(auth(estudiantes[0].token));
    assert.equal(r.body.revealed, true);
  }

  // El tiempo del intento no pasa del cierre del quiz.
  const corto = await crearQuiz(docente.token, curso.id, preguntas, { timeLimitMinutes: 120, closesAt: horas(0.5) });
  const inicio = await request(app).post(`/api/quizzes/${corto.id}/start`).set(auth(estudiantes[1].token));
  const intento = await prisma.quizAttempt.findUnique({ where: { id: inicio.body.attemptId } });
  assert.ok(intento.deadline.getTime() <= new Date(horas(0.5)).getTime() + 1000);

  const borrar = await request(app).delete(`/api/quizzes/${corto.id}`).set(auth(docente.token));
  assert.equal(borrar.status, 204);
});
