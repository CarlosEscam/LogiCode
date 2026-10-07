import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { crearUsuario, crearCurso, cleanup, PASSWORD } from './helpers.js';

after(cleanup);

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const dia = 24 * 3600 * 1000;

// JPEG mínimo: basta con la firma del formato para la revisión de la API.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);

async function estudianteEnCurso(courseId) {
  const est = await crearUsuario();
  await prisma.rosterEntry.create({ data: { courseId, cedula: est.user.cedula, userId: est.user.id } });
  return est;
}

test('el usuario cambia y quita su foto de perfil; la foto sale en el foro', async () => {
  const est = await crearUsuario();

  const mala = await request(app).put('/api/me/avatar').set(auth(est.token)).attach('avatar', Buffer.from('<svg></svg>'), 'foto.jpg');
  assert.equal(mala.status, 400);

  const subida = await request(app).put('/api/me/avatar').set(auth(est.token)).attach('avatar', JPEG, 'foto.jpg');
  assert.equal(subida.status, 200);
  const url = subida.body.user.avatarUrl;
  assert.match(url, new RegExp(`^/api/users/${est.user.id}/avatar\\?v=`));

  const foto = await request(app).get(url);
  assert.equal(foto.status, 200);
  assert.equal(foto.headers['content-type'], 'image/jpeg');

  const me = await request(app).get('/api/auth/me').set(auth(est.token));
  assert.equal(me.body.user.avatarUrl, url);

  // Otra foto cambia la dirección para que el navegador no muestre la anterior.
  const otra = await request(app).put('/api/me/avatar').set(auth(est.token)).attach('avatar', JPEG, 'otra.jpg');
  assert.notEqual(otra.body.user.avatarUrl, url);

  const tema = await request(app).post('/api/forum/threads').set(auth(est.token)).send({ category: 'GENERAL', title: 'Mi primera pregunta', body: 'Hola' });
  const detalle = await request(app).get(`/api/forum/threads/${tema.body.thread.id}`);
  assert.equal(detalle.body.posts[0].author.avatarUrl, otra.body.user.avatarUrl);
  assert.equal(detalle.body.posts[0].author.avatarPath, undefined);
  assert.equal(detalle.body.thread.author.avatarUrl, otra.body.user.avatarUrl);

  const quitada = await request(app).delete('/api/me/avatar').set(auth(est.token));
  assert.equal(quitada.body.user.avatarUrl, null);
  assert.equal((await request(app).get(`/api/users/${est.user.id}/avatar`)).status, 404);
  await prisma.forumPost.deleteMany({ where: { authorId: est.user.id } });
  await prisma.forumThread.deleteMany({ where: { authorId: est.user.id } });
});

test('el usuario cambia su correo y su contraseña', async () => {
  const est = await crearUsuario();
  const otro = await crearUsuario();

  assert.equal((await request(app).patch('/api/me').set(auth(est.token)).send({ email: otro.user.email })).status, 409);
  const cambio = await request(app).patch('/api/me').set(auth(est.token)).send({ email: `nuevo-${est.user.cedula}@prueba.test` });
  assert.equal(cambio.status, 200);
  assert.equal(cambio.body.user.email, `nuevo-${est.user.cedula}@prueba.test`);

  const mala = await request(app).post('/api/me/password').set(auth(est.token)).send({ currentPassword: 'otra-cosa', newPassword: 'nueva-clave-456' });
  assert.equal(mala.status, 400);
  const buena = await request(app).post('/api/me/password').set(auth(est.token)).send({ currentPassword: PASSWORD, newPassword: 'nueva-clave-456' });
  assert.equal(buena.status, 200);
  const login = await request(app).post('/api/auth/login').send({ cedula: est.user.cedula, password: 'nueva-clave-456' });
  assert.equal(login.status, 200);
});

test('el resumen y las notas del estudiante muestran pendientes, notas y retroalimentación', async () => {
  const docente = await crearUsuario({ role: 'TEACHER' });
  const curso = await crearCurso(docente.user.id);
  const ana = await estudianteEnCurso(curso.id);
  const tema = await prisma.topic.create({ data: { courseId: curso.id, title: 'Condicionales', tool: 'PSEINT', isNextClass: true } });
  const ahora = Date.now();

  const base = { courseId: curso.id, submissionType: 'TEXT', opensAt: new Date(ahora - 3 * dia) };
  const pendiente = await prisma.activity.create({ data: { ...base, type: 'TASK', title: 'Tarea pendiente', topicId: tema.id, closesAt: new Date(ahora + 2 * dia) } });
  const calificada = await prisma.activity.create({ data: { ...base, type: 'WORKSHOP', title: 'Taller calificado', topicId: tema.id, closesAt: new Date(ahora - dia) } });
  const vencida = await prisma.activity.create({ data: { ...base, type: 'EVALUATION', title: 'Evaluación vencida', closesAt: new Date(ahora - dia) } });
  const prorrogada = await prisma.activity.create({ data: { ...base, type: 'TASK', title: 'Con prórroga', closesAt: new Date(ahora - dia) } });
  await prisma.activityExtension.create({ data: { activityId: prorrogada.id, studentId: ana.user.id, newClosesAt: new Date(ahora + dia) } });
  await prisma.activity.create({ data: { ...base, type: 'TASK', title: 'Todavía cerrada', opensAt: new Date(ahora + dia), closesAt: new Date(ahora + 5 * dia) } });
  await prisma.submission.create({
    data: { activityId: calificada.id, studentId: ana.user.id, status: 'GRADED', submittedAt: new Date(ahora - 2 * dia), finalGrade: 4.5, teacherComment: 'Muy bien' },
  });

  const quizBase = { courseId: curso.id, timeLimitMinutes: 30, published: true };
  const quizAbierto = await prisma.quiz.create({ data: { ...quizBase, title: 'Quiz abierto', opensAt: new Date(ahora - dia), closesAt: new Date(ahora + dia) } });
  await prisma.quiz.create({ data: { ...quizBase, title: 'Quiz próximo', opensAt: new Date(ahora + dia), closesAt: new Date(ahora + 2 * dia) } });
  const quizCerrado = await prisma.quiz.create({ data: { ...quizBase, title: 'Quiz cerrado', opensAt: new Date(ahora - 3 * dia), closesAt: new Date(ahora - dia) } });
  await prisma.quiz.create({ data: { ...quizBase, title: 'Borrador', published: false, opensAt: new Date(ahora - dia), closesAt: new Date(ahora + dia) } });
  await prisma.quizAttempt.create({
    data: { quizId: quizCerrado.id, studentId: ana.user.id, deadline: new Date(ahora - 2 * dia), submittedAt: new Date(ahora - 2 * dia), grade: 3.0, correctCount: 3 },
  });

  const resumen = await request(app).get('/api/me/summary').set(auth(ana.token));
  assert.equal(resumen.status, 200);
  const titulos = resumen.body.pending.map((p) => p.title).sort();
  assert.deepEqual(titulos, ['Con prórroga', 'Quiz abierto', 'Tarea pendiente']);
  assert.equal(resumen.body.pending.find((p) => p.kind === 'QUIZ').id, quizAbierto.id);
  assert.deepEqual(resumen.body.upcoming.map((p) => p.title), ['Quiz próximo']);
  assert.deepEqual(resumen.body.recentGrades.map((g) => g.nota).sort(), [3, 4.5]);
  const c = resumen.body.courses[0];
  assert.equal(c.nextClass.title, 'Condicionales');
  assert.equal(c.pendientes, 3);
  assert.deepEqual(c.temas[0], { id: tema.id, title: 'Condicionales', tool: 'PSEINT', total: 2, hechas: 1 });

  const notas = await request(app).get('/api/me/grades').set(auth(ana.token));
  const curso1 = notas.body.courses[0];
  const porTitulo = Object.fromEntries(curso1.actividades.map((a) => [a.title, a]));
  assert.equal(porTitulo['Taller calificado'].estado, 'CALIFICADA');
  assert.equal(porTitulo['Taller calificado'].nota, 4.5);
  assert.equal(porTitulo['Taller calificado'].comentario, 'Muy bien');
  assert.equal(porTitulo['Evaluación vencida'].estado, 'NO_ENTREGO');
  assert.equal(porTitulo['Con prórroga'].estado, 'PENDIENTE');
  assert.equal(porTitulo['Todavía cerrada'], undefined);
  assert.equal(curso1.quizzes.find((q) => q.title === 'Quiz cerrado').nota, 3);
  // 4,5 + 0,0 (vencida) + 3,0 (quiz) = 7,5 / 3
  assert.equal(curso1.promedio, 2.5);

  // Otro estudiante no ve nada de este curso, y el docente no usa estas rutas.
  const ajeno = await crearUsuario();
  assert.deepEqual((await request(app).get('/api/me/summary').set(auth(ajeno.token))).body.pending, []);
  assert.equal((await request(app).get('/api/me/summary').set(auth(docente.token))).status, 403);
});

test('las partidas de los juegos guardan el mejor puntaje', async () => {
  const est = await crearUsuario();
  assert.equal((await request(app).post('/api/me/games').set(auth(est.token)).send({ game: 'TETRIS', score: 1, maxScore: 2 })).status, 400);
  assert.equal((await request(app).post('/api/me/games').set(auth(est.token)).send({ game: 'ORDENAR_PASOS', score: 5, maxScore: 2 })).status, 400);
  await request(app).post('/api/me/games').set(auth(est.token)).send({ game: 'ORDENAR_PASOS', score: 3, maxScore: 5, seconds: 40 });
  await request(app).post('/api/me/games').set(auth(est.token)).send({ game: 'ORDENAR_PASOS', score: 5, maxScore: 5, seconds: 90 });
  const res = await request(app).post('/api/me/games').set(auth(est.token)).send({ game: 'ORDENAR_PASOS', score: 5, maxScore: 5, seconds: 60 });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.games.ORDENAR_PASOS, { score: 5, maxScore: 5, seconds: 60, jugadas: 3 });
  assert.deepEqual(res.body.games.MEMORAMA_DFD, { jugadas: 0 });
  assert.equal((await request(app).post('/api/me/games').send({ game: 'ORDENAR_PASOS', score: 1, maxScore: 1 })).status, 401);
});
