import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { rutaArchivo } from '../src/lib/uploads.js';
import { crearUsuario, crearCurso, cleanup } from './helpers.js';

after(cleanup);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Docente con su curso, un estudiante de la lista y otro que no está en la lista.
async function escenario() {
  const docente = await crearUsuario({ role: 'TEACHER' });
  const curso = await crearCurso(docente.user.id);
  const estudiante = await crearUsuario();
  await prisma.rosterEntry.create({ data: { courseId: curso.id, cedula: estudiante.user.cedula, userId: estudiante.user.id } });
  const ajeno = await crearUsuario();
  return { docente, curso, estudiante, ajeno };
}

test('el docente organiza temas y marca la próxima clase; el estudiante del curso los ve', async () => {
  const { docente, curso, estudiante, ajeno } = await escenario();
  const url = `/api/courses/${curso.id}/topics`;

  const a = await request(app).post(url).set(auth(docente.token)).send({ title: 'Algoritmos', tool: 'PSEINT' });
  const b = await request(app).post(url).set(auth(docente.token)).send({ title: 'Diagramas de flujo', tool: 'DFD' });
  assert.equal(a.status, 201);
  assert.equal(b.body.topic.position, a.body.topic.position + 1);

  const noDocente = await request(app).post(url).set(auth(estudiante.token)).send({ title: 'Intruso' });
  assert.equal(noDocente.status, 403);

  // Solo un tema puede ser la próxima clase.
  await request(app).patch(`/api/topics/${a.body.topic.id}`).set(auth(docente.token)).send({ isNextClass: true });
  await request(app).patch(`/api/topics/${b.body.topic.id}`).set(auth(docente.token)).send({ isNextClass: true });
  await request(app).post(`/api/topics/${b.body.topic.id}/move`).set(auth(docente.token)).send({ direction: 'up' });

  const lista = await request(app).get(url).set(auth(estudiante.token));
  assert.equal(lista.status, 200);
  assert.equal(lista.body.canEdit, false);
  assert.deepEqual(lista.body.topics.map((t) => [t.title, t.isNextClass]), [
    ['Diagramas de flujo', true],
    ['Algoritmos', false],
  ]);

  const fuera = await request(app).get(url).set(auth(ajeno.token));
  assert.equal(fuera.status, 403);
});

test('material por enlace y archivo, con visibilidad del curso o pública', async () => {
  const { docente, curso, estudiante, ajeno } = await escenario();
  const tema = await request(app).post(`/api/courses/${curso.id}/topics`).set(auth(docente.token)).send({ title: 'Ciclos' });

  const video = await request(app).post('/api/materials').set(auth(docente.token)).send({
    title: 'Ciclo Mientras', kind: 'VIDEO', url: 'https://www.youtube.com/watch?v=abc123', courseId: curso.id, topicId: tema.body.topic.id, tool: 'PSEINT',
  });
  assert.equal(video.status, 201);
  assert.equal(video.body.material.visibility, 'COURSE');

  const malEnlace = await request(app).post('/api/materials').set(auth(docente.token)).send({ title: 'Malo', kind: 'LINK', url: 'javascript:alert(1)', courseId: curso.id });
  assert.equal(malEnlace.status, 400);

  // Archivo solo para el curso.
  const privado = await request(app)
    .post('/api/materials')
    .set(auth(docente.token))
    .field('title', 'Guía de ejercicios')
    .field('kind', 'FILE')
    .field('courseId', String(curso.id))
    .attach('file', Buffer.from('Algoritmo hola\n  Escribir "Hola"\nFinAlgoritmo\n'), 'guía 1.psc');
  assert.equal(privado.status, 201);
  assert.equal(privado.body.material.fileName, 'guía 1.psc');
  assert.equal(privado.body.material.filePath, undefined);
  const id = privado.body.material.id;

  const descargaEstudiante = await request(app).get(`/api/materials/${id}/file`).set(auth(estudiante.token));
  assert.equal(descargaEstudiante.status, 200);
  assert.match(descargaEstudiante.text ?? descargaEstudiante.body.toString(), /FinAlgoritmo/);
  assert.equal((await request(app).get(`/api/materials/${id}/file`)).status, 401);
  assert.equal((await request(app).get(`/api/materials/${id}/file`).set(auth(ajeno.token))).status, 403);

  // Al hacerlo público aparece en la biblioteca y lo descarga un visitante.
  await request(app).patch(`/api/materials/${id}`).set(auth(docente.token)).send({ visibility: 'PUBLIC' });
  const biblioteca = await request(app).get('/api/library');
  assert.ok(biblioteca.body.materials.some((m) => m.id === id));
  assert.ok(!biblioteca.body.materials.some((m) => m.id === video.body.material.id));
  assert.equal((await request(app).get(`/api/materials/${id}/file`)).status, 200);

  // El estudiante no puede borrar; el docente sí, y el archivo desaparece del disco.
  const guardado = await prisma.material.findUnique({ where: { id } });
  assert.equal((await request(app).delete(`/api/materials/${id}`).set(auth(estudiante.token))).status, 403);
  assert.equal((await request(app).delete(`/api/materials/${id}`).set(auth(docente.token))).status, 204);
  assert.equal(fs.existsSync(rutaArchivo(guardado.filePath)), false);
});

test('archivos no permitidos se rechazan y no quedan en el disco', async () => {
  const { docente, curso } = await escenario();
  const antes = new Set(fs.readdirSync(rutaArchivo('.')));
  const res = await request(app)
    .post('/api/materials')
    .set(auth(docente.token))
    .field('title', 'Programa')
    .field('kind', 'FILE')
    .field('courseId', String(curso.id))
    .attach('file', Buffer.from('MZ'), 'virus.exe');
  assert.equal(res.status, 400);
  assert.match(res.body.error, /\.exe/);

  // Falla después de guardar (curso ajeno): el archivo se borra.
  const otro = await crearUsuario({ role: 'TEACHER' });
  const ajeno = await request(app)
    .post('/api/materials')
    .set(auth(otro.token))
    .field('title', 'Guía')
    .field('kind', 'FILE')
    .field('courseId', String(curso.id))
    .attach('file', Buffer.from('%PDF-1.4'), 'guia.pdf');
  assert.equal(ajeno.status, 403);
  assert.deepEqual(new Set(fs.readdirSync(rutaArchivo('.'))), antes);
});

test('biblioteca: docentes y administradores suben directo; estudiantes no', async () => {
  const docente = await crearUsuario({ role: 'TEACHER' });
  const estudiante = await crearUsuario();
  const subida = await request(app).post('/api/materials').set(auth(docente.token)).send({
    title: 'Manual de Arduino', kind: 'LINK', url: 'https://docs.arduino.cc/', tool: 'ARDUINO', visibility: 'COURSE',
  });
  assert.equal(subida.status, 201);
  assert.equal(subida.body.material.visibility, 'PUBLIC');
  assert.equal(subida.body.material.courseId, null);

  const filtrada = await request(app).get('/api/library?tool=ARDUINO');
  assert.ok(filtrada.body.materials.every((m) => m.tool === 'ARDUINO'));
  assert.ok(filtrada.body.materials.some((m) => m.id === subida.body.material.id));

  const prohibido = await request(app).post('/api/materials').set(auth(estudiante.token)).send({ title: 'Mío', kind: 'LINK', url: 'https://example.com' });
  assert.equal(prohibido.status, 403);
  await prisma.material.delete({ where: { id: subida.body.material.id } });
});

test('el tipo del archivo sale de su extensión, no del que declaró el navegador', async () => {
  const { docente, curso } = await escenario();
  const subir = (nombre, tipo, contenido) =>
    request(app)
      .post('/api/materials')
      .set(auth(docente.token))
      .field('title', nombre)
      .field('kind', 'FILE')
      .field('courseId', String(curso.id))
      .field('visibility', 'PUBLIC')
      .attach('file', Buffer.from(contenido), { filename: nombre, contentType: tipo });

  const pdf = await subir('guia.pdf', 'text/html', '%PDF-1.4 <script>alert(1)</script>');
  const psc = await subir('ciclo.psc', 'application/octet-stream', 'Algoritmo ciclo\nFinAlgoritmo\n');
  const zip = await subir('proyecto.zip', 'text/html', 'PK');

  const tipo = async (id) => (await request(app).get(`/api/materials/${id}/file`)).headers['content-type'];
  assert.equal(await tipo(pdf.body.material.id), 'application/pdf');
  assert.equal(await tipo(psc.body.material.id), 'text/plain; charset=utf-8');
  assert.equal(await tipo(zip.body.material.id), 'application/octet-stream');
});

test('videos de clase: se suben, se adelantan por rangos y los demás archivos siguen con 20 MB', async () => {
  const { docente, curso, estudiante } = await escenario();
  const subir = (nombre, contenido) =>
    request(app)
      .post('/api/materials')
      .set(auth(docente.token))
      .field('title', nombre)
      .field('kind', 'FILE')
      .field('courseId', String(curso.id))
      .attach('file', contenido, nombre);

  const video = await subir('clase 1.mp4', Buffer.alloc(64 * 1024, 7));
  assert.equal(video.status, 201);
  const url = `/api/materials/${video.body.material.id}/file`;
  const completo = await request(app).get(url).set(auth(estudiante.token));
  assert.equal(completo.headers['content-type'], 'video/mp4');
  assert.equal(completo.headers['accept-ranges'], 'bytes');
  const tramo = await request(app).get(url).set(auth(estudiante.token)).set('Range', 'bytes=1000-1999');
  assert.equal(tramo.status, 206);
  assert.equal(tramo.headers['content-range'], `bytes 1000-1999/${64 * 1024}`);

  // Un documento de más de 20 MB se rechaza aunque los videos puedan pesar más, y no queda en el disco.
  const antes = new Set(fs.readdirSync(rutaArchivo('.')));
  const grande = await subir('apuntes.pdf', Buffer.alloc(21 * 1024 * 1024, 1));
  assert.equal(grande.status, 400);
  assert.match(grande.body.error, /20 MB/);
  assert.deepEqual(new Set(fs.readdirSync(rutaArchivo('.'))), antes);
});

test('enlace firmado: abre el archivo sin cabecera, solo para quien puede verlo y solo ese material', async () => {
  const { docente, curso, estudiante, ajeno } = await escenario();
  const subir = (nombre) =>
    request(app)
      .post('/api/materials')
      .set(auth(docente.token))
      .field('title', nombre)
      .field('kind', 'FILE')
      .field('courseId', String(curso.id))
      .attach('file', Buffer.from('contenido de ' + nombre), nombre);
  const clase = (await subir('clase 2.webm')).body.material;
  const otro = (await subir('notas.txt')).body.material;

  const enlace = await request(app).get(`/api/materials/${clase.id}/enlace`).set(auth(estudiante.token));
  assert.equal(enlace.status, 200);
  const abierto = await request(app).get(enlace.body.url);
  assert.equal(abierto.status, 200);
  assert.equal(abierto.headers['content-type'], 'video/webm');

  assert.equal((await request(app).get(`/api/materials/${clase.id}/enlace`)).status, 401);
  assert.equal((await request(app).get(`/api/materials/${clase.id}/enlace`).set(auth(ajeno.token))).status, 403);

  // La firma de un material no abre otro, una firma inventada no sirve y tampoco sirve como sesión.
  const firma = new URL(enlace.body.url, 'http://x').searchParams.get('firma');
  assert.equal((await request(app).get(`/api/materials/${otro.id}/file?firma=${encodeURIComponent(firma)}`)).status, 401);
  assert.equal((await request(app).get(`/api/materials/${clase.id}/file?firma=inventada`)).status, 401);
  assert.equal((await request(app).get(`/api/materials/${clase.id}/file?firma=${estudiante.token}`)).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set(auth(firma))).status, 401);

  // Si el estudiante sale de la lista del curso, su enlace deja de servir.
  await prisma.rosterEntry.deleteMany({ where: { courseId: curso.id, userId: estudiante.user.id } });
  assert.equal((await request(app).get(enlace.body.url)).status, 403);
});

test('la biblioteca trae el tema de cada material y se puede buscar', async () => {
  const { docente, curso } = await escenario();
  const tema = await request(app).post(`/api/courses/${curso.id}/topics`).set(auth(docente.token)).send({ title: 'Estructura condicional', tool: 'PSEINT' });
  const palabra = `zz${Date.now()}`;
  const conTema = await request(app).post('/api/materials').set(auth(docente.token)).send({
    title: `Guía Si-Entonces ${palabra}`, kind: 'LINK', url: 'https://example.com/si', courseId: curso.id, topicId: tema.body.topic.id, visibility: 'PUBLIC',
  });
  const sinTema = await request(app).post('/api/materials').set(auth(docente.token)).send({
    title: 'Lectura general', description: `Repaso ${palabra}`, kind: 'LINK', url: 'https://example.com/general',
  });

  const busqueda = await request(app).get(`/api/library?q=${palabra}`);
  assert.equal(busqueda.status, 200);
  assert.deepEqual(busqueda.body.materials.map((m) => m.id).sort(), [conTema.body.material.id, sinTema.body.material.id].sort());
  const guia = busqueda.body.materials.find((m) => m.id === conTema.body.material.id);
  assert.equal(guia.topic.title, 'Estructura condicional');
  assert.equal(busqueda.body.materials.find((m) => m.id === sinTema.body.material.id).topic, null);

  // Buscar por el nombre del tema también lo encuentra.
  const porTema = await request(app).get('/api/library?q=estructura condicional');
  assert.ok(porTema.body.materials.some((m) => m.id === conTema.body.material.id));

  const pocos = await request(app).get('/api/library?limit=1');
  assert.equal(pocos.body.materials.length, 1);
  await prisma.material.delete({ where: { id: sinTema.body.material.id } });
});
