import fs from 'node:fs';
import path from 'node:path';
import { AwsClient } from 'aws4fetch';
import { config } from '../config.js';

// Dónde viven los archivos subidos (material, entregas, fotos de perfil y videos).
// Con las variables R2_* van a Cloudflare R2; sin ellas, a la carpeta local de siempre.
// El nombre guardado en la base es el mismo en los dos casos, así que se puede pasar
// de uno a otro copiando los archivos (scripts/subir-archivos-r2.js).

const { claveId, claveSecreta, bucket, endpoint } = config.r2;
export const enR2 = Boolean(claveId && claveSecreta && bucket && endpoint);

const cliente = enR2
  ? new AwsClient({ accessKeyId: claveId, secretAccessKey: claveSecreta, service: 's3', region: 'auto' })
  : null;

// Los enlaces firmados de R2 duran una hora: alcanza para empezar a subir un video
// de 1 GB o para ver una clase completa (el reproductor ya tiene el enlace abierto).
const ENLACE_SEGUNDOS = 3600;

if (!enR2) {
  try {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  } catch (err) {
    // En un servidor sin disco escribible (Vercel) sin R2 configurado, las subidas fallarán,
    // pero el resto de la API debe seguir funcionando.
    console.error(`No se pudo crear la carpeta de archivos ${config.uploadDir}: ${err.message}`);
  }
}

// Se usa solo el último tramo del nombre, para que nadie pida "../.env".
const limpio = (nombre) => path.basename(String(nombre));

export function rutaLocal(nombre) {
  return path.join(config.uploadDir, limpio(nombre));
}

function urlObjeto(nombre, consulta = {}) {
  const url = new URL(`${endpoint}/${encodeURIComponent(bucket)}/${encodeURIComponent(limpio(nombre))}`);
  for (const [k, v] of Object.entries(consulta)) url.searchParams.set(k, v);
  return url;
}

// Un 404 al leer o borrar significa que el archivo no existe; al guardar, es un error (bucket mal escrito).
async function pedirR2(nombre, init = {}) {
  const res = await cliente.fetch(urlObjeto(nombre).toString(), init);
  if (!res.ok && (res.status !== 404 || init.method === 'PUT')) {
    let detalle = await res.text().catch(() => '');
    // Una respuesta a HEAD no trae cuerpo: se repite como GET de un byte para leer el motivo.
    if (!detalle && init.method === 'HEAD') {
      const otra = await cliente.fetch(urlObjeto(nombre).toString(), { headers: { Range: 'bytes=0-0' } });
      detalle = await otra.text().catch(() => '');
    }
    throw new Error(`R2 respondió ${res.status} con ${init.method ?? 'GET'} ${limpio(nombre)}: ${motivo(detalle)}`);
  }
  return res;
}

// R2 explica los errores en XML: <Code>...</Code><Message>...</Message>.
function motivo(xml) {
  const codigo = /<Code>([^<]*)<\/Code>/.exec(xml)?.[1];
  const mensaje = /<Message>([^<]*)<\/Message>/.exec(xml)?.[1];
  if (codigo || mensaje) return [codigo, mensaje].filter(Boolean).join(': ');
  return xml.slice(0, 300) || 'sin detalle';
}

// Guarda un archivo (Buffer) con el tipo con el que se servirá.
export async function guardar(nombre, datos, tipo = 'application/octet-stream') {
  if (!enR2) return fs.promises.writeFile(rutaLocal(nombre), datos);
  await pedirR2(nombre, { method: 'PUT', body: datos, headers: { 'Content-Type': tipo } });
}

// Lee el archivo completo. Lo usan el calificador (fotos, .psc, .sb3) y el editor de PSeInt.
export async function leer(nombre) {
  if (!enR2) return fs.promises.readFile(rutaLocal(nombre));
  const res = await pedirR2(nombre);
  if (res.status === 404) throw new Error(`El archivo ${limpio(nombre)} no está en R2.`);
  return Buffer.from(await res.arrayBuffer());
}

// Tamaño en bytes, o null si el archivo no existe.
export async function tamano(nombre) {
  if (!enR2) {
    try {
      return (await fs.promises.stat(rutaLocal(nombre))).size;
    } catch {
      return null;
    }
  }
  const res = await pedirR2(nombre, { method: 'HEAD' });
  return res.status === 404 ? null : Number(res.headers.get('content-length'));
}

// En la carpeta local revisa el disco. En R2 no consulta (sería una petición más por cada
// foto o descarga): si el archivo faltara, R2 responde 404 en el enlace.
export function existe(nombre) {
  return enR2 ? true : fs.existsSync(rutaLocal(nombre));
}

export async function borrar(nombre) {
  if (!nombre) return;
  if (!enR2) return fs.promises.rm(rutaLocal(nombre), { force: true });
  await pedirR2(nombre, { method: 'DELETE' });
}

async function firmar(url, metodo, headers = {}) {
  url.searchParams.set('X-Amz-Expires', String(ENLACE_SEGUNDOS));
  const firmado = await cliente.sign(url.toString(), { method: metodo, headers, aws: { signQuery: true } });
  return firmado.url;
}

// Enlace para que el navegador suba el archivo directo a R2 con un PUT.
// El navegador debe enviar el mismo Content-Type.
export function enlaceSubida(nombre, tipo) {
  return firmar(urlObjeto(nombre), 'PUT', { 'Content-Type': tipo });
}

// Enlace para ver o descargar el archivo directo desde R2, con el tipo y el nombre de descarga
// que pone la API (no los que haya mandado el navegador al subirlo).
export function enlaceDescarga(nombre, { tipo, nombreDescarga, enLinea = false } = {}) {
  // Sin espacios: así el enlace firmado no depende de cómo se codifique un espacio (+ o %20).
  const consulta = {};
  if (tipo) consulta['response-content-type'] = tipo.replace(/\s+/g, '');
  const archivo = nombreDescarga ?? limpio(nombre);
  // filename= lleva una versión sin tildes ni espacios; filename*= el nombre real en UTF-8.
  const simple = archivo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x21-\x7e]/g, '_').replace(/["\\;]/g, '') || 'archivo';
  consulta['response-content-disposition'] =
    `${enLinea ? 'inline' : 'attachment'};filename="${simple}";filename*=UTF-8''${encodeURIComponent(archivo)}`;
  return firmar(urlObjeto(nombre, consulta), 'GET');
}
