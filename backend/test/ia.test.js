import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { preguntarIA } from '../src/lib/ia.js';

// Respuestas falsas de Gemini: se anotan los modelos consultados.
let consultados;
let responder;
const fetchOriginal = globalThis.fetch;
const iaOriginal = { ...config.ia };

function respuesta(estado, cuerpo) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });
}
const ok = (texto) => respuesta(200, { candidates: [{ content: { parts: [{ text: texto }] } }] });
const retirado = (modelo) =>
  respuesta(404, {
    error: {
      code: 404,
      message: `This model models/${modelo} is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.`,
    },
  });

beforeEach(() => {
  consultados = [];
  Object.assign(config.ia, { proveedor: 'gemini', geminiClave: 'clave-de-prueba', geminiModelo: 'gemini-2.5-flash' });
  globalThis.fetch = async (url) => {
    const modelo = decodeURIComponent(String(url).match(/models\/([^:]+):generateContent/)[1]);
    consultados.push(modelo);
    return responder(modelo);
  };
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  Object.assign(config.ia, iaOriginal);
});

// Las pruebas van en orden: la primera deja guardado el modelo de reemplazo.
test('Gemini: si el modelo fue retirado, reintenta con el que sugiere Google', async () => {
  responder = (modelo) => (modelo === 'gemini-2.5-flash' ? retirado(modelo) : ok('{"codigo":"Escribir 7"}'));
  const r = await preguntarIA('Lea la foto');
  assert.deepEqual(r, { codigo: 'Escribir 7' });
  assert.deepEqual(consultados, ['gemini-2.5-flash', 'gemini-3.8-flash']);
});

test('Gemini: después sigue con el modelo que funcionó, sin volver a probar el retirado', async () => {
  responder = () => ok('{"codigo":"Escribir 8"}');
  await preguntarIA('Lea la foto');
  assert.deepEqual(consultados, ['gemini-3.8-flash']);
});

test('Gemini: otros errores (como la cuota) no cambian de modelo', async () => {
  responder = () => respuesta(429, { error: { code: 429, message: 'Quota exceeded for metric: generate_content_free_tier_requests' } });
  await assert.rejects(preguntarIA('Lea la foto'), /Quota exceeded/);
  assert.equal(consultados.length, 1);
});
