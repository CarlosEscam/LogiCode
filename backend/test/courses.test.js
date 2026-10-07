import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { crearUsuario, crearCurso, nuevaCedula, registrarCurso, cleanup } from './helpers.js';

after(cleanup);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('el docente crea su curso y carga la lista de cédulas', async () => {
  const { token } = await crearUsuario({ role: 'TEACHER' });
  const creado = await request(app).post('/api/courses').set(auth(token)).send({ name: 'Pensamiento Computacional', period: '2026-2' });
  assert.equal(creado.status, 201);
  const id = creado.body.course.id;
  registrarCurso(id);
  const { user: estudiante } = await crearUsuario();
  const a = nuevaCedula();

  const carga = await request(app)
    .post(`/api/courses/${id}/roster`)
    .set(auth(token))
    .send({ text: `Cédula,Nombre\n${a},Ana Pérez\n${estudiante.cedula}\nxyz` });
  assert.equal(carga.status, 201);
  assert.deepEqual(carga.body, { added: 2, alreadyListed: 0, invalid: ['xyz'] });

  const repetida = await request(app).post(`/api/courses/${id}/roster`).set(auth(token)).send({ text: a });
  assert.deepEqual(repetida.body, { added: 0, alreadyListed: 1, invalid: [] });

  const lista = await request(app).get(`/api/courses/${id}/roster`).set(auth(token));
  const porCedula = Object.fromEntries(lista.body.roster.map((r) => [r.cedula, r]));
  assert.equal(porCedula[a].fullName, 'Ana Pérez');
  assert.equal(porCedula[a].registered, false);
  // El estudiante que ya tenía cuenta queda enlazado al cargarlo.
  assert.equal(porCedula[estudiante.cedula].registered, true);

  const borrar = await request(app).delete(`/api/courses/${id}/roster/${porCedula[a].id}`).set(auth(token));
  assert.equal(borrar.status, 204);
});

test('un docente no puede tocar el curso de otro, ni un estudiante cargar cédulas', async () => {
  const { user: duenio } = await crearUsuario({ role: 'TEACHER' });
  const curso = await crearCurso(duenio.id);
  const { token: otro } = await crearUsuario({ role: 'TEACHER' });
  const { token: estudiante } = await crearUsuario();

  const ajeno = await request(app).post(`/api/courses/${curso.id}/roster`).set(auth(otro)).send({ text: nuevaCedula() });
  assert.equal(ajeno.status, 403);
  const sinRol = await request(app).post(`/api/courses/${curso.id}/roster`).set(auth(estudiante)).send({ text: nuevaCedula() });
  assert.equal(sinRol.status, 403);
  const sinSesion = await request(app).get(`/api/courses/${curso.id}/roster`);
  assert.equal(sinSesion.status, 401);
});

test('validaciones del curso y de la carga', async () => {
  const { user, token } = await crearUsuario({ role: 'TEACHER' });
  const malo = await request(app).post('/api/courses').set(auth(token)).send({ name: 'Curso', period: '2026' });
  assert.equal(malo.status, 400);
  const curso = await crearCurso(user.id);
  const vacio = await request(app).post(`/api/courses/${curso.id}/roster`).set(auth(token)).send({ text: 'nada' });
  assert.equal(vacio.status, 400);
  const noExiste = await request(app).get('/api/courses/999999999/roster').set(auth(token));
  assert.equal(noExiste.status, 404);
});
