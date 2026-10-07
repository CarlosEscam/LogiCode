import { prisma } from './prisma.js';
import { HttpError } from './errors.js';
import { clavesScratchValidas } from './scratch.js';

// Reglas de las actividades (RF-10, RF-11, RF-27): tipos, plazos con prórroga e intentos.

// Los quizzes tienen sus propias tablas y pantallas; aquí van tareas, talleres y evaluaciones.
export const TIPOS_ACTIVIDAD = ['TASK', 'WORKSHOP', 'EVALUATION'];
export const TIPOS_ENTREGA = ['TEXT', 'FILE', 'PHOTO', 'PSEINT'];
export const NO_QUIZ = { type: { in: TIPOS_ACTIVIDAD } };

const num = (d) => (d === null || d === undefined ? null : Number(d));

function fecha(valor, campo) {
  const d = new Date(String(valor ?? ''));
  if (!valor || Number.isNaN(d.getTime())) throw new HttpError(400, `Indique la fecha de ${campo}.`);
  return d;
}

function texto(valor, max = 20000) {
  if (valor === undefined) return undefined;
  const t = String(valor ?? '').trim();
  return t ? t.slice(0, max) : null;
}

// Datos de una actividad que llegan del formulario del docente.
export function datosActividad(body, parcial = false) {
  const data = {};
  if (!parcial || body.title !== undefined) {
    const title = String(body.title ?? '').trim();
    if (title.length < 2 || title.length > 200) throw new HttpError(400, 'Escriba el título de la actividad.');
    data.title = title;
  }
  if (!parcial || body.type !== undefined) {
    if (!TIPOS_ACTIVIDAD.includes(body.type)) throw new HttpError(400, 'Elija si es tarea, taller o evaluación.');
    data.type = body.type;
  }
  if (!parcial || body.submissionType !== undefined) {
    if (!TIPOS_ENTREGA.includes(body.submissionType)) throw new HttpError(400, 'Elija el tipo de entrega.');
    data.submissionType = body.submissionType;
  }
  if (!parcial || body.opensAt !== undefined) data.opensAt = fecha(body.opensAt, 'apertura');
  if (!parcial || body.closesAt !== undefined) data.closesAt = fecha(body.closesAt, 'cierre');
  for (const campo of ['instructions', 'expectedAnswer', 'rubric']) {
    const t = texto(body[campo]);
    if (t !== undefined) data[campo] = t;
  }
  if (body.weight !== undefined) {
    if (body.weight === null || body.weight === '') data.weight = null;
    else {
      const w = Number(body.weight);
      if (!Number.isFinite(w) || w < 0 || w > 100) throw new HttpError(400, 'El porcentaje debe estar entre 0 y 100.');
      data.weight = Math.round(w * 100) / 100;
    }
  }
  if (body.maxAttempts !== undefined) {
    const n = Number(body.maxAttempts);
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new HttpError(400, 'Los intentos deben ser de 1 a 10.');
    data.maxAttempts = n;
  }
  if (body.scratchChecks !== undefined) {
    data.scratchChecks = clavesScratchValidas(Array.isArray(body.scratchChecks) ? body.scratchChecks.map(String) : []);
  }
  return data;
}

// Casos de prueba de PSeInt: entrada (un dato por línea) y salida esperada.
export function casosDePrueba(lista) {
  if (lista === undefined) return undefined;
  if (!Array.isArray(lista)) throw new HttpError(400, 'Los casos de prueba no son válidos.');
  if (lista.length > 30) throw new HttpError(400, 'Máximo 30 casos de prueba.');
  return lista.map((c, i) => {
    const expectedOutput = String(c?.expectedOutput ?? '').slice(0, 5000);
    if (!expectedOutput.trim()) throw new HttpError(400, `Escriba la salida esperada del caso ${i + 1}.`);
    const weight = c?.weight === undefined || c?.weight === '' ? 1 : Number(c.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) throw new HttpError(400, `El peso del caso ${i + 1} no es válido.`);
    return { input: String(c?.input ?? '').slice(0, 5000), expectedOutput, weight };
  });
}

// Plazo e intentos de un estudiante, contando las prórrogas para él y para todo el curso.
export function plazoDe(activity, extensiones, studentId) {
  const propias = extensiones.filter((e) => e.studentId === null || e.studentId === studentId);
  const cierre = propias.reduce((max, e) => (e.newClosesAt && e.newClosesAt > max ? e.newClosesAt : max), activity.closesAt);
  const intentos = activity.maxAttempts + propias.reduce((a, e) => a + e.extraAttempts, 0);
  return { cierre, intentos };
}

export function publicActividad(a, { paraDocente }) {
  const base = {
    id: a.id,
    courseId: a.courseId,
    topicId: a.topicId,
    topic: a.topic ? { id: a.topic.id, title: a.topic.title, tool: a.topic.tool } : null,
    type: a.type,
    title: a.title,
    instructions: a.instructions,
    submissionType: a.submissionType,
    opensAt: a.opensAt,
    closesAt: a.closesAt,
    maxGrade: num(a.maxGrade),
    maxAttempts: a.maxAttempts,
    weight: num(a.weight),
    rubric: a.rubric,
    scratchChecks: a.scratchChecks,
    testCaseCount: a.testCases?.length ?? a._count?.testCases ?? 0,
  };
  if (!paraDocente) return base;
  return {
    ...base,
    expectedAnswer: a.expectedAnswer,
    testCases: a.testCases?.map((c) => ({ id: c.id, input: c.input, expectedOutput: c.expectedOutput, weight: num(c.weight) })),
  };
}

// Lo que ve el estudiante de su entrega: mientras está en revisión no ve la nota propuesta.
export function publicEntrega(s, { paraDocente }) {
  const visible = paraDocente || s.status === 'GRADED';
  return {
    id: s.id,
    activityId: s.activityId,
    studentId: s.studentId,
    student: s.student ? { id: s.student.id, fullName: s.student.fullName, cedula: s.student.cedula } : undefined,
    attemptNumber: s.attemptNumber,
    status: s.status,
    submittedAt: s.submittedAt,
    textAnswer: s.textAnswer,
    fileName: s.fileName,
    hasFile: Boolean(s.filePath),
    autoGrade: paraDocente ? num(s.autoGrade) : undefined,
    confidence: paraDocente ? s.confidence : undefined,
    finalGrade: visible ? num(s.finalGrade) : null,
    gradingNotes: visible || s.status === 'IN_REVIEW' ? s.gradingNotes : null,
    gradingDetails: visible ? s.gradingDetails : null,
    teacherComment: s.teacherComment,
    gradedAt: s.gradedAt,
  };
}

// La nota que cuenta en una actividad: la mejor de los intentos ya calificados.
export function mejorNota(entregas) {
  const calificadas = entregas.filter((s) => s.status === 'GRADED' && s.finalGrade !== null);
  if (!calificadas.length) return null;
  return Math.max(...calificadas.map((s) => Number(s.finalGrade)));
}

// Planilla de notas del curso (RF-13, RF-14). Una actividad cuenta para la definitiva cuando
// el estudiante ya tiene nota o cuando su plazo venció (sin entrega cuenta 0,0).
// Si todas las actividades que cuentan tienen porcentaje, la definitiva es ponderada; si no, el promedio.
export async function planillaDelCurso(courseId) {
  const [actividades, lista] = await Promise.all([
    prisma.activity.findMany({
      where: { courseId, ...NO_QUIZ },
      orderBy: [{ closesAt: 'asc' }, { id: 'asc' }],
      include: { extensions: true, submissions: { select: { studentId: true, status: true, finalGrade: true } } },
    }),
    prisma.rosterEntry.findMany({ where: { courseId }, orderBy: { cedula: 'asc' }, include: { user: { select: { id: true, fullName: true } } } }),
  ]);
  const ahora = new Date();
  const estudiantes = lista.map((r) => {
    const notas = {};
    const cuentan = [];
    for (const a of actividades) {
      const propias = r.userId ? a.submissions.filter((s) => s.studentId === r.userId) : [];
      const nota = mejorNota(propias);
      const pendiente = propias.some((s) => s.status === 'IN_REVIEW' || s.status === 'SUBMITTED');
      const vencida = plazoDe(a, a.extensions, r.userId).cierre < ahora;
      let estado = 'pendiente';
      if (nota !== null) estado = 'calificada';
      else if (pendiente) estado = 'en_revision';
      else if (vencida) estado = 'no_entrego';
      notas[a.id] = { nota: nota ?? (estado === 'no_entrego' ? 0 : null), estado, revisionPendiente: pendiente };
      if (nota !== null || estado === 'no_entrego') cuentan.push({ nota: nota ?? 0, peso: a.weight === null ? null : Number(a.weight) });
    }
    let definitiva = null;
    if (cuentan.length) {
      const ponderada = cuentan.every((c) => c.peso !== null) && cuentan.some((c) => c.peso > 0);
      if (ponderada) {
        const pesos = cuentan.reduce((s, c) => s + c.peso, 0);
        definitiva = cuentan.reduce((s, c) => s + c.nota * c.peso, 0) / pesos;
      } else {
        definitiva = cuentan.reduce((s, c) => s + c.nota, 0) / cuentan.length;
      }
      definitiva = Math.round(definitiva * 10) / 10;
    }
    return { cedula: r.cedula, fullName: r.user?.fullName ?? r.fullName ?? null, registrado: r.userId !== null, notas, definitiva };
  });
  return {
    actividades: actividades.map((a) => ({ id: a.id, title: a.title, type: a.type, weight: num(a.weight), closesAt: a.closesAt })),
    estudiantes,
  };
}
