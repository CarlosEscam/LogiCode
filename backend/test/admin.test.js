import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { rutaCopia } from '../src/lib/copias.js';
import { PASSWORD, crearUsuario, crearCurso, cleanup } from './helpers.js';

after(cleanup);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('solo el administrador entra a las rutas de administración', async () => {
  const docente = await crearUsuario({ role: 'TEACHER' });
  const res = await request(app).get('/api/admin/users').set(auth(docente.token));
  assert.equal(res.status, 403);
  const sinSesion = await request(app).get('/api/admin/stats');
  assert.equal(sinSesion.status, 401);
});

test('el administrador busca usuarios por cédula, nombre o correo y filtra por rol', async () => {
  const admin = await crearUsuario({ role: 'ADMIN' });
  const estudiante = await crearUsuario();

  const porCedula = await request(app).get(`/api/admin/users?q=${estudiante.user.cedula}`).set(auth(admin.token));
  assert.equal(porCedula.status, 200);
  assert.deepEqual(porCedula.body.users.map((u) => u.id), [estudiante.user.id]);
  assert.equal(porCedula.body.users[0].passwordHash, undefined);

  const porCorreo = await request(app).get(`/api/admin/users?q=${estudiante.user.cedula}@PRUEBA`).set(auth(admin.token));
  assert.equal(porCorreo.body.total, 1);

  const docentes = await request(app).get(`/api/admin/users?role=TEACHER&q=${estudiante.user.cedula}`).set(auth(admin.token));
  assert.equal(docentes.body.total, 0);

  const detalle = await request(app).get(`/api/admin/users/${estudiante.user.id}`).set(auth(admin.token));
  assert.equal(detalle.status, 200);
  assert.deepEqual(detalle.body.coursesEnrolled, []);
});

test('deshabilitar una cuenta le cierra el acceso; el admin no se deshabilita a sí mismo', async () => {
  const admin = await crearUsuario({ role: 'ADMIN' });
  const estudiante = await crearUsuario();

  const off = await request(app).patch(`/api/admin/users/${estudiante.user.id}`).set(auth(admin.token)).send({ status: 'DISABLED' });
  assert.equal(off.status, 200);
  assert.equal(off.body.user.status, 'DISABLED');
  const me = await request(app).get('/api/auth/me').set(auth(estudiante.token));
  assert.equal(me.status, 401);
  const login = await request(app).post('/api/auth/login').send({ cedula: estudiante.user.cedula, password: PASSWORD });
  assert.equal(login.status, 403);

  const yo = await request(app).patch(`/api/admin/users/${admin.user.id}`).set(auth(admin.token)).send({ status: 'DISABLED' });
  assert.equal(yo.status, 400);
  const miRol = await request(app).patch(`/api/admin/users/${admin.user.id}`).set(auth(admin.token)).send({ role: 'STUDENT' });
  assert.equal(miRol.status, 400);
});

test('cambiar rol: un docente con cursos no deja de ser docente hasta pasar sus cursos', async () => {
  const admin = await crearUsuario({ role: 'ADMIN' });
  const docente = await crearUsuario({ role: 'TEACHER' });
  const otro = await crearUsuario({ role: 'TEACHER' });
  const curso = await crearCurso(docente.user.id);

  const bloqueado = await request(app).patch(`/api/admin/users/${docente.user.id}`).set(auth(admin.token)).send({ role: 'STUDENT' });
  assert.equal(bloqueado.status, 400);

  const pasar = await request(app).patch(`/api/admin/courses/${curso.id}`).set(auth(admin.token)).send({ teacherId: otro.user.id });
  assert.equal(pasar.status, 200);
  assert.equal(pasar.body.course.teacher.id, otro.user.id);

  const aEstudiante = await request(app).patch(`/api/admin/users/${docente.user.id}`).set(auth(admin.token)).send({ role: 'STUDENT' });
  assert.equal(aEstudiante.status, 200);
  assert.equal(aEstudiante.body.user.role, 'STUDENT');

  const aEstudianteNoDocente = await request(app).patch(`/api/admin/courses/${curso.id}`).set(auth(admin.token)).send({ teacherId: docente.user.id });
  assert.equal(aEstudianteNoDocente.status, 400);
});

test('contraseña temporal: la anterior deja de servir y la nueva sí', async () => {
  const admin = await crearUsuario({ role: 'ADMIN' });
  const estudiante = await crearUsuario();
  const res = await request(app)
    .post(`/api/admin/users/${estudiante.user.id}/reset-password`)
    .set(auth(admin.token))
    .send({ mode: 'temporary' });
  assert.equal(res.status, 200);
  const temporal = res.body.temporaryPassword;
  assert.ok(temporal.length >= 10);

  const vieja = await request(app).post('/api/auth/login').send({ cedula: estudiante.user.cedula, password: PASSWORD });
  assert.equal(vieja.status, 401);
  const nueva = await request(app).post('/api/auth/login').send({ cedula: estudiante.user.cedula, password: temporal });
  assert.equal(nueva.status, 200);

  const enlace = await request(app).post(`/api/admin/users/${estudiante.user.id}/reset-password`).set(auth(admin.token)).send({ mode: 'link' });
  assert.equal(enlace.status, 200);
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: estudiante.user.id, usedAt: null } }), 1);
});

test('resumen y cursos muestran cifras, sin notas', async () => {
  const admin = await crearUsuario({ role: 'ADMIN' });
  const docente = await crearUsuario({ role: 'TEACHER' });
  const estudiante = await crearUsuario();
  const curso = await crearCurso(docente.user.id);
  await prisma.rosterEntry.createMany({
    data: [
      { courseId: curso.id, cedula: estudiante.user.cedula, userId: estudiante.user.id },
      { courseId: curso.id, cedula: '1234567' },
    ],
  });

  const stats = await request(app).get('/api/admin/stats').set(auth(admin.token));
  assert.equal(stats.status, 200);
  assert.ok(stats.body.users.ADMIN.ACTIVE >= 1);
  assert.ok(stats.body.courses >= 1);

  const cursos = await request(app).get('/api/admin/courses').set(auth(admin.token));
  const este = cursos.body.courses.find((c) => c.id === curso.id);
  assert.deepEqual([este.counts.roster, este.counts.registered], [2, 1]);
  assert.equal(este.teacher.id, docente.user.id);
});

test('copia de seguridad: se hace, aparece en la lista y se descarga', async () => {
  const admin = await crearUsuario({ role: 'ADMIN' });
  const hecha = await request(app).post('/api/admin/backups').set(auth(admin.token));
  assert.equal(hecha.status, 201);
  const nombre = hecha.body.backup.name;
  try {
    const lista = await request(app).get('/api/admin/backups').set(auth(admin.token));
    assert.ok(lista.body.backups.some((b) => b.name === nombre));

    const descarga = await request(app)
      .get(`/api/admin/backups/${nombre}`)
      .set(auth(admin.token))
      .buffer(true)
      .parse((res, cb) => {
        const partes = [];
        res.on('data', (p) => partes.push(p));
        res.on('end', () => cb(null, Buffer.concat(partes)));
      });
    assert.equal(descarga.status, 200);
    const contenido = JSON.parse(zlib.gunzipSync(descarga.body).toString('utf8'));
    assert.equal(contenido.app, 'LogiCode');
    assert.ok(contenido.tablas.User.some((u) => u.id === admin.user.id));

    const fuera = await request(app).get('/api/admin/backups/..%2F.env').set(auth(admin.token));
    assert.equal(fuera.status, 404);
  } finally {
    fs.rmSync(rutaCopia(nombre), { force: true });
  }
});
