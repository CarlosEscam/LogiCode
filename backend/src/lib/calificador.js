import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './prisma.js';
import { config } from '../config.js';
import { probarCasos } from './pseint/index.js';
import { preguntarIA, proveedorIA, ErrorIA } from './ia.js';
import { revisarScratch } from './scratch.js';
import { rutaArchivo, tipoDeArchivo } from './uploads.js';
import { normalizar } from './pseint/analizador.js';

// Calificación automática de entregas (sección 5 del anteproyecto).
// Cada entrega llega como SUBMITTED y sale como:
//   GRADED     la plataforma está segura de la nota (finalGrade = autoGrade), o
//   IN_REVIEW  el docente debe revisarla: no se pudo leer, la confianza es baja,
//              o es un tipo que siempre confirma el docente (Scratch y Arduino).
// Las entregas se califican de una en una para no saturar la IA local.

const IMAGENES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const TEXTOS = new Set(['.txt', '.md']);

const redondear = (n) => Math.round(n * 10) / 10;
const enEscala = (fraccion, maximo) => redondear(Math.min(1, Math.max(0, fraccion)) * maximo);

// --- Cola ----------------------------------------------------------------------

let cola = Promise.resolve();
const pendientes = new Map();

// Agrega la entrega a la cola y devuelve la promesa de su calificación.
export function encolar(submissionId) {
  if (pendientes.has(submissionId)) return pendientes.get(submissionId);
  const promesa = (cola = cola.then(() => calificar(submissionId)).catch((e) => console.error('[calificador]', e)));
  pendientes.set(submissionId, promesa);
  promesa.finally(() => pendientes.delete(submissionId));
  return promesa;
}

// Para las pruebas: espera a que la cola quede vacía.
export async function esperarCola() {
  while (pendientes.size) await Promise.all([...pendientes.values()]);
}

// Al arrancar el servidor, retoma las entregas que quedaron sin calificar.
export async function retomarPendientes() {
  const sueltas = await prisma.submission.findMany({ where: { status: 'SUBMITTED' }, select: { id: true }, orderBy: { id: 'asc' } });
  sueltas.forEach((s) => encolar(s.id));
  return sueltas.length;
}

// --- Calificación ----------------------------------------------------------------

export async function calificar(submissionId) {
  const entrega = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { activity: { include: { testCases: { orderBy: { id: 'asc' } } } } },
  });
  if (!entrega || entrega.status !== 'SUBMITTED') return;

  let r;
  try {
    r = await evaluar(entrega);
  } catch (e) {
    console.error('[calificador]', e);
    r = { revisar: true, notas: 'La calificación automática falló; el docente debe revisar esta entrega.' };
  }
  const maximo = Number(entrega.activity.maxGrade);
  const autoGrade = r.fraccion === undefined || r.fraccion === null ? null : enEscala(r.fraccion, maximo);
  const revisar = r.revisar || autoGrade === null;

  // Solo si sigue sin calificar: el docente pudo ponerle nota mientras tanto.
  await prisma.submission.updateMany({
    where: { id: entrega.id, status: 'SUBMITTED' },
    data: {
      status: revisar ? 'IN_REVIEW' : 'GRADED',
      autoGrade,
      confidence: r.confianza ?? null,
      finalGrade: revisar ? null : autoGrade,
      gradingNotes: r.notas?.slice(0, 4000) ?? null,
      gradingDetails: r.detalles ?? undefined,
      gradedAt: revisar ? null : new Date(),
    },
  });
}

async function evaluar(entrega) {
  const { activity } = entrega;
  const ext = path.extname(entrega.fileName ?? entrega.filePath ?? '').toLowerCase();

  switch (activity.submissionType) {
    case 'PSEINT':
      return calificarPseint(activity, entrega.textAnswer ?? '');
    case 'TEXT':
      return calificarTexto(activity, entrega.textAnswer ?? '');
    case 'PHOTO':
      return calificarImagen(activity, entrega);
    case 'FILE':
      if (ext === '.psc') return calificarPseint(activity, await leerTexto(entrega));
      if (IMAGENES.has(ext)) return calificarImagen(activity, entrega);
      if (ext === '.sb3') return calificarScratch(activity, entrega);
      if (ext === '.ino') return calificarArduino(activity, await leerTexto(entrega));
      if (TEXTOS.has(ext)) return calificarTexto(activity, await leerTexto(entrega));
      return { revisar: true, notas: `Los archivos ${ext || 'sin extensión'} los califica el docente.` };
    default:
      return { revisar: true, notas: 'Este tipo de entrega lo califica el docente.' };
  }
}

async function leerArchivo(entrega) {
  if (!entrega.filePath) throw new Error('La entrega no tiene archivo.');
  return fs.promises.readFile(rutaArchivo(entrega.filePath));
}

async function leerTexto(entrega) {
  return (await leerArchivo(entrega)).toString('utf8').slice(0, 200_000);
}

// PSeInt: se corre con los casos de prueba del docente. Si no se puede ejecutar, lo revisa el docente.
function calificarPseint(activity, codigo) {
  if (!codigo.trim()) return { fraccion: 0, confianza: 1, notas: 'La entrega no trae ningún algoritmo.' };
  if (!activity.testCases.length) {
    return calificarTexto(activity, codigo, 'un algoritmo de PSeInt');
  }
  const r = probarCasos(codigo, activity.testCases);
  const detalles = { tipo: 'casos', resultados: r.resultados.map(recortarResultado) };
  if (r.sintaxis) {
    return {
      revisar: true,
      notas: `El calificador no pudo leer el algoritmo (${r.sintaxis.mensaje}). Puede ser un error del estudiante o algo que el calificador aún no entiende; revíselo.`,
      detalles,
    };
  }
  const pasan = r.resultados.filter((x) => x.ok).length;
  const todosFallan = r.resultados.length > 0 && r.resultados.every((x) => x.error);
  if (todosFallan) {
    return {
      revisar: true,
      fraccion: 0,
      notas: `El algoritmo no se pudo ejecutar en ningún caso de prueba (${r.resultados[0].error.mensaje}).`,
      detalles,
    };
  }
  return { fraccion: r.puntaje, confianza: 1, notas: `Pasó ${pasan} de ${r.resultados.length} casos de prueba.`, detalles };
}

const recortar = (texto, n = 2000) => (String(texto ?? '').length > n ? String(texto).slice(0, n) + '…' : String(texto ?? ''));
const recortarResultado = (x) => ({ ok: x.ok, entrada: recortar(x.entrada), esperado: recortar(x.esperado), obtenido: recortar(x.obtenido), error: x.error?.mensaje ?? null });

function contexto(activity) {
  return [
    `Actividad: ${activity.title}`,
    activity.instructions && `Instrucciones: ${activity.instructions}`,
    activity.expectedAnswer && `Respuesta esperada: ${activity.expectedAnswer}`,
    activity.rubric && `Rúbrica: ${activity.rubric}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const INICIO = 'Eres el asistente de calificación de Pensamiento Computacional, un curso de primer semestre (PSeInt, diagramas de flujo DFD, Scratch y Arduino). Califica con criterio de docente: justo, sin inventar lo que no está.';

const FORMATO_NOTA =
  'Responde solo con JSON: {"legible": true o false, "transcripcion": "lo que leíste", "nota": número de 0 a 5 con un decimal, "confianza": número de 0 a 1, "comentario": "retroalimentación breve para el estudiante, en español, máximo 3 frases"}';

// Lee la respuesta de la IA y decide si la nota queda firme o en revisión.
function resultadoIA(datos, extra = {}) {
  const nota = Number(datos.nota);
  const confianza = Math.min(1, Math.max(0, Number(datos.confianza)));
  const legible = datos.legible !== false;
  const comentario = String(datos.comentario ?? '').trim();
  const lectura = String(datos.transcripcion ?? '').trim();
  if (!Number.isFinite(nota) || !Number.isFinite(confianza)) {
    return { revisar: true, notas: 'La IA no dio una nota clara; el docente debe revisar.' };
  }
  const bajo = !legible || confianza < config.ia.confianzaMinima;
  return {
    fraccion: nota / 5,
    confianza,
    revisar: bajo || extra.siempreRevisar,
    notas: [
      comentario,
      !legible && 'La IA no pudo leer bien la entrega.',
      legible && confianza < config.ia.confianzaMinima && `Confianza baja (${Math.round(confianza * 100)} %): la nota queda para revisión del docente.`,
      extra.siempreRevisar && 'Nota propuesta: el docente la confirma.',
    ]
      .filter(Boolean)
      .join(' '),
    detalles: { tipo: 'ia', proveedor: proveedorIA(), lectura: recortar(lectura, 4000) },
  };
}

function sinIA(motivo) {
  return { revisar: true, notas: `${motivo} El docente la califica.` };
}

// Texto: si coincide con la respuesta esperada, nota completa; si no, la revisa la IA.
async function calificarTexto(activity, texto, que = 'una respuesta escrita') {
  if (!texto.trim()) return { fraccion: 0, confianza: 1, notas: 'La entrega está vacía.' };
  const igual = (a) => normalizar(a).replace(/\s+/g, ' ').trim();
  if (activity.expectedAnswer && igual(texto) === igual(activity.expectedAnswer)) {
    return { fraccion: 1, confianza: 1, notas: 'Coincide con la respuesta esperada.' };
  }
  if (!activity.expectedAnswer && !activity.rubric) return sinIA('La actividad no tiene respuesta esperada ni rúbrica.');
  if (!proveedorIA()) return sinIA('No hay IA configurada para revisar respuestas abiertas.');
  try {
    const datos = await preguntarIA(`${INICIO}\n\n${contexto(activity)}\n\nEl estudiante entregó ${que}:\n"""\n${texto.slice(0, 20000)}\n"""\n\nCompárala con la respuesta esperada y la rúbrica. ${FORMATO_NOTA}`);
    return resultadoIA(datos);
  } catch (e) {
    if (e instanceof ErrorIA) return sinIA(e.message);
    throw e;
  }
}

// Foto: la IA la lee. Si la actividad tiene casos de prueba, se transcribe el algoritmo y se ejecuta.
async function calificarImagen(activity, entrega) {
  if (!proveedorIA()) return sinIA('No hay IA configurada para leer fotos.');
  const ext = path.extname(entrega.fileName ?? entrega.filePath).toLowerCase();
  const imagen = { datos: await leerArchivo(entrega), tipo: tipoDeArchivo(ext) };
  try {
    if (activity.testCases.length) {
      const datos = await preguntarIA(
        `${INICIO}\n\n${contexto(activity)}\n\nLa foto muestra un algoritmo de PSeInt escrito por el estudiante. Transcríbelo exactamente, línea por línea, sin corregir sus errores. Responde solo con JSON: {"legible": true o false, "codigo": "el algoritmo transcrito", "confianza": número de 0 a 1 sobre qué tan seguro estás de la transcripción}`,
        imagen,
      );
      const confianza = Math.min(1, Math.max(0, Number(datos.confianza) || 0));
      const codigo = String(datos.codigo ?? '');
      const r = calificarPseint(activity, codigo);
      const bajo = datos.legible === false || confianza < config.ia.confianzaMinima;
      return {
        ...r,
        confianza,
        revisar: r.revisar || bajo,
        notas: [r.notas, bajo && `La lectura de la foto no es confiable (${Math.round(confianza * 100)} %): la nota queda para revisión del docente.`].filter(Boolean).join(' '),
        detalles: { ...(r.detalles ?? {}), tipo: 'casos', proveedor: proveedorIA(), lectura: recortar(codigo, 4000) },
      };
    }
    if (!activity.expectedAnswer && !activity.rubric) return sinIA('La actividad no tiene respuesta esperada ni rúbrica para comparar la foto.');
    const datos = await preguntarIA(
      `${INICIO}\n\n${contexto(activity)}\n\nTe muestro la foto de la entrega del estudiante (puede ser un algoritmo, un diagrama de flujo o un ejercicio escrito a mano). 1) Transcribe lo que se ve. 2) Compáralo con la respuesta esperada y la rúbrica. 3) Si la foto está borrosa, cortada, la letra no se entiende o no corresponde a la actividad, pon "legible": false o una confianza baja. ${FORMATO_NOTA}`,
      imagen,
    );
    return resultadoIA(datos);
  } catch (e) {
    if (e instanceof ErrorIA) return sinIA(e.message);
    throw e;
  }
}

// Scratch: se revisan los bloques que pidió el docente. Siempre propone; el docente confirma.
async function calificarScratch(activity, entrega) {
  if (!activity.scratchChecks.length) return sinIA('La actividad no tiene lista de bloques para revisar el proyecto de Scratch.');
  let r;
  try {
    r = await revisarScratch(await leerArchivo(entrega), activity.scratchChecks);
  } catch (e) {
    return { revisar: true, notas: `${e.message} El docente la revisa.` };
  }
  const cumple = r.revisiones.filter((x) => x.ok).length;
  return {
    fraccion: r.puntaje,
    confianza: 1,
    revisar: true,
    notas: `Cumple ${cumple} de ${r.revisiones.length} requisitos (${r.totalBloques} bloques en total). Nota propuesta: el docente la confirma.`,
    detalles: { tipo: 'scratch', revisiones: r.revisiones, totalBloques: r.totalBloques },
  };
}

// Arduino: revisión de estructura y, si hay IA, una nota propuesta. Siempre la confirma el docente.
async function calificarArduino(activity, codigo) {
  const falta = ['setup', 'loop'].filter((f) => !new RegExp(`void\\s+${f}\\s*\\(`).test(codigo));
  const estructura = falta.length ? `Le falta la función ${falta.join(' y ')}().` : 'Tiene setup() y loop().';
  if (!proveedorIA() || (!activity.expectedAnswer && !activity.rubric)) {
    return { revisar: true, notas: `${estructura} El docente la califica.` };
  }
  const r = await calificarTexto(activity, codigo, 'un programa de Arduino (.ino)');
  return { ...r, revisar: true, notas: `${estructura} ${r.notas ?? ''}`.trim() };
}
