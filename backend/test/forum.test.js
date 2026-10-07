import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { crearUsuario, cleanup } from './helpers.js';

after(cleanup);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function crearTema(token, datos = {}) {
  const res = await request(app)
    .post('/api/forum/threads')
    .set(auth(token))
    .send({ category: 'PSEINT', title: 'Duda con el ciclo Mientras', body: '¿Cuándo termina el ciclo?', ...datos });
  assert.equal(res.status, 201);
  return res.body.thread;
}

test('un visitante lee el foro pero no escribe', async () => {
  const estudiante = await crearUsuario();
  const tema = await crearTema(estudiante.token);

  const lista = await request(app).get('/api/forum/threads?category=PSEINT');
  assert.equal(lista.status, 200);
  assert.ok(lista.body.threads.some((t) => t.id === tema.id && t.replies === 0 && t.author.fullName));
  assert.equal(lista.body.canModerate, false);

  const detalle = await request(app).get(`/api/forum/threads/${tema.id}`);
  assert.equal(detalle.status, 200);
  assert.equal(detalle.body.posts[0].body, '¿Cuándo termina el ciclo?');
  assert.equal(detalle.body.canReply, false);
  assert.equal(detalle.body.posts[0].author.cedula, undefined);

  const resumen = await request(app).get('/api/forum');
  assert.ok(resumen.body.categories.find((c) => c.category === 'PSEINT').threads >= 1);

  assert.equal((await request(app).post('/api/forum/threads').send({ title: 'Hola a todos', body: 'x' })).status, 401);
  assert.equal((await request(app).post(`/api/forum/threads/${tema.id}/posts`).send({ body: 'x' })).status, 401);
});

test('con sesión se crean temas y respuestas; el autor edita su mensaje', async () => {
  const autor = await crearUsuario();
  const otro = await crearUsuario();
  const tema = await crearTema(autor.token, { category: 'DFD', title: 'Símbolo de decisión' });

  assert.equal((await request(app).post('/api/forum/threads').set(auth(autor.token)).send({ title: 'Hi', body: 'x' })).status, 400);
  assert.equal((await request(app).post('/api/forum/threads').set(auth(autor.token)).send({ title: 'Título válido', body: '   ' })).status, 400);
  assert.equal((await request(app).post('/api/forum/threads').set(auth(autor.token)).send({ category: 'COBOL', title: 'Título válido', body: 'x' })).status, 400);

  const respuesta = await request(app).post(`/api/forum/threads/${tema.id}/posts`).set(auth(otro.token)).send({ body: 'Es el rombo.' });
  assert.equal(respuesta.status, 201);
  const postId = respuesta.body.post.id;

  assert.equal((await request(app).patch(`/api/forum/posts/${postId}`).set(auth(autor.token)).send({ body: 'Cambio ajeno' })).status, 403);
  const editado = await request(app).patch(`/api/forum/posts/${postId}`).set(auth(otro.token)).send({ body: 'Es el rombo (decisión).' });
  assert.equal(editado.status, 200);
  assert.ok(editado.body.post.editedAt);

  const busqueda = await request(app).get('/api/forum/threads?q=rombo');
  assert.ok(busqueda.body.threads.some((t) => t.id === tema.id && t.replies === 1));

  // Con respuestas ajenas, el autor ya no puede borrar el tema, pero sí cambiar su título.
  assert.equal((await request(app).delete(`/api/forum/threads/${tema.id}`).set(auth(autor.token))).status, 403);
  assert.equal((await request(app).patch(`/api/forum/threads/${tema.id}`).set(auth(autor.token)).send({ title: 'Símbolo de decisión en DFD' })).status, 200);
  assert.equal((await request(app).patch(`/api/forum/threads/${tema.id}`).set(auth(otro.token)).send({ title: 'Mío ahora' })).status, 403);
  assert.equal((await request(app).patch(`/api/forum/threads/${tema.id}`).set(auth(autor.token)).send({ isPinned: true })).status, 403);

  // Sin respuestas ajenas, el autor sí lo borra.
  const solo = await crearTema(autor.token, { title: 'Tema que me arrepentí' });
  assert.equal((await request(app).delete(`/api/forum/threads/${solo.id}`).set(auth(autor.token))).status, 204);
});

test('el docente modera: fija, cierra y oculta mensajes', async () => {
  const docente = await crearUsuario({ role: 'TEACHER' });
  const estudiante = await crearUsuario();
  const tema = await crearTema(estudiante.token, { category: 'SCRATCH', title: 'Bloques de movimiento' });
  const ofensivo = await request(app).post(`/api/forum/threads/${tema.id}/posts`).set(auth(estudiante.token)).send({ body: 'Mensaje inapropiado' });

  const fijado = await request(app).patch(`/api/forum/threads/${tema.id}`).set(auth(docente.token)).send({ isPinned: true, isClosed: true });
  assert.equal(fijado.status, 200);
  assert.equal(fijado.body.thread.isPinned, true);

  const lista = await request(app).get('/api/forum/threads?category=SCRATCH');
  assert.equal(lista.body.threads[0].id, tema.id);

  // Cerrado: el estudiante ya no responde; el docente sí.
  assert.equal((await request(app).post(`/api/forum/threads/${tema.id}/posts`).set(auth(estudiante.token)).send({ body: 'Otra' })).status, 403);
  assert.equal((await request(app).post(`/api/forum/threads/${tema.id}/posts`).set(auth(docente.token)).send({ body: 'Tema resuelto.' })).status, 201);

  // Mensaje oculto: el visitante no ve el texto; el docente sí, marcado como eliminado.
  assert.equal((await request(app).delete(`/api/forum/posts/${ofensivo.body.post.id}`).set(auth(docente.token))).status, 204);
  const visitante = await request(app).get(`/api/forum/threads/${tema.id}`);
  const oculto = visitante.body.posts.find((p) => p.id === ofensivo.body.post.id);
  assert.equal(oculto.deleted, true);
  assert.equal(oculto.body, null);
  const moderador = await request(app).get(`/api/forum/threads/${tema.id}`).set(auth(docente.token));
  assert.equal(moderador.body.posts.find((p) => p.id === ofensivo.body.post.id).body, 'Mensaje inapropiado');
  assert.equal(moderador.body.canModerate, true);

  // Un estudiante no oculta mensajes ajenos; el docente borra el tema completo.
  const delDocente = moderador.body.posts.at(-1).id;
  assert.equal((await request(app).delete(`/api/forum/posts/${delDocente}`).set(auth(estudiante.token))).status, 403);
  assert.equal((await request(app).delete(`/api/forum/threads/${tema.id}`).set(auth(docente.token))).status, 204);
  assert.equal((await request(app).get(`/api/forum/threads/${tema.id}`)).status, 404);
});
