import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import JSZip from 'jszip';
import request from 'supertest';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/lib/prisma.js';
import { esperarCola } from '../src/lib/calificador.js';
import { crearUsuario, crearCurso, cleanup } from './helpers.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const dias = (n) => new Date(Date.now() + n * 86400000).toISOString();

// IA de mentira con la misma API que Ollama: responde lo que diga la prueba.
let respuestaIA = {};
let ultimaConsulta = null;
const ia = http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => (cuerpo += c));
  req.on('end', () => {
    ultimaConsulta = JSON.parse(cuerpo);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: { role: 'assistant', content: JSON.stringify(respuestaIA) } }));
  });
});

before(async () => {
  await new Promise((r) => ia.listen(0, r));
  config.ia.proveedor = 'ollama';
  config.ia.ollamaUrl = `http://127.0.0.1:${ia.address().port}`;
});

after(async () => {
  ia.close();
  await cleanup();
});

async function escenario() {
  const docente = await crearUsuario({ role: 'TEACHER' });
  const curso = await crearCurso(docente.user.id);
  const est = async () => {
    const e = await crearUsuario();
    await prisma.rosterEntry.create({ data: { courseId: curso.id, cedula: e.user.cedula, userId: e.user.id } });
    return e;
  };
  return { docente, curso, ana: await est(), beto: await est(), ajeno: await crearUsuario() };
}

const crear = (docente, curso, datos) =>
  request(app)
    .post(`/api/courses/${curso.id}/activities`)
    .set(auth(docente.token))
    .send({ type: 'TASK', title: 'Actividad', submissionType: 'TEXT', opensAt: dias(-1), closesAt: dias(3), ...datos });

const PAR_IMPAR = `Algoritmo ParImpar
  Leer n
  Si n MOD 2 = 0 Entonces
    Escribir "Es par"
  SiNo
    Escribir "Es impar"
  FinSi
FinAlgoritmo`;

test('PSeInt: se califica con los casos de prueba al entregar', async () => {
  const { docente, curso, ana, ajeno } = await escenario();
  const creada = await crear(docente, curso, {
    title: 'Par o impar',
    submissionType: 'PSEINT',
    instructions: 'Lea un número y diga si es par.',
    expectedAnswer: 'secreto del docente',
    testCases: [
      { input: '4', expectedOutput: 'Es par' },
      { input: '7', expectedOutput: 'Es impar' },
      { input: '0', expectedOutput: 'Es par' },
      { input: '9', expectedOutput: 'Es impar' },
    ],
  });
  assert.equal(creada.status, 201);
  const id = creada.body.activity.id;
  assert.equal(creada.body.activity.testCases.length, 4);

  // El estudiante no ve la respuesta esperada ni los casos; alguien de otro curso no ve nada.
  const vista = await request(app).get(`/api/activities/${id}`).set(auth(ana.token));
  assert.equal(vista.body.activity.expectedAnswer, undefined);
  assert.equal(vista.body.activity.testCases, undefined);
  assert.equal(vista.body.puedeEntregar, true);
  assert.equal((await request(app).get(`/api/activities/${id}`).set(auth(ajeno.token))).status, 403);

  // Un algoritmo que solo acierta los pares saca la mitad.
  const casi = PAR_IMPAR.replace('Escribir "Es impar"', 'Escribir "Es par"');
  const entrega = await request(app).post(`/api/activities/${id}/submissions`).set(auth(ana.token)).send({ textAnswer: casi });
  assert.equal(entrega.status, 201);
  assert.equal(entrega.body.submission.status, 'GRADED');
  assert.equal(entrega.body.submission.finalGrade, 2.5);
  assert.deepEqual(entrega.body.submission.gradingDetails.resultados.map((r) => r.ok), [true, false, true, false]);

  // Un solo intento: el segundo se rechaza.
  const otra = await request(app).post(`/api/activities/${id}/submissions`).set(auth(ana.token)).send({ textAnswer: PAR_IMPAR });
  assert.equal(otra.status, 403);
  assert.match(otra.body.error, /intentos/);

  // El docente le da un intento extra y la mejor nota es la que cuenta.
  const prorroga = await request(app).post(`/api/activities/${id}/extensions`).set(auth(docente.token)).send({ studentIds: [ana.user.id], extraAttempts: 1 });
  assert.equal(prorroga.status, 201);
  const segunda = await request(app).post(`/api/activities/${id}/submissions`).set(auth(ana.token)).send({ textAnswer: PAR_IMPAR });
  assert.equal(segunda.body.submission.finalGrade, 5);
  const lista = await request(app).get(`/api/courses/${curso.id}/activities`).set(auth(ana.token));
  assert.equal(lista.body.activities.find((a) => a.id === id).nota, 5);

  // El docente no entrega, y un algoritmo que no se puede leer queda en revisión.
  assert.equal((await request(app).post(`/api/activities/${id}/submissions`).set(auth(docente.token)).send({ textAnswer: PAR_IMPAR })).status, 403);
  const { beto } = await escenarioConEstudiante(curso);
  const roto = await request(app).post(`/api/activities/${id}/submissions`).set(auth(beto.token)).send({ textAnswer: 'Algoritmo x\n  Si n > 0 Entonces\nFinAlgoritmo' });
  assert.equal(roto.body.submission.status, 'IN_REVIEW');
  assert.equal(roto.body.submission.finalGrade, null);
  assert.match(roto.body.submission.gradingNotes, /no pudo leer/);
});

async function escenarioConEstudiante(curso) {
  const beto = await crearUsuario();
  await prisma.rosterEntry.create({ data: { courseId: curso.id, cedula: beto.user.cedula, userId: beto.user.id } });
  return { beto };
}

test('plazos: no se entrega antes de abrir ni después de cerrar, salvo prórroga', async () => {
  const { docente, curso, ana, beto } = await escenario();
  const futura = (await crear(docente, curso, { title: 'Futura', opensAt: dias(1), closesAt: dias(2) })).body.activity;
  const cerrada = (await crear(docente, curso, { title: 'Cerrada', opensAt: dias(-3), closesAt: dias(-1), expectedAnswer: 'Algoritmo' })).body.activity;

  const lista = await request(app).get(`/api/courses/${curso.id}/activities`).set(auth(ana.token));
  assert.ok(!lista.body.activities.some((a) => a.id === futura.id));
  assert.equal(lista.body.activities.find((a) => a.id === cerrada.id).estado, 'VENCIDA');
  assert.equal((await request(app).get(`/api/activities/${futura.id}`).set(auth(ana.token))).status, 403);

  const tarde = await request(app).post(`/api/activities/${cerrada.id}/submissions`).set(auth(ana.token)).send({ textAnswer: 'algoritmo' });
  assert.equal(tarde.status, 403);
  assert.match(tarde.body.error, /cerró/);

  // Prórroga para todo el curso: ambos pueden entregar; la respuesta igual a la esperada saca 5,0.
  assert.equal((await request(app).post(`/api/activities/${cerrada.id}/extensions`).set(auth(docente.token)).send({ newClosesAt: dias(-2) })).status, 400);
  assert.equal((await request(app).post(`/api/activities/${cerrada.id}/extensions`).set(auth(ana.token)).send({ newClosesAt: dias(2) })).status, 403);
  assert.equal((await request(app).post(`/api/activities/${cerrada.id}/extensions`).set(auth(docente.token)).send({ newClosesAt: dias(2) })).status, 201);
  const a = await request(app).post(`/api/activities/${cerrada.id}/submissions`).set(auth(ana.token)).send({ textAnswer: '  ALGORITMO ' });
  assert.equal(a.body.submission.finalGrade, 5);
  assert.equal((await request(app).post(`/api/activities/${cerrada.id}/submissions`).set(auth(beto.token)).send({ textAnswer: 'otra cosa' })).status, 201);
});

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

test('fotos: la IA califica; con poca confianza o sin IA queda en revisión y el docente decide', async () => {
  const { docente, curso, ana, beto } = await escenario();
  const act = (await crear(docente, curso, {
    title: 'Diagrama del mayor de dos números',
    submissionType: 'PHOTO',
    expectedAnswer: 'Lee A y B; si A > B muestra A, si no muestra B.',
  })).body.activity;
  const subir = (est) => request(app).post(`/api/activities/${act.id}/submissions`).set(auth(est.token)).attach('file', PNG, 'foto.png');

  assert.equal((await request(app).post(`/api/activities/${act.id}/submissions`).set(auth(ana.token)).send({ textAnswer: 'sin foto' })).status, 400);

  respuestaIA = { legible: true, transcripcion: 'Leer A, B. Si A > B...', nota: 4.5, confianza: 0.9, comentario: 'Bien resuelto.' };
  const buena = await subir(ana);
  assert.equal(buena.status, 201);
  await esperarCola();
  assert.ok(ultimaConsulta.messages[0].images[0].length > 0);
  assert.match(ultimaConsulta.messages[0].content, /mayor de dos números/);
  let vista = await request(app).get(`/api/activities/${act.id}`).set(auth(ana.token));
  assert.equal(vista.body.submissions[0].status, 'GRADED');
  assert.equal(vista.body.submissions[0].finalGrade, 4.5);
  assert.match(vista.body.submissions[0].gradingNotes, /Bien resuelto/);

  respuestaIA = { legible: true, transcripcion: '???', nota: 2, confianza: 0.3, comentario: 'No se distingue bien.' };
  await subir(beto);
  await esperarCola();
  vista = await request(app).get(`/api/activities/${act.id}`).set(auth(beto.token));
  assert.equal(vista.body.submissions[0].status, 'IN_REVIEW');
  assert.equal(vista.body.submissions[0].finalGrade, null);
  assert.equal(vista.body.submissions[0].autoGrade, undefined);

  // El docente la ve en su bandeja con la nota propuesta, la ajusta y deja un comentario.
  const bandeja = await request(app).get(`/api/courses/${curso.id}/review`).set(auth(docente.token));
  const pendiente = bandeja.body.submissions.find((s) => s.studentId === beto.user.id);
  assert.equal(pendiente.autoGrade, 2);
  assert.equal((await request(app).get(`/api/courses/${curso.id}/review`).set(auth(beto.token))).status, 403);
  const foto = await request(app).get(`/api/submissions/${pendiente.id}/file`).set(auth(docente.token));
  assert.equal(foto.headers['content-type'], 'image/png');
  assert.equal((await request(app).get(`/api/submissions/${pendiente.id}/file`).set(auth(ana.token))).status, 403);
  assert.equal((await request(app).patch(`/api/submissions/${pendiente.id}`).set(auth(beto.token)).send({ finalGrade: 5 })).status, 403);
  assert.equal((await request(app).patch(`/api/submissions/${pendiente.id}`).set(auth(docente.token)).send({ finalGrade: 6 })).status, 400);
  const ajustada = await request(app).patch(`/api/submissions/${pendiente.id}`).set(auth(docente.token)).send({ finalGrade: '3,5', teacherComment: 'Faltó la flecha final.' });
  assert.equal(ajustada.body.submission.status, 'GRADED');
  assert.equal(ajustada.body.submission.finalGrade, 3.5);

  // Sin IA configurada, la foto queda en revisión.
  config.ia.proveedor = null;
  const otra = await escenarioConEstudiante(curso);
  await subir(otra.beto);
  await esperarCola();
  const sinIA = await request(app).get(`/api/activities/${act.id}`).set(auth(otra.beto.token));
  assert.equal(sinIA.body.submissions[0].status, 'IN_REVIEW');
  assert.match(sinIA.body.submissions[0].gradingNotes, /No hay IA/);
  config.ia.proveedor = 'ollama';
});

test('foto de un algoritmo: la IA lo transcribe y se corre con los casos de prueba', async () => {
  const { docente, curso, ana } = await escenario();
  const act = (await crear(docente, curso, {
    title: 'Par o impar a mano',
    submissionType: 'PHOTO',
    testCases: [{ input: '2', expectedOutput: 'Es par' }, { input: '3', expectedOutput: 'Es impar' }],
  })).body.activity;
  respuestaIA = { legible: true, codigo: PAR_IMPAR, confianza: 0.95 };
  await request(app).post(`/api/activities/${act.id}/submissions`).set(auth(ana.token)).attach('file', PNG, 'algoritmo.jpg');
  await esperarCola();
  const vista = await request(app).get(`/api/activities/${act.id}`).set(auth(ana.token));
  assert.equal(vista.body.submissions[0].status, 'GRADED');
  assert.equal(vista.body.submissions[0].finalGrade, 5);
  assert.match(ultimaConsulta.messages[0].content, /Transcríbelo exactamente/);
});

test('Scratch: revisa los bloques que pidió el docente y propone la nota', async () => {
  const { docente, curso, ana } = await escenario();
  const checks = await request(app).get('/api/activities/scratch-checks').set(auth(docente.token));
  assert.ok(checks.body.checks.some((c) => c.clave === 'bucle'));
  const act = (await crear(docente, curso, { title: 'Juego del gato', submissionType: 'FILE', scratchChecks: ['bandera', 'bucle', 'condicional', 'inventado'] })).body.activity;
  assert.deepEqual(act.scratchChecks, ['bandera', 'bucle', 'condicional']);

  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({
    targets: [{ blocks: {
      a: { opcode: 'event_whenflagclicked' },
      b: { opcode: 'control_forever' },
      c: { opcode: 'motion_movesteps' },
      d: { opcode: 'math_number', shadow: true },
    } }],
  }));
  const sb3 = await zip.generateAsync({ type: 'nodebuffer' });
  await request(app).post(`/api/activities/${act.id}/submissions`).set(auth(ana.token)).attach('file', sb3, 'gato.sb3');
  await esperarCola();
  const detalle = await request(app).get(`/api/activities/${act.id}`).set(auth(docente.token));
  const s = detalle.body.students.find((x) => x.userId === ana.user.id).submissions[0];
  assert.equal(s.status, 'IN_REVIEW');
  assert.equal(s.autoGrade, 3.3);
  assert.deepEqual(s.gradingDetails.revisiones.map((r) => r.ok), [true, true, false]);
});

test('planilla de notas: mejor nota, no entregó cuenta 0 y la definitiva ponderada; se exporta a Excel', async () => {
  const { docente, curso, ana, beto } = await escenario();
  const t1 = (await crear(docente, curso, { title: 'Taller 1', type: 'WORKSHOP', expectedAnswer: 'si', weight: 40 })).body.activity;
  const t2 = (await crear(docente, curso, { title: 'Parcial', type: 'EVALUATION', expectedAnswer: 'no', weight: 60 })).body.activity;
  await request(app).post(`/api/activities/${t1.id}/submissions`).set(auth(ana.token)).send({ textAnswer: 'si' });
  await request(app).post(`/api/activities/${t2.id}/submissions`).set(auth(ana.token)).send({ textAnswer: 'no' });
  await request(app).post(`/api/activities/${t1.id}/submissions`).set(auth(beto.token)).send({ textAnswer: 'si' });
  // El parcial cierra sin entrega de Beto.
  await prisma.activity.update({ where: { id: t2.id }, data: { opensAt: new Date(Date.now() - 3 * 86400000), closesAt: new Date(Date.now() - 1000) } });

  const planilla = await request(app).get(`/api/courses/${curso.id}/gradebook`).set(auth(docente.token));
  assert.equal(planilla.status, 200);
  const fila = (est) => planilla.body.estudiantes.find((e) => e.cedula === est.user.cedula);
  assert.equal(fila(ana).definitiva, 5);
  assert.equal(fila(beto).notas[`a${t2.id}`].estado, 'no_entrego');
  assert.equal(fila(beto).definitiva, 2); // 5 × 40 % + 0 × 60 %
  assert.equal((await request(app).get(`/api/courses/${curso.id}/gradebook`).set(auth(ana.token))).status, 403);

  const excel = await request(app).get(`/api/courses/${curso.id}/gradebook.xlsx`).set(auth(docente.token)).buffer(true).parse((res, cb) => {
    const partes = [];
    res.on('data', (c) => partes.push(c));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });
  assert.match(excel.headers['content-type'], /spreadsheetml/);
  const hoja = await (await JSZip.loadAsync(excel.body)).file('xl/worksheets/sheet1.xml').async('string');
  assert.match(hoja, /Taller: Taller 1 \(40 %\)/);
  assert.match(hoja, new RegExp(ana.user.fullName));
});

test('planilla de notas: los quizzes con nota se reparten el porcentaje que falta; los de repaso y borradores no cuentan', async () => {
  const { docente, curso, ana } = await escenario();
  const taller = (await crear(docente, curso, { title: 'Taller 1', type: 'WORKSHOP', expectedAnswer: 'si', weight: 40 })).body.activity;
  await request(app).post(`/api/activities/${taller.id}/submissions`).set(auth(ana.token)).send({ textAnswer: 'si' });
  const ayer = new Date(Date.now() - 86400000);
  const quiz = (datos) => prisma.quiz.create({
    data: { courseId: curso.id, timeLimitMinutes: 10, opensAt: new Date(Date.now() - 3 * 86400000), closesAt: ayer, published: true, ...datos },
  });
  const q1 = await quiz({ title: 'Quiz 1' });
  const q2 = await quiz({ title: 'Quiz 2' });
  const repaso = await quiz({ title: 'Repaso', isPractice: true });
  await quiz({ title: 'Borrador', published: false });
  const intento = (quizId, grade, attemptNumber = 1) => prisma.quizAttempt.create({
    data: { quizId, studentId: ana.user.id, attemptNumber, startedAt: ayer, deadline: ayer, submittedAt: ayer, grade },
  });
  await intento(q1.id, 3.5);
  await intento(q1.id, 4, 2);
  await intento(repaso.id, 1);

  const planilla = await request(app).get(`/api/courses/${curso.id}/gradebook`).set(auth(docente.token));
  assert.equal(planilla.status, 200);
  const columnas = planilla.body.actividades;
  assert.deepEqual(columnas.map((c) => c.title).sort(), ['Quiz 1', 'Quiz 2', 'Taller 1']);
  assert.deepEqual(Object.fromEntries(columnas.map((c) => [c.title, c.peso])), { 'Taller 1': 40, 'Quiz 1': 30, 'Quiz 2': 30 });
  const fila = planilla.body.estudiantes.find((e) => e.cedula === ana.user.cedula);
  assert.equal(fila.notas[`q${q1.id}`].nota, 4); // el mejor intento
  assert.equal(fila.notas[`q${q2.id}`].estado, 'no_entrego');
  assert.equal(fila.definitiva, 3.2); // 5 × 40 % + 4 × 30 % + 0 × 30 %
});

test('editor de PSeInt: ejecuta con la entrada que escriba el estudiante', async () => {
  const { ana } = await escenario();
  const r = await request(app).post('/api/pseint/run').set(auth(ana.token)).send({ codigo: PAR_IMPAR, entrada: '8' });
  assert.equal(r.status, 200);
  assert.equal(r.body.salida, 'Es par');
  assert.equal((await request(app).post('/api/pseint/run').send({ codigo: PAR_IMPAR })).status, 401);
});
