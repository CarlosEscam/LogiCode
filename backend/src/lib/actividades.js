import { prisma } from './prisma.js';
import { HttpError } from './errors.js';
import { clavesScratchValidas } from './scratch.js';
import { cerrarVencidos } from './quizzes.js';

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

// Porcentaje con el que cuenta cada columna de la planilla. Las que tienen porcentaje pesan
// eso; las que no (por ejemplo los quizzes) se reparten por igual lo que falte para 100 %.
// Si ninguna tiene porcentaje, todas valen igual (null: promedio simple).
export function pesosEfectivos(columnas) {
  const conPeso = columnas.filter((c) => c.weight !== null);
  if (!conPeso.length) return columnas.map(() => null);
  const asignado = conPeso.reduce((s, c) => s + c.weight, 0);
  const sinPeso = columnas.length - conPeso.length;
  const resto = sinPeso ? Math.max(0, 100 - asignado) / sinPeso : 0;
  return columnas.map((c) => Math.round((c.weight ?? resto) * 100) / 100);
}

// Definitiva sobre lo que ya cuenta: ponderada con los pesos efectivos o, si no hay pesos, promedio.
function definitivaDe(cuentan) {
  if (!cuentan.length) return null;
  const pesos = cuentan.reduce((s, c) => s + (c.peso ?? 0), 0);
  const valor = cuentan.every((c) => c.peso !== null) && pesos > 0
    ? cuentan.reduce((s, c) => s + c.nota * c.peso, 0) / pesos
    : cuentan.reduce((s, c) => s + c.nota, 0) / cuentan.length;
  return Math.round(valor * 10) / 10;
}

// Planilla de notas del curso (RF-13, RF-14): tareas, talleres, evaluaciones y quizzes con nota
// (los de repaso no cuentan). Una columna cuenta para la definitiva cuando el estudiante ya tiene
// nota o cuando su plazo venció (sin entrega cuenta 0,0). De cada una vale el mejor intento.
export async function planillaDelCurso(courseId) {
  // Los intentos de quiz que se quedaron abiertos con el tiempo vencido se cierran antes de sumar.
  await cerrarVencidos({ quiz: { courseId } });
  const [actividades, quizzes, lista] = await Promise.all([
    prisma.activity.findMany({
      where: { courseId, ...NO_QUIZ },
      orderBy: [{ closesAt: 'asc' }, { id: 'asc' }],
      include: { extensions: true, submissions: { select: { studentId: true, status: true, finalGrade: true } } },
    }),
    prisma.quiz.findMany({
      where: { courseId, published: true, isPractice: false },
      orderBy: [{ closesAt: 'asc' }, { id: 'asc' }],
      include: { attempts: { where: { submittedAt: { not: null } }, select: { studentId: true, grade: true } } },
    }),
    prisma.rosterEntry.findMany({ where: { courseId }, orderBy: { cedula: 'asc' }, include: { user: { select: { id: true, fullName: true } } } }),
  ]);
  const ahora = new Date();

  // Cada columna sabe calcular la nota y el estado de un estudiante.
  const columnas = [
    ...actividades.map((a) => ({
      clave: `a${a.id}`, kind: 'activity', id: a.id, title: a.title, type: a.type, weight: num(a.weight), closesAt: a.closesAt,
      celda(userId) {
        const propias = userId ? a.submissions.filter((s) => s.studentId === userId) : [];
        const nota = mejorNota(propias);
        const pendiente = propias.some((s) => s.status === 'IN_REVIEW' || s.status === 'SUBMITTED');
        const vencida = plazoDe(a, a.extensions, userId).cierre < ahora;
        return { nota, pendiente, vencida };
      },
    })),
    ...quizzes.map((q) => ({
      clave: `q${q.id}`, kind: 'quiz', id: q.id, title: q.title, type: 'QUIZ', weight: null, closesAt: q.closesAt,
      celda(userId) {
        const notas = userId ? q.attempts.filter((t) => t.studentId === userId && t.grade !== null).map((t) => Number(t.grade)) : [];
        return { nota: notas.length ? Math.max(...notas) : null, pendiente: false, vencida: q.closesAt < ahora };
      },
    })),
  ].sort((x, y) => x.closesAt - y.closesAt);
  const pesos = pesosEfectivos(columnas);

  const estudiantes = lista.map((r) => {
    const notas = {};
    const cuentan = [];
    columnas.forEach((c, i) => {
      const { nota, pendiente, vencida } = c.celda(r.userId);
      let estado = 'pendiente';
      if (nota !== null) estado = 'calificada';
      else if (pendiente) estado = 'en_revision';
      else if (vencida) estado = 'no_entrego';
      notas[c.clave] = { nota: nota ?? (estado === 'no_entrego' ? 0 : null), estado, revisionPendiente: pendiente };
      if (nota !== null || estado === 'no_entrego') cuentan.push({ nota: nota ?? 0, peso: pesos[i] });
    });
    return { cedula: r.cedula, fullName: r.user?.fullName ?? r.fullName ?? null, registrado: r.userId !== null, notas, definitiva: definitivaDe(cuentan) };
  });
  return {
    actividades: columnas.map((c, i) => ({
      clave: c.clave, kind: c.kind, id: c.id, title: c.title, type: c.type, weight: c.weight, peso: pesos[i], closesAt: c.closesAt,
    })),
    estudiantes,
  };
}
