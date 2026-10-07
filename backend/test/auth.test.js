import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { PASSWORD, nuevaCedula, crearUsuario, crearCurso, registrarUsuario, cleanup } from './helpers.js';

after(cleanup);

function datosRegistro(cedula, extra = {}) {
  return { cedula, fullName: 'Estudiante de Prueba', email: `${cedula}@prueba.test`, password: PASSWORD, ...extra };
}

test('un estudiante con cédula habilitada se registra, queda enlazado al curso e ingresa', async () => {
  const { user: docente } = await crearUsuario({ role: 'TEACHER' });
  const curso = await crearCurso(docente.id);
  const cedula = nuevaCedula();
  await prisma.rosterEntry.create({ data: { courseId: curso.id, cedula } });

  const reg = await request(app).post('/api/auth/register').send(datosRegistro(cedula));
  assert.equal(reg.status, 201);
  registrarUsuario(reg.body.user.id);
  assert.equal(reg.body.user.role, 'STUDENT');
  assert.ok(reg.body.token);
  assert.equal(reg.body.user.passwordHash, undefined);

  const entrada = await prisma.rosterEntry.findFirst({ where: { courseId: curso.id, cedula } });
  assert.equal(entrada.userId, reg.body.user.id);

  const login = await request(app).post('/api/auth/login').send({ cedula, password: PASSWORD });
  assert.equal(login.status, 200);
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(me.body.user.cedula, cedula);

  const cursos = await request(app).get('/api/courses').set('Authorization', `Bearer ${login.body.token}`);
  assert.deepEqual(cursos.body.courses.map((c) => c.id), [curso.id]);
});

test('una cédula que no está en ninguna lista no se puede registrar como estudiante', async () => {
  const res = await request(app).post('/api/auth/register').send(datosRegistro(nuevaCedula()));
  assert.equal(res.status, 403);
  assert.match(res.body.error, /no está habilitada/);
});

test('no se repite cédula ni correo', async () => {
  const { user } = await crearUsuario();
  const res = await request(app)
    .post('/api/auth/register')
    .send(datosRegistro(user.cedula, { role: 'TEACHER' }));
  assert.equal(res.status, 409);
});

test('datos inválidos responden 400 con un mensaje claro', async () => {
  const res = await request(app).post('/api/auth/register').send({ cedula: 'abc' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /cédula/);
  const vacio = await request(app).post('/api/auth/login');
  assert.equal(vacio.status, 401);
});

test('un docente queda pendiente, no ingresa hasta que el administrador lo aprueba', async () => {
  const cedula = nuevaCedula();
  const reg = await request(app).post('/api/auth/register').send(datosRegistro(cedula, { role: 'TEACHER' }));
  assert.equal(reg.status, 201);
  registrarUsuario(reg.body.user.id);
  assert.equal(reg.body.user.status, 'PENDING');
  assert.equal(reg.body.token, undefined);

  const antes = await request(app).post('/api/auth/login').send({ cedula, password: PASSWORD });
  assert.equal(antes.status, 403);

  const { token: tokenEstudiante } = await crearUsuario();
  const prohibido = await request(app)
    .post(`/api/admin/teachers/${reg.body.user.id}/approve`)
    .set('Authorization', `Bearer ${tokenEstudiante}`);
  assert.equal(prohibido.status, 403);

  const { token: tokenAdmin } = await crearUsuario({ role: 'ADMIN' });
  const pendientes = await request(app)
    .get('/api/admin/teachers?status=PENDING')
    .set('Authorization', `Bearer ${tokenAdmin}`);
  assert.ok(pendientes.body.teachers.some((t) => t.cedula === cedula));

  const aprobar = await request(app)
    .post(`/api/admin/teachers/${reg.body.user.id}/approve`)
    .set('Authorization', `Bearer ${tokenAdmin}`);
  assert.equal(aprobar.body.teacher.status, 'ACTIVE');

  const despues = await request(app).post('/api/auth/login').send({ cedula, password: PASSWORD });
  assert.equal(despues.status, 200);
  assert.equal(despues.body.user.role, 'TEACHER');
});

test('contraseña incorrecta y sesión inválida se rechazan', async () => {
  const { user } = await crearUsuario();
  const res = await request(app).post('/api/auth/login').send({ cedula: user.cedula, password: 'otra-clave-1' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Cédula o contraseña incorrecta.');
  const me = await request(app).get('/api/auth/me').set('Authorization', 'Bearer no-es-un-token');
  assert.equal(me.status, 401);
});

test('un usuario deshabilitado pierde la sesión de inmediato', async () => {
  const { user, token } = await crearUsuario();
  await prisma.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(me.status, 401);
});

test('recuperar contraseña: el enlace sirve una sola vez', async () => {
  const { user } = await crearUsuario();
  // Se captura el token que se habría enviado por correo.
  const original = console.log;
  let correo = '';
  console.log = (texto) => { correo += texto; };
  try {
    const res = await request(app).post('/api/auth/forgot-password').send({ cedulaOrEmail: user.email });
    assert.equal(res.status, 200);
  } finally {
    console.log = original;
  }
  const token = correo.match(/token=([0-9a-f]{64})/)[1];

  const nueva = 'nueva-clave-456';
  const reset = await request(app).post('/api/auth/reset-password').send({ token, password: nueva });
  assert.equal(reset.status, 200);
  const otraVez = await request(app).post('/api/auth/reset-password').send({ token, password: nueva });
  assert.equal(otraVez.status, 400);

  const login = await request(app).post('/api/auth/login').send({ cedula: user.cedula, password: nueva });
  assert.equal(login.status, 200);
});

test('recuperar contraseña no revela si la cuenta existe', async () => {
  const res = await request(app).post('/api/auth/forgot-password').send({ cedulaOrEmail: 'nadie@prueba.test' });
  assert.equal(res.status, 200);
  const malo = await request(app)
    .post('/api/auth/reset-password')
    .send({ token: crypto.randomBytes(32).toString('hex'), password: PASSWORD });
  assert.equal(malo.status, 400);
});
