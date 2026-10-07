import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { requireCourse } from '../lib/access.js';
import {
  NO_QUIZ, TIPOS_ACTIVIDAD, casosDePrueba, datosActividad, mejorNota, plazoDe, planillaDelCurso, publicActividad, publicEntrega,
} from '../lib/actividades.js';
import { encolar } from '../lib/calificador.js';
import { crearExcel } from '../lib/excel.js';
import { REVISIONES_SCRATCH } from '../lib/scratch.js';
import { recibirEntrega, rutaArchivo, borrarArchivo, tipoDeArchivo, IMAGENES } from '../lib/uploads.js';
import { ejecutar } from '../lib/pseint/index.js';
import * as v from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

// Actividades, entregas y notas (RF-10 a RF-17, RF-27, RF-28).
export const activitiesRouter = Router();

const NOMBRE_TIPO = { TASK: 'Tarea', WORKSHOP: 'Taller', EVALUATION: 'Evaluación' };

async function actividadDe(req, nivel) {
  const activity = await prisma.activity.findFirst({
    where: { id: v.id(req.params.activityId), ...NO_QUIZ },
    include: { topic: true, testCases: { orderBy: { id: 'asc' } }, extensions: true },
  });
  if (!activity) throw new HttpError(404, 'Actividad no encontrada.');
  const { acceso } = await requireCourse(req.user, activity.courseId, nivel);
  return { activity, acceso };
}

async function temaDelCurso(topicId, courseId) {
  if (topicId === undefined) return undefined;
  if (topicId === null || topicId === '') return null;
  const topic = await prisma.topic.findUnique({ where: { id: v.id(topicId) } });
  if (!topic || topic.courseId !== courseId) throw new HttpError(400, 'El tema no es de este curso.');
  return topic.id;
}

// Espera la calificación unos segundos para responder ya con la nota cuando es rápida
// (PSeInt, texto). La lectura de fotos con IA puede tardar más y sigue en segundo plano.
async function calificarYEsperar(submissionId) {
  await Promise.race([encolar(submissionId), new Promise((r) => setTimeout(r, 3000))]);
  return prisma.submission.findUnique({ where: { id: submissionId } });
}

// --- Actividades del curso -----------------------------------------------------

// GET /api/courses/:id/activities
activitiesRouter.get('/courses/:id/activities', requireAuth, async (req, res) => {
  const { course, acceso } = await requireCourse(req.user, v.id(req.params.id));
  const docente = acceso === 'owner';
  const ahora = new Date();
  const actividades = await prisma.activity.findMany({
    where: { courseId: course.id, ...NO_QUIZ, ...(docente ? {} : { opensAt: { lte: ahora } }) },
    orderBy: [{ closesAt: 'asc' }, { id: 'asc' }],
    include: {
      topic: true,
      _count: { select: { testCases: true } },
      extensions: true,
      submissions: docente
        ? { select: { studentId: true, status: true } }
        : { where: { studentId: req.user.id }, orderBy: { attemptNumber: 'asc' } },
    },
  });

  res.json({
    canEdit: docente,
    activities: actividades.map((a) => {
      const base = publicActividad(a, { paraDocente: false });
      if (docente) {
        return {
          ...base,
          entregas: new Set(a.submissions.map((s) => s.studentId)).size,
          porRevisar: a.submissions.filter((s) => s.status === 'IN_REVIEW').length,
        };
      }
      const { cierre, intentos } = plazoDe(a, a.extensions, req.user.id);
      const ultima = a.submissions.at(-1);
      return {
        ...base,
        closesAt: cierre,
        intentosRestantes: Math.max(0, intentos - a.submissions.length),
        estado: ultima ? ultima.status : cierre < ahora ? 'VENCIDA' : 'PENDIENTE',
        nota: mejorNota(a.submissions),
      };
    }),
  });
});

// POST /api/courses/:id/activities
activitiesRouter.post('/courses/:id/activities', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  const data = datosActividad(req.body);
  if (data.closesAt <= data.opensAt) throw new HttpError(400, 'El cierre debe ser después de la apertura.');
  const testCases = casosDePrueba(req.body.testCases) ?? [];
  const topicId = await temaDelCurso(req.body.topicId, course.id);
  const activity = await prisma.activity.create({
    data: { ...data, courseId: course.id, topicId: topicId ?? null, testCases: { create: testCases } },
    include: { topic: true, testCases: true },
  });
  res.status(201).json({ activity: publicActividad(activity, { paraDocente: true }) });
});

// GET /api/activities/pending: lo que el estudiante tiene por entregar en todos sus cursos (RF-15).
activitiesRouter.get('/activities/pending', requireAuth, async (req, res) => {
  const ahora = new Date();
  const actividades = await prisma.activity.findMany({
    where: { ...NO_QUIZ, opensAt: { lte: ahora }, course: { roster: { some: { userId: req.user.id } } } },
    include: { course: { select: { id: true, name: true } }, extensions: true, submissions: { where: { studentId: req.user.id }, select: { id: true } } },
    orderBy: { closesAt: 'asc' },
  });
  const pendientes = actividades
    .map((a) => ({ a, plazo: plazoDe(a, a.extensions, req.user.id) }))
    .filter(({ a, plazo }) => a.submissions.length === 0 && plazo.cierre >= ahora)
    .map(({ a, plazo }) => ({ id: a.id, title: a.title, type: a.type, closesAt: plazo.cierre, course: a.course }));
  res.json({ activities: pendientes });
});

// GET /api/activities/scratch-checks: lo que el docente puede pedir en un proyecto de Scratch.
activitiesRouter.get('/activities/scratch-checks', requireAuth, (req, res) => {
  res.json({ checks: REVISIONES_SCRATCH.map(({ clave, nombre }) => ({ clave, nombre })) });
});

// GET /api/activities/:activityId
activitiesRouter.get('/activities/:activityId', requireAuth, async (req, res) => {
  const { activity, acceso } = await actividadDe(req);
  if (acceso === 'owner') {
    const [lista, entregas] = await Promise.all([
      prisma.rosterEntry.findMany({ where: { courseId: activity.courseId }, orderBy: { cedula: 'asc' }, include: { user: { select: { id: true, fullName: true } } } }),
      prisma.submission.findMany({
        where: { activityId: activity.id },
        orderBy: [{ studentId: 'asc' }, { attemptNumber: 'asc' }],
        include: { student: { select: { id: true, fullName: true, cedula: true } } },
      }),
    ]);
    const extensiones = activity.extensions.map((e) => ({
      id: e.id,
      studentId: e.studentId,
      student: e.studentId ? lista.find((r) => r.userId === e.studentId)?.user?.fullName ?? null : null,
      newClosesAt: e.newClosesAt,
      extraAttempts: e.extraAttempts,
      createdAt: e.createdAt,
    }));
    return res.json({
      canEdit: true,
      activity: publicActividad(activity, { paraDocente: true }),
      extensions: extensiones,
      students: lista.map((r) => {
        const propias = r.userId ? entregas.filter((s) => s.studentId === r.userId) : [];
        const plazo = plazoDe(activity, activity.extensions, r.userId);
        return {
          userId: r.userId,
          cedula: r.cedula,
          fullName: r.user?.fullName ?? r.fullName,
          closesAt: plazo.cierre,
          intentos: plazo.intentos,
          nota: mejorNota(propias),
          submissions: propias.map((s) => publicEntrega(s, { paraDocente: true })),
        };
      }),
    });
  }

  const ahora = new Date();
  if (activity.opensAt > ahora) throw new HttpError(403, 'Esta actividad todavía no está abierta.');
  const entregas = await prisma.submission.findMany({ where: { activityId: activity.id, studentId: req.user.id }, orderBy: { attemptNumber: 'asc' } });
  const { cierre, intentos } = plazoDe(activity, activity.extensions, req.user.id);
  const restantes = Math.max(0, intentos - entregas.length);
  res.json({
    canEdit: false,
    activity: { ...publicActividad(activity, { paraDocente: false }), closesAt: cierre },
    intentosRestantes: restantes,
    puedeEntregar: cierre >= ahora && restantes > 0,
    nota: mejorNota(entregas),
    submissions: entregas.map((s) => publicEntrega(s, { paraDocente: false })),
  });
});

// PATCH /api/activities/:activityId (los casos de prueba, si llegan, reemplazan a los anteriores)
activitiesRouter.patch('/activities/:activityId', requireAuth, async (req, res) => {
  const { activity } = await actividadDe(req, 'owner');
  const data = datosActividad(req.body, true);
  const opensAt = data.opensAt ?? activity.opensAt;
  const closesAt = data.closesAt ?? activity.closesAt;
  if (closesAt <= opensAt) throw new HttpError(400, 'El cierre debe ser después de la apertura.');
  const testCases = casosDePrueba(req.body.testCases);
  const topicId = await temaDelCurso(req.body.topicId, activity.courseId);
  if (topicId !== undefined) data.topicId = topicId;
  const actualizada = await prisma.$transaction(async (tx) => {
    if (testCases) {
      await tx.testCase.deleteMany({ where: { activityId: activity.id } });
      await tx.testCase.createMany({ data: testCases.map((c) => ({ ...c, activityId: activity.id })) });
    }
    return tx.activity.update({ where: { id: activity.id }, data, include: { topic: true, testCases: { orderBy: { id: 'asc' } } } });
  });
  res.json({ activity: publicActividad(actualizada, { paraDocente: true }) });
});

// DELETE /api/activities/:activityId (borra también las entregas y sus archivos)
activitiesRouter.delete('/activities/:activityId', requireAuth, async (req, res) => {
  const { activity } = await actividadDe(req, 'owner');
  const archivos = await prisma.submission.findMany({ where: { activityId: activity.id, filePath: { not: null } }, select: { filePath: true } });
  await prisma.activity.delete({ where: { id: activity.id } });
  await Promise.all(archivos.map((a) => borrarArchivo(a.filePath)));
  res.status(204).end();
});

// --- Prórrogas e intentos extra (RF-11, RF-27) -----------------------------------

// POST /api/activities/:activityId/extensions { studentIds?: [], newClosesAt?, extraAttempts? }
// Sin studentIds aplica a todo el curso.
activitiesRouter.post('/activities/:activityId/extensions', requireAuth, async (req, res) => {
  const { activity } = await actividadDe(req, 'owner');
  const newClosesAt = req.body.newClosesAt ? new Date(String(req.body.newClosesAt)) : null;
  if (newClosesAt && Number.isNaN(newClosesAt.getTime())) throw new HttpError(400, 'La nueva fecha no es válida.');
  if (newClosesAt && newClosesAt <= activity.closesAt) throw new HttpError(400, 'La nueva fecha debe ser después del cierre actual.');
  const extraAttempts = req.body.extraAttempts ? Number(req.body.extraAttempts) : 0;
  if (!Number.isInteger(extraAttempts) || extraAttempts < 0 || extraAttempts > 5) throw new HttpError(400, 'Los intentos extra deben ser de 0 a 5.');
  if (!newClosesAt && !extraAttempts) throw new HttpError(400, 'Indique una nueva fecha de cierre o intentos extra.');

  const ids = Array.isArray(req.body.studentIds) ? [...new Set(req.body.studentIds.map((x) => v.id(x)))] : [];
  if (ids.length) {
    const enLista = await prisma.rosterEntry.count({ where: { courseId: activity.courseId, userId: { in: ids } } });
    if (enLista !== ids.length) throw new HttpError(400, 'Algún estudiante no está en la lista del curso.');
  }
  const destinos = ids.length ? ids : [null];
  await prisma.activityExtension.createMany({
    data: destinos.map((studentId) => ({ activityId: activity.id, studentId, newClosesAt, extraAttempts })),
  });
  res.status(201).json({ creadas: destinos.length });
});

// DELETE /api/extensions/:extensionId
activitiesRouter.delete('/extensions/:extensionId', requireAuth, async (req, res) => {
  const ext = await prisma.activityExtension.findUnique({ where: { id: v.id(req.params.extensionId) }, include: { activity: true } });
  if (!ext) throw new HttpError(404, 'Prórroga no encontrada.');
  await requireCourse(req.user, ext.activity.courseId, 'owner');
  await prisma.activityExtension.delete({ where: { id: ext.id } });
  res.status(204).end();
});

// --- Entregas (RF-16, RF-17) ------------------------------------------------------

// POST /api/activities/:activityId/submissions (texto o código en textAnswer; archivo o foto en file)
activitiesRouter.post('/activities/:activityId/submissions', requireAuth, recibirEntrega, async (req, res) => {
  let guardada = false;
  try {
    const { activity, acceso } = await actividadDe(req);
    if (acceso !== 'member') throw new HttpError(403, 'Solo los estudiantes del curso entregan actividades.');
    const ahora = new Date();
    if (activity.opensAt > ahora) throw new HttpError(403, 'Esta actividad todavía no está abierta.');
    const { cierre, intentos } = plazoDe(activity, activity.extensions, req.user.id);
    if (cierre < ahora) throw new HttpError(403, 'La actividad ya cerró. Si necesita más tiempo, pídale una prórroga al docente.');
    const hechas = await prisma.submission.count({ where: { activityId: activity.id, studentId: req.user.id } });
    if (hechas >= intentos) throw new HttpError(403, 'Ya usó todos sus intentos en esta actividad.');

    const ext = req.file ? path.extname(req.file.originalname).toLowerCase() : null;
    const textAnswer = req.body.textAnswer === undefined ? null : String(req.body.textAnswer).slice(0, 50000);
    switch (activity.submissionType) {
      case 'TEXT':
        if (!textAnswer?.trim()) throw new HttpError(400, 'Escriba su respuesta.');
        break;
      case 'PSEINT':
        if (req.file && ext !== '.psc') throw new HttpError(400, 'Suba un archivo .psc o escriba el algoritmo en el editor.');
        if (!req.file && !textAnswer?.trim()) throw new HttpError(400, 'Escriba el algoritmo antes de entregar.');
        break;
      case 'PHOTO':
        if (!req.file || !IMAGENES.has(ext)) throw new HttpError(400, 'Tome o suba una foto (JPG, PNG o WEBP).');
        break;
      case 'FILE':
        if (!req.file) throw new HttpError(400, 'Adjunte el archivo.');
        break;
      default:
        throw new HttpError(400, 'Esta actividad no recibe entregas aquí.');
    }

    let codigo = textAnswer;
    if (activity.submissionType === 'PSEINT' && req.file) {
      codigo = (await fs.promises.readFile(req.file.path)).toString('utf8').slice(0, 50000);
    }
    let creada;
    try {
      creada = await prisma.submission.create({
        data: {
          activityId: activity.id,
          studentId: req.user.id,
          attemptNumber: hechas + 1,
          status: 'SUBMITTED',
          submittedAt: ahora,
          textAnswer: activity.submissionType === 'PSEINT' ? codigo : activity.submissionType === 'TEXT' ? textAnswer : null,
          filePath: req.file && activity.submissionType !== 'PSEINT' ? req.file.filename : null,
          fileName: req.file ? req.file.originalname.slice(0, 255) : null,
        },
      });
    } catch (e) {
      if (e.code === 'P2002') throw new HttpError(409, 'Esta entrega ya se registró. Recargue la página.');
      throw e;
    }
    // El .psc ya quedó como texto en la entrega; el archivo no hace falta.
    guardada = activity.submissionType !== 'PSEINT';
    if (!guardada) await borrarArchivo(req.file?.filename);
    const lista = await calificarYEsperar(creada.id);
    res.status(201).json({ submission: publicEntrega(lista, { paraDocente: false }) });
  } catch (err) {
    // Si la entrega no quedó registrada, su archivo no se deja huérfano.
    if (!guardada) await borrarArchivo(req.file?.filename);
    throw err;
  }
});

async function entregaDe(req, nivel) {
  const entrega = await prisma.submission.findUnique({
    where: { id: v.id(req.params.submissionId) },
    include: { activity: true, student: { select: { id: true, fullName: true, cedula: true } } },
  });
  if (!entrega || !TIPOS_ACTIVIDAD.includes(entrega.activity.type)) throw new HttpError(404, 'Entrega no encontrada.');
  const { acceso } = await requireCourse(req.user, entrega.activity.courseId, nivel);
  if (acceso !== 'owner' && entrega.studentId !== req.user.id) throw new HttpError(403, 'Esta entrega no es suya.');
  return { entrega, docente: acceso === 'owner' };
}

// GET /api/submissions/:submissionId/file: el archivo o la foto de la entrega (docente o su autor).
activitiesRouter.get('/submissions/:submissionId/file', requireAuth, async (req, res) => {
  const { entrega } = await entregaDe(req);
  if (!entrega.filePath) throw new HttpError(404, 'Esta entrega no tiene archivo.');
  const ruta = rutaArchivo(entrega.filePath);
  if (!fs.existsSync(ruta)) throw new HttpError(404, 'El archivo ya no está en el servidor.');
  res.download(ruta, entrega.fileName ?? entrega.filePath, {
    headers: { 'Content-Type': tipoDeArchivo(entrega.fileName ?? entrega.filePath), 'X-Content-Type-Options': 'nosniff' },
  });
});

// PATCH /api/submissions/:submissionId { finalGrade, teacherComment }: el docente pone o ajusta la nota (RF-13).
activitiesRouter.patch('/submissions/:submissionId', requireAuth, async (req, res) => {
  const { entrega } = await entregaDe(req, 'owner');
  const maximo = Number(entrega.activity.maxGrade);
  const data = {};
  if (req.body.finalGrade !== undefined) {
    const nota = Number(String(req.body.finalGrade).replace(',', '.'));
    if (!Number.isFinite(nota) || nota < 0 || nota > maximo) throw new HttpError(400, `La nota debe estar entre 0,0 y ${maximo.toFixed(1).replace('.', ',')}.`);
    Object.assign(data, { finalGrade: Math.round(nota * 10) / 10, status: 'GRADED', gradedById: req.user.id, gradedAt: new Date() });
  }
  if (req.body.teacherComment !== undefined) data.teacherComment = String(req.body.teacherComment).trim().slice(0, 4000) || null;
  if (!Object.keys(data).length) throw new HttpError(400, 'Indique la nota o el comentario.');
  const actualizada = await prisma.submission.update({ where: { id: entrega.id }, data, include: { student: { select: { id: true, fullName: true, cedula: true } } } });
  res.json({ submission: publicEntrega(actualizada, { paraDocente: true }) });
});

// POST /api/submissions/:submissionId/regrade: vuelve a calificar (por ejemplo, después de corregir los casos de prueba).
activitiesRouter.post('/submissions/:submissionId/regrade', requireAuth, async (req, res) => {
  const { entrega } = await entregaDe(req, 'owner');
  await prisma.submission.update({
    where: { id: entrega.id },
    data: { status: 'SUBMITTED', autoGrade: null, confidence: null, finalGrade: null, gradingNotes: null, gradedById: null, gradedAt: null },
  });
  const lista = await calificarYEsperar(entrega.id);
  res.json({ submission: publicEntrega({ ...lista, student: entrega.student }, { paraDocente: true }) });
});

// --- Revisión y notas del docente (RF-13, RF-14) ---------------------------------

// GET /api/courses/:id/review: entregas que la plataforma dejó para revisión.
activitiesRouter.get('/courses/:id/review', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  const entregas = await prisma.submission.findMany({
    where: { status: 'IN_REVIEW', activity: { courseId: course.id, ...NO_QUIZ } },
    orderBy: { submittedAt: 'asc' },
    include: { activity: { select: { id: true, title: true, type: true, submissionType: true, maxGrade: true } }, student: { select: { id: true, fullName: true, cedula: true } } },
  });
  res.json({
    course: { id: course.id, name: course.name, period: course.period },
    submissions: entregas.map((s) => ({
      ...publicEntrega(s, { paraDocente: true }),
      activity: { ...s.activity, maxGrade: Number(s.activity.maxGrade) },
    })),
  });
});

// GET /api/courses/:id/gradebook
activitiesRouter.get('/courses/:id/gradebook', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  res.json({ course: { id: course.id, name: course.name, period: course.period }, ...(await planillaDelCurso(course.id)) });
});

// GET /api/courses/:id/gradebook.xlsx: la planilla en Excel.
activitiesRouter.get('/courses/:id/gradebook.xlsx', requireAuth, async (req, res) => {
  const { course } = await requireCourse(req.user, v.id(req.params.id), 'owner');
  const { actividades, estudiantes } = await planillaDelCurso(course.id);
  const nombreTipo = (a) => (a.kind === 'quiz' ? 'Quiz' : NOMBRE_TIPO[a.type] ?? '');
  const titulo = (a) => `${nombreTipo(a)}: ${a.title}${a.peso !== null ? ` (${a.peso} %)` : ''}`;
  const filas = [
    ['Cédula', 'Nombre', ...actividades.map(titulo), 'Definitiva'],
    ...estudiantes.map((e) => [
      e.cedula,
      e.fullName ?? (e.registrado ? '' : '(sin registrarse)'),
      ...actividades.map((a) => {
        const n = e.notas[a.clave];
        if (n.nota !== null) return n.nota;
        return n.estado === 'en_revision' ? 'En revisión' : null;
      }),
      e.definitiva,
    ]),
  ];
  const archivo = await crearExcel({ hoja: 'Notas', filas, anchos: [14, 34, ...actividades.map(() => 22), 12] });
  const nombre = `notas-${course.name}-${course.period}.xlsx`.replace(/[^\w.-]+/g, '-');
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${nombre}"`,
  });
  res.send(archivo);
});

// --- Editor de PSeInt en el navegador (RF-28) --------------------------------------

// POST /api/pseint/run { codigo, entrada }
activitiesRouter.post('/pseint/run', requireAuth, (req, res) => {
  const codigo = String(req.body.codigo ?? '');
  const entrada = String(req.body.entrada ?? '');
  if (codigo.length > 50000 || entrada.length > 20000) throw new HttpError(400, 'El algoritmo o la entrada son demasiado largos.');
  res.json(ejecutar(codigo, entrada));
});
