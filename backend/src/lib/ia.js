import { config } from '../config.js';

// IA que lee fotos y revisa respuestas abiertas. Se elige con AI_PROVIDER en backend/.env:
// "ollama" (modelo local, gratis y sin límites) o "gemini" (capa gratuita de la API de Google).
// Sin proveedor, las entregas que necesitan IA quedan "en revisión" para el docente.

export class ErrorIA extends Error {}

export function proveedorIA() {
  return config.ia.proveedor;
}

// Pide una respuesta en JSON. imagen: { datos: Buffer, tipo: 'image/png' } (opcional).
export async function preguntarIA(instrucciones, imagen) {
  const { proveedor } = config.ia;
  if (proveedor === 'ollama') return leerJson(await ollama(instrucciones, imagen));
  if (proveedor === 'gemini') return leerJson(await gemini(instrucciones, imagen));
  throw new ErrorIA('No hay una IA configurada (AI_PROVIDER en backend/.env).');
}

async function pedir(url, opciones) {
  let res;
  try {
    res = await fetch(url, { ...opciones, signal: AbortSignal.timeout(config.ia.tiempoMaximoMs) });
  } catch (e) {
    const motivo = e.name === 'TimeoutError' ? 'tardó demasiado en responder' : 'no respondió';
    throw new ErrorIA(`La IA ${motivo} (${config.ia.proveedor}).`);
  }
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = String(cuerpo.error?.message ?? cuerpo.error ?? `código ${res.status}`);
    const error = new ErrorIA(`La IA rechazó la consulta: ${detalle.slice(0, 200)}`);
    error.detalle = detalle;
    throw error;
  }
  return cuerpo;
}

async function ollama(instrucciones, imagen) {
  const { ollamaUrl, ollamaModelo } = config.ia;
  const mensaje = { role: 'user', content: instrucciones };
  if (imagen) mensaje.images = [imagen.datos.toString('base64')];
  const cuerpo = await pedir(`${ollamaUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ollamaModelo, messages: [mensaje], stream: false, format: 'json', options: { temperature: 0 } }),
  });
  return cuerpo.message?.content;
}

// Google retira modelos viejos (a veces solo para cuentas nuevas) y en el error dice cuál usar.
// Si pasa, se reintenta una vez con ese modelo, o con el alias del Flash vigente, y se sigue
// usando el que funcionó hasta que se reinicie la API.
let geminiReemplazo = null;

async function gemini(instrucciones, imagen) {
  const { geminiClave, geminiModelo } = config.ia;
  if (!geminiClave) throw new ErrorIA('Falta GEMINI_API_KEY en backend/.env.');
  const partes = [{ text: instrucciones }];
  if (imagen) partes.push({ inline_data: { mime_type: imagen.tipo, data: imagen.datos.toString('base64') } });
  const consultar = async (modelo) => {
    const cuerpo = await pedir(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiClave },
      body: JSON.stringify({
        contents: [{ parts: partes }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
    return cuerpo.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  };

  const modelo = geminiReemplazo ?? geminiModelo;
  try {
    return await consultar(modelo);
  } catch (e) {
    const otro = modeloDeReemplazo(e, modelo);
    if (!otro) throw e;
    console.warn(`Gemini: el modelo ${modelo} ya no está disponible; se usa ${otro}. Cambie GEMINI_MODEL en backend/.env.`);
    const texto = await consultar(otro);
    geminiReemplazo = otro;
    return texto;
  }
}

function modeloDeReemplazo(error, actual) {
  const detalle = error.detalle ?? '';
  if (!/no longer available|is not found|not supported for generateContent/i.test(detalle)) return null;
  const sugerido = detalle.match(/use models\/([\w.-]+)/i)?.[1];
  if (sugerido && sugerido !== actual) return sugerido;
  return actual === 'gemini-flash-latest' ? null : 'gemini-flash-latest';
}

// Los modelos a veces envuelven el JSON en ```json ... ```.
function leerJson(texto) {
  const limpio = String(texto ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const datos = JSON.parse(limpio);
    if (datos && typeof datos === 'object') return datos;
  } catch {
    // se informa abajo
  }
  throw new ErrorIA('La IA no devolvió una respuesta que se pueda leer.');
}
