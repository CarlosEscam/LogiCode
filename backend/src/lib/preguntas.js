import { HttpError } from './errors.js';
import { TOOLS } from './material.js';

// Banco de preguntas: validación de lo que escribe el docente y calificación automática.
//
// Formato de options y correctAnswer por tipo:
//   MULTIPLE_CHOICE  options: ["opción", ...] (2 a 6)   correctAnswer: índice de la correcta
//   TRUE_FALSE       options: null                       correctAnswer: true | false
//   SHORT_ANSWER     options: null                       correctAnswer: ["respuesta aceptada", ...]
//   OUTPUT           options: null, code: algoritmo      correctAnswer: ["salida esperada", ...]
//   ORDER_STEPS      options: pasos en el orden correcto correctAnswer: null
//
// Respuesta del estudiante: índice, true/false, texto, texto, o la lista de pasos en su orden.

export const TIPOS_PREGUNTA = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'OUTPUT', 'ORDER_STEPS'];

function texto(valor, campo, max = 2000) {
  const limpio = String(valor ?? '').trim();
  if (!limpio) throw new HttpError(400, `Escriba ${campo}.`);
  if (limpio.length > max) throw new HttpError(400, `${campo[0].toUpperCase()}${campo.slice(1)} es demasiado largo.`);
  return limpio;
}

function lista(valor, campo, min, max) {
  const items = (Array.isArray(valor) ? valor : []).map((x) => String(x ?? '').trim()).filter(Boolean);
  if (items.length < min) throw new HttpError(400, `Escriba al menos ${min} ${campo}.`);
  if (items.length > max) throw new HttpError(400, `Use como máximo ${max} ${campo}.`);
  if (items.some((x) => x.length > 500)) throw new HttpError(400, `Hay ${campo} demasiado largas.`);
  return items;
}

// Valida el cuerpo de una pregunta y devuelve los campos para guardar.
export function datosPregunta(body) {
  const type = body.type;
  if (!TIPOS_PREGUNTA.includes(type)) throw new HttpError(400, 'Tipo de pregunta no válido.');
  const tool = body.tool ?? 'GENERAL';
  if (!TOOLS.includes(tool)) throw new HttpError(400, 'Herramienta no válida.');

  const data = {
    type,
    tool,
    statement: texto(body.statement, 'el enunciado'),
    code: null,
    options: null,
    correctAnswer: null,
    explanation: String(body.explanation ?? '').trim().slice(0, 2000) || null,
  };

  if (type === 'MULTIPLE_CHOICE') {
    const opciones = lista(body.options, 'opciones', 2, 6);
    const correcta = Number(body.correctAnswer);
    if (!Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) {
      throw new HttpError(400, 'Marque cuál opción es la correcta.');
    }
    data.options = opciones;
    data.correctAnswer = correcta;
  } else if (type === 'TRUE_FALSE') {
    if (typeof body.correctAnswer !== 'boolean') throw new HttpError(400, 'Indique si la afirmación es verdadera o falsa.');
    data.correctAnswer = body.correctAnswer;
  } else if (type === 'SHORT_ANSWER' || type === 'OUTPUT') {
    if (type === 'OUTPUT') data.code = texto(body.code, 'el algoritmo', 5000);
    data.correctAnswer = lista(body.correctAnswer, 'respuestas aceptadas', 1, 10);
  } else if (type === 'ORDER_STEPS') {
    const pasos = lista(body.options, 'pasos', 3, 10);
    if (new Set(pasos).size !== pasos.length) throw new HttpError(400, 'Los pasos no se pueden repetir.');
    data.options = pasos;
  }
  return data;
}

// Compara textos sin importar mayúsculas, tildes, espacios de más ni saltos de línea al final.
export function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\r?\n/)
    .map((linea) => linea.trim().replace(/\s+/g, ' '))
    .join('\n')
    .replace(/\n+$/, '')
    .replace(/^\n+/, '');
}

function sinResponder(tipo, respuesta) {
  if (respuesta === null || respuesta === undefined) return true;
  if (tipo === 'SHORT_ANSWER' || tipo === 'OUTPUT') return normalizar(respuesta) === '';
  if (tipo === 'ORDER_STEPS') return !Array.isArray(respuesta) || respuesta.length === 0;
  return false;
}

// Devuelve el puntaje de una respuesta, de 0 a 1. Una pregunta sin responder vale 0.
export function calificar(pregunta, respuesta) {
  if (sinResponder(pregunta.type, respuesta)) return 0;
  switch (pregunta.type) {
    case 'MULTIPLE_CHOICE':
      return Number(respuesta) === pregunta.correctAnswer ? 1 : 0;
    case 'TRUE_FALSE':
      return respuesta === pregunta.correctAnswer ? 1 : 0;
    case 'SHORT_ANSWER':
    case 'OUTPUT': {
      const dada = normalizar(respuesta);
      return pregunta.correctAnswer.some((r) => normalizar(r) === dada) ? 1 : 0;
    }
    case 'ORDER_STEPS': {
      // Proporción de pasos en su lugar (sección 6 del anteproyecto).
      const pasos = pregunta.options;
      const enSuLugar = pasos.filter((paso, i) => respuesta[i] === paso).length;
      return enSuLugar / pasos.length;
    }
    default:
      return 0;
  }
}

// Revisa la forma de una respuesta antes de guardarla.
export function respuestaValida(pregunta, respuesta) {
  if (respuesta === null) return null;
  switch (pregunta.type) {
    case 'MULTIPLE_CHOICE':
      if (!Number.isInteger(respuesta) || respuesta < 0 || respuesta >= pregunta.options.length) break;
      return respuesta;
    case 'TRUE_FALSE':
      if (typeof respuesta !== 'boolean') break;
      return respuesta;
    case 'SHORT_ANSWER':
    case 'OUTPUT':
      if (typeof respuesta !== 'string' || respuesta.length > 5000) break;
      return respuesta;
    case 'ORDER_STEPS':
      if (!Array.isArray(respuesta) || respuesta.length !== pregunta.options.length) break;
      if ([...respuesta].sort().join('\u0000') !== [...pregunta.options].sort().join('\u0000')) break;
      return respuesta;
  }
  throw new HttpError(400, 'La respuesta no tiene el formato esperado.');
}

// Pregunta como la ve el estudiante mientras responde: sin la respuesta correcta.
// Los pasos para ordenar se muestran revueltos (nunca en el orden correcto).
export function preguntaParaResponder(pregunta) {
  const base = { id: pregunta.id, type: pregunta.type, tool: pregunta.tool, statement: pregunta.statement, code: pregunta.code };
  if (pregunta.type === 'MULTIPLE_CHOICE') base.options = pregunta.options;
  if (pregunta.type === 'ORDER_STEPS') {
    let pasos = mezclar(pregunta.options, pregunta.id);
    if (pasos.every((p, i) => p === pregunta.options[i])) pasos = [...pasos.slice(1), pasos[0]];
    base.options = pasos;
  }
  return base;
}

// Mezcla estable: el mismo intento ve siempre el mismo orden.
export function mezclar(items, semilla) {
  const copia = [...items];
  let s = semilla * 9301 + 49297;
  for (let i = copia.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
