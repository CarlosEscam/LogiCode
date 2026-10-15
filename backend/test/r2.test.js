import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';

// Archivos en Cloudflare R2: un R2 de mentira (misma API de S3, guarda en memoria) y una IA
// de mentira con la API de Ollama. Las variables se ponen antes de cargar la app, porque
// lib/almacen.js decide al arrancar si usa R2 o la carpeta local.
const objetos = new Map();
const pedidas = [];
const r2 = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://r2');
  pedidas.push({ metodo: req.method, ruta: url.pathname });
  // Toda petición debe ir firmada, por cabecera (la API) o en la dirección (el navegador).
  if (!req.headers.authorization && !url.searchParams.has('X-Amz-Signature')) {
    res.statusCode = 403;
    return res.end('sin firma');
  }
  const partes = [];
  req.on('data', (c) => partes.push(c));
  req.on('end', () => {
    const obj = objetos.get(url.pathname);
    if (req.method === 'PUT') {
      objetos.set(url.pathname, { datos: Buffer.concat(partes), tipo: req.headers['content-type'] });
      return res.end();
    }
    if (req.method === 'DELETE') {
      objetos.delete(url.pathname);
      res.statusCode = 204;
      return res.end();
    }
    if (!obj) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader('Content-Length', obj.datos.length);
    res.setHeader('Content-Type', url.searchParams.get('response-content-type') ?? obj.tipo ?? 'application/octet-stream');
    if (url.searchParams.has('response-content-disposition')) res.setHeader('Content-Disposition', url.searchParams.get('response-content-disposition'));
    res.end(req.method === 'HEAD' ? undefined : obj.datos);
  });
});

let ultimaConsultaIA = null;
const ia = http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => (cuerpo += c));
  req.on('end', () => {
    ultimaConsultaIA = JSON.parse(cuerpo);
    const respuesta = { legible: true, transcripcion: 'Leer A, B', nota: 4, confianza: 0.95, comentario: 'Bien.' };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: { role: 'assistant', content: JSON.stringify(respuesta) } }));
  });
});

let app, prisma, config, esperarCola, helpers;

before(async () => {
  await new Promise((r) => r2.listen(0, r));
  await new Promise((r) => ia.listen(0, r));
  Object.assign(process.env, {
    R2_ACCESS_KEY_ID: 'clave-de-prueba',
    R2_SECRET_ACCESS_KEY: 'secreto-de-prueba',
    R2_BUCKET: 'logicode',
    R2_ENDPOINT: `http://127.0.0.1:${r2.address().port}`,
  });
  ({ app } = await import('../src/app.js'));
  ({ prisma } = await import('../src/lib/prisma.js'));
  ({ config } = await import('../src/config.js'));
  ({ esperarCola } = await import('../src/lib/calificador.js'));
  helpers = await import('./helpers.js');
  config.ia.proveedor = 'ollama';
  config.ia.ollamaUrl = `http://127.0.0.1:${ia.address().port}`;
});

after(async () => {
  r2.close();
  ia.close();
  await helpers.cleanup();
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const dias = (n) => new Date(Date.now() + n * 86400000).toISOString();
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

// Lo que hace la web: pide el enlace, sube directo a R2 y devuelve el comprobante.
async function subirDirecto(token, destino, nombre, datos, tamano = datos.length) {
  const prep = await request(app).post('/api/archivos/subida').set(auth(token)).send({ destino, nombre, tamano });
  assert.equal(prep.status, 200, prep.body.error);
  assert.equal(prep.body.directo, true);
  const put = await fetch(prep.body.url, { method: 'PUT', headers: prep.body.headers, body: datos });
  assert.equal(put.status, 200);
  return prep.body.subida;
}

test('material: el video sube directo a R2 y se ve con un enlace firmado de R2', async () => {
  const docente = await helpers.crearUsuario({ role: 'TEACHER' });
  const estudiante = await helpers.crearUsuario();
  const curso = await helpers.crearCurso(docente.user.id);

  // Un estudiante no sube material; los límites se revisan antes de dar el enlace.
  const ajena = await request(app).post('/api/archivos/subida').set(auth(estudiante.token)).send({ destino: 'material', nombre: 'a.pdf', tamano: 10 });
  assert.equal(ajena.status, 403);
  const enorme = await request(app).post('/api/archivos/subida').set(auth(docente.token)).send({ destino: 'material', nombre: 'clase.mp4', tamano: 2 * 1024 ** 3 });
  assert.match(enorme.body.error, /1 GB/);
  const exe = await request(app).post('/api/archivos/subida').set(auth(docente.token)).send({ destino: 'material', nombre: 'virus.exe', tamano: 10 });
  assert.match(exe.body.error, /\.exe/);

  const video = Buffer.alloc(6 * 1024 * 1024, 7); // más de lo que Vercel deja pasar por la API
  const subida = await subirDirecto(docente.token, 'material', 'Clase 1 – ciclos.mp4', video);
  // El comprobante es de quien lo pidió.
  const robada = await request(app).post('/api/materials').set(auth(estudiante.token)).field('title', 'x').field('kind', 'FILE').field('subida', subida);
  assert.equal(robada.status, 400);

  const creado = await request(app)
    .post('/api/materials')
    .set(auth(docente.token))
    .field('title', 'Clase 1')
    .field('kind', 'FILE')
    .field('courseId', String(curso.id))
    .field('subida', subida);
  assert.equal(creado.status, 201, creado.body.error);
  assert.equal(creado.body.material.fileName, 'Clase 1 – ciclos.mp4');
  assert.equal(creado.body.material.fileSize, video.length);
  const guardado = await prisma.material.findUnique({ where: { id: creado.body.material.id } });
  assert.equal(objetos.get(`/logicode/${guardado.filePath}`).datos.length, video.length);

  // Con la sesión, la API responde el enlace de R2; con el enlace firmado, redirige a R2.
  const conSesion = await request(app).get(`/api/materials/${guardado.id}/file`).set(auth(docente.token));
  assert.equal(conSesion.status, 200);
  const desdeR2 = await fetch(conSesion.body.url);
  assert.equal(desdeR2.headers.get('content-type'), 'video/mp4');
  assert.match(desdeR2.headers.get('content-disposition'), /filename\*=UTF-8''Clase%201%20%E2%80%93%20ciclos\.mp4/);
  assert.equal((await desdeR2.arrayBuffer()).byteLength, video.length);

  const enlace = await request(app).get(`/api/materials/${guardado.id}/enlace`).set(auth(docente.token));
  const redir = await request(app).get(enlace.body.url);
  assert.equal(redir.status, 302);
  assert.ok(redir.headers.location.startsWith(process.env.R2_ENDPOINT));

  // Al borrar el material, el archivo sale de R2.
  assert.equal((await request(app).delete(`/api/materials/${guardado.id}`).set(auth(docente.token))).status, 204);
  assert.equal(objetos.has(`/logicode/${guardado.filePath}`), false);
});

test('un archivo que llega a R2 más grande de lo anunciado se rechaza y se borra', async () => {
  const docente = await helpers.crearUsuario({ role: 'TEACHER' });
  const antes = objetos.size;
  const subida = await subirDirecto(docente.token, 'material', 'guia.pdf', Buffer.alloc(21 * 1024 * 1024), 1000);
  assert.equal(objetos.size, antes + 1);
  const res = await request(app).post('/api/materials').set(auth(docente.token)).field('title', 'Guía').field('kind', 'FILE').field('subida', subida);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /20 MB/);
  assert.equal(objetos.size, antes);
});

test('entregas: la IA califica la foto leyéndola de R2, y el .psc subido se lee de R2', async () => {
  const docente = await helpers.crearUsuario({ role: 'TEACHER' });
  const curso = await helpers.crearCurso(docente.user.id);
  const ana = await helpers.crearUsuario();
  await prisma.rosterEntry.create({ data: { courseId: curso.id, cedula: ana.user.cedula, userId: ana.user.id } });
  const crear = (datos) =>
    request(app)
      .post(`/api/courses/${curso.id}/activities`)
      .set(auth(docente.token))
      .send({ type: 'TASK', title: 'Actividad', opensAt: dias(-1), closesAt: dias(3), ...datos });

  const foto = (await crear({ title: 'Mayor de dos', submissionType: 'PHOTO', expectedAnswer: 'Si A > B muestra A' })).body.activity;
  const subida = await subirDirecto(ana.token, 'entrega', 'foto.png', PNG);
  const entrega = await request(app).post(`/api/activities/${foto.id}/submissions`).set(auth(ana.token)).field('subida', subida);
  assert.equal(entrega.status, 201, entrega.body.error);
  await esperarCola();
  assert.equal(ultimaConsultaIA.messages[0].images[0], PNG.toString('base64'));
  const vista = await request(app).get(`/api/activities/${foto.id}`).set(auth(ana.token));
  assert.equal(vista.body.submissions[0].finalGrade, 4);
  const archivo = await request(app).get(`/api/submissions/${entrega.body.submission.id}/file`).set(auth(docente.token));
  assert.equal(Buffer.from(await (await fetch(archivo.body.url)).arrayBuffer()).equals(PNG), true);

  // Por la API (multipart) también llega a R2: así sube la web las fotos pequeñas sin R2 directo.
  const psc = (await crear({
    title: 'Saludo',
    submissionType: 'PSEINT',
    testCases: [{ input: '', expectedOutput: 'Hola' }],
  })).body.activity;
  const antes = objetos.size;
  const res = await request(app)
    .post(`/api/activities/${psc.id}/submissions`)
    .set(auth(ana.token))
    .attach('file', Buffer.from('Algoritmo Saludo\n  Escribir "Hola"\nFinAlgoritmo\n'), 'saludo.psc');
  assert.equal(res.status, 201, res.body.error);
  assert.equal(res.body.submission.finalGrade, 5);
  // El .psc queda como texto en la entrega y su archivo se borra de R2.
  assert.equal(objetos.size, antes);
});

test('foto de perfil: se guarda en R2 y la dirección de la foto redirige a R2', async () => {
  const { token, user } = await helpers.crearUsuario();
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
  const res = await request(app).put('/api/me/avatar').set(auth(token)).attach('avatar', jpg, 'foto.jpg');
  assert.equal(res.status, 200, res.body.error);
  const { avatarPath } = await prisma.user.findUnique({ where: { id: user.id } });
  assert.ok(objetos.get(`/logicode/${avatarPath}`).datos.equals(jpg));
  const ver = await request(app).get(res.body.user.avatarUrl);
  assert.equal(ver.status, 302);
  const desdeR2 = await fetch(ver.headers.location);
  assert.equal(desdeR2.headers.get('content-type'), 'image/jpeg');
  assert.match(desdeR2.headers.get('content-disposition'), /^inline/);
});
