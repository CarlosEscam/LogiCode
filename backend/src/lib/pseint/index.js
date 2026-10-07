import { analizar, ErrorPSeInt, normalizar } from './analizador.js';
import { correr } from './interprete.js';

// Intérprete de PSeInt de LogiCode: lo usan el editor del navegador (vía la API) y el
// calificador de actividades y preguntas de completar código.

export { ErrorPSeInt } from './analizador.js';

// Una entrada por línea: cada dato que pide Leer consume una línea.
function lineasDeEntrada(entrada) {
  if (Array.isArray(entrada)) return entrada.map(String);
  const texto = String(entrada ?? '').replace(/\r\n?/g, '\n');
  return texto === '' ? [] : texto.replace(/\n$/, '').split('\n');
}

// Ejecuta un algoritmo. Nunca lanza: devuelve la salida y, si falló, el error.
// error.tipo es 'sintaxis' (no se pudo leer el algoritmo) o 'ejecucion' (falló al correr).
export function ejecutar(codigo, entrada = '') {
  let programa;
  try {
    programa = analizar(codigo);
  } catch (e) {
    if (!(e instanceof ErrorPSeInt)) throw e;
    return { salida: '', error: { tipo: 'sintaxis', mensaje: e.message, linea: e.linea ?? null } };
  }
  try {
    return { salida: correr(programa, lineasDeEntrada(entrada)).join('\n'), error: null };
  } catch (e) {
    if (!(e instanceof ErrorPSeInt)) throw e;
    return { salida: (e.salida ?? []).join('\n'), error: { tipo: e.tipo, mensaje: e.message, linea: e.linea ?? null } };
  }
}

// --- Comparación de salidas ---------------------------------------------------
// Se ignoran mayúsculas, tildes, espacios de más y líneas vacías. La salida puede tener
// líneas de más (por ejemplo "Ingrese un número:"), pero las esperadas deben salir en orden.
// Si una línea esperada tiene solo números, basta con que la línea tenga esos mismos números:
// "15" acepta "La suma es: 15" pero no "La suma es 150".

const limpiar = (linea) => normalizar(linea).replace(/\s+/g, ' ').trim();
const NUMERO = /-?\d+(?:[.,]\d+)?/g;
const numeros = (linea) => (linea.match(NUMERO) ?? []).map((n) => Number(n.replace(',', '.')));
const soloNumeros = (linea) => /^[\s\d.,-]+$/.test(linea) && numeros(linea).length > 0;
const casiIgual = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

function lineaCoincide(obtenida, esperada) {
  if (soloNumeros(esperada)) {
    const a = numeros(obtenida);
    const b = numeros(esperada);
    return a.length === b.length && a.every((n, i) => casiIgual(n, b[i]));
  }
  if (obtenida === esperada) return true;
  // Mismo texto con números escritos distinto (2.50 y 2.5).
  const sinNumeros = (l) => l.replace(NUMERO, '#');
  if (sinNumeros(obtenida) !== sinNumeros(esperada)) return false;
  const a = numeros(obtenida);
  const b = numeros(esperada);
  return a.length === b.length && a.every((n, i) => casiIgual(n, b[i]));
}

export function salidaCumple(obtenida, esperada) {
  const lineas = String(obtenida).split('\n').map(limpiar).filter(Boolean);
  const buscadas = String(esperada).replace(/\r\n?/g, '\n').split('\n').map(limpiar).filter(Boolean);
  let i = 0;
  for (const buscada of buscadas) {
    while (i < lineas.length && !lineaCoincide(lineas[i], buscada)) i++;
    if (i === lineas.length) return false;
    i++;
  }
  return true;
}

// Corre el algoritmo con cada caso de prueba ({ input, expectedOutput, weight }).
// puntaje va de 0 a 1 según el peso de los casos que pasan. Si el algoritmo no se puede
// leer, sintaxis trae el error y no se corre ningún caso.
export function probarCasos(codigo, casos) {
  let programa;
  try {
    programa = analizar(codigo);
  } catch (e) {
    if (!(e instanceof ErrorPSeInt)) throw e;
    return { sintaxis: { mensaje: e.message, linea: e.linea ?? null }, resultados: [], puntaje: 0 };
  }
  let total = 0;
  let logrado = 0;
  const resultados = casos.map((caso) => {
    const peso = Number(caso.weight ?? 1) || 0;
    total += peso;
    let salida = '';
    let error = null;
    try {
      salida = correr(programa, lineasDeEntrada(caso.input)).join('\n');
    } catch (e) {
      if (!(e instanceof ErrorPSeInt)) throw e;
      salida = (e.salida ?? []).join('\n');
      error = { tipo: e.tipo, mensaje: e.message };
    }
    const ok = !error && salidaCumple(salida, caso.expectedOutput);
    if (ok) logrado += peso;
    return { ok, entrada: caso.input ?? '', esperado: caso.expectedOutput, obtenido: salida, error };
  });
  // Una función que no existe solo se descubre al correr; cuenta como que no se pudo leer.
  const noSoportado = resultados.find((r) => r.error?.tipo === 'sintaxis');
  if (noSoportado) return { sintaxis: { mensaje: noSoportado.error.mensaje, linea: null }, resultados, puntaje: 0 };
  return { sintaxis: null, resultados, puntaje: total > 0 ? logrado / total : 0 };
}
