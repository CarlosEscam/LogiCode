import crypto from 'node:crypto';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from './errors.js';
import { borrar, enR2, enlaceDescarga, enlaceSubida, existe, guardar, rutaLocal, tamano } from './almacen.js';

// Archivos de material de apoyo. Se guardan con un nombre aleatorio fuera de la
// carpeta pública; solo se descargan por la API, que revisa la visibilidad.
// Dónde quedan (carpeta local o Cloudflare R2) lo decide lib/almacen.js.
export const MAX_MB = 20;
// Las clases grabadas pesan mucho más que un documento. La web usa los mismos límites.
export const MAX_VIDEO_MB = 1024;
const VIDEOS = new Set(['.mp4', '.webm']);

// Formatos de las herramientas del curso y documentos comunes.
const EXTENSIONES = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.zip', '.psc', '.dfd', '.sb3', '.ino',
  ...VIDEOS,
]);

// Tipo con el que se sirve cada archivo. Sale de la extensión y no del tipo que
// declaró el navegador al subirlo, para que nadie pueda hacer pasar un archivo
// por una página web. Lo que no está aquí se entrega como binario genérico.
const TIPOS = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.psc': 'text/plain; charset=utf-8',
  '.ino': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

export function esVideo(nombre) {
  return VIDEOS.has(path.extname(String(nombre ?? '')).toLowerCase());
}

export function tipoDeArchivo(nombre) {
  return TIPOS[path.extname(String(nombre ?? '')).toLowerCase()] ?? 'application/octet-stream';
}

// Archivos y fotos de las entregas de los estudiantes: los mismos formatos del material,
// sin videos, hasta 20 MB.
const ENTREGAS = new Set([...EXTENSIONES].filter((e) => !VIDEOS.has(e)));
export const IMAGENES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

export const nombreAleatorio = (original) => crypto.randomBytes(16).toString('hex') + path.extname(original).toLowerCase();

// Qué admite cada destino. "material" lo suben docentes y administradores.
const DESTINOS = {
  material: {
    extensiones: EXTENSIONES,
    maximo: (nombre) => (esVideo(nombre) ? MAX_VIDEO_MB : MAX_MB),
    mensaje: (nombre) => (esVideo(nombre) ? `El archivo supera ${MAX_VIDEO_MB / 1024} GB.` : `El archivo supera ${MAX_MB} MB.`),
    roles: ['TEACHER', 'ADMIN'],
  },
  entrega: {
    extensiones: ENTREGAS,
    maximo: () => MAX_MB,
    mensaje: () => `El archivo supera ${MAX_MB} MB.`,
  },
};

function revisarExtension(destino, nombre) {
  const ext = path.extname(nombre).toLowerCase();
  if (!DESTINOS[destino].extensiones.has(ext)) throw new HttpError(400, `No se permiten archivos ${ext || 'sin extensión'}.`);
}

// --- Subida directa a R2 ------------------------------------------------------------
// Los videos pesan hasta 1 GB y en Vercel la API no recibe más de 4,5 MB por petición,
// así que con R2 el navegador sube el archivo directo con un enlace firmado y después
// le pasa a la API el comprobante ("subida") en lugar del archivo.

const claveSubidas = () => `${config.jwtSecret}:subidas`;
const SUBIDA_HORAS = 6;

// Prepara la subida: revisa permisos, formato y tamaño, y devuelve el enlace firmado.
// Sin R2 responde { directo: false } y la web envía el archivo a la API como siempre.
export async function prepararSubida(user, { destino, nombre, tamano: bytes }) {
  if (!DESTINOS[destino]) throw new HttpError(400, 'Destino de la subida no válido.');
  const regla = DESTINOS[destino];
  if (regla.roles && !regla.roles.includes(user.role)) throw new HttpError(403, 'No tiene permiso para subir este archivo.');
  const original = String(nombre ?? '').trim().slice(0, 255);
  if (!original) throw new HttpError(400, 'Falta el nombre del archivo.');
  revisarExtension(destino, original);
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, 'El archivo está vacío.');
  if (n > regla.maximo(original) * 1024 * 1024) throw new HttpError(400, regla.mensaje(original));
  if (!enR2) return { directo: false };

  const guardado = nombreAleatorio(original);
  const tipo = tipoDeArchivo(original);
  const subida = jwt.sign({ k: guardado, n: original, d: destino, sub: String(user.id) }, claveSubidas(), {
    expiresIn: `${SUBIDA_HORAS}h`,
  });
  return { directo: true, url: await enlaceSubida(guardado, tipo), headers: { 'Content-Type': tipo }, subida };
}

// Convierte el comprobante de una subida directa en req.file, igual que si multer lo hubiera recibido.
async function confirmarSubida(req, destino) {
  let datos;
  try {
    datos = jwt.verify(String(req.body.subida), claveSubidas());
  } catch {
    throw new HttpError(400, 'La subida venció. Elija el archivo otra vez.');
  }
  if (datos.d !== destino || datos.sub !== String(req.user?.id)) throw new HttpError(400, 'La subida no es de este formulario.');
  const bytes = await tamano(datos.k);
  if (bytes === null) throw new HttpError(400, 'El archivo no terminó de subir. Intente de nuevo.');
  if (bytes > DESTINOS[destino].maximo(datos.n) * 1024 * 1024) {
    await borrar(datos.k);
    throw new HttpError(400, DESTINOS[destino].mensaje(datos.n));
  }
  req.file = { filename: datos.k, originalname: datos.n, size: bytes, mimetype: tipoDeArchivo(datos.n) };
}

// --- Subida por la API (multipart) ------------------------------------------------------
// Sin R2 el archivo va al disco. Con R2 se recibe en memoria y se pasa a R2; solo sirve para
// archivos pequeños (en Vercel, hasta 4,5 MB): la web usa la subida directa.

function receptor(destino, campo = 'file') {
  return multer({
    storage: enR2
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: config.uploadDir,
          filename: (req, file, cb) => cb(null, nombreAleatorio(file.originalname)),
        }),
    // multer solo admite un límite: el mayor. El de cada formato se revisa al terminar.
    limits: { fileSize: (enR2 ? MAX_MB : destino === 'material' ? MAX_VIDEO_MB : MAX_MB) * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      // multer entrega el nombre en latin1; se pasa a UTF-8 para conservar tildes.
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      try {
        revisarExtension(destino, file.originalname);
        cb(null, true);
      } catch (err) {
        cb(err);
      }
    },
  }).single(campo);
}

function recibir(destino) {
  const subir = receptor(destino);
  const regla = DESTINOS[destino];
  return (req, res, next) => {
    subir(req, res, async (err) => {
      try {
        if (err instanceof multer.MulterError) {
          if (err.code !== 'LIMIT_FILE_SIZE') throw new HttpError(400, 'No se pudo recibir el archivo.');
          // Sin R2 el límite de multer es el de los videos; con R2, el de los demás archivos.
          throw new HttpError(400, regla.mensaje(destino === 'material' && !enR2 ? 'video.mp4' : 'archivo'));
        }
        if (err) throw err;
        if (req.file?.buffer) {
          req.file.filename = nombreAleatorio(req.file.originalname);
          await guardar(req.file.filename, req.file.buffer, tipoDeArchivo(req.file.originalname));
          delete req.file.buffer;
        } else if (!req.file && req.body.subida) {
          await confirmarSubida(req, destino);
        }
        if (req.file && req.file.size > regla.maximo(req.file.originalname) * 1024 * 1024) {
          const { filename, originalname } = req.file;
          req.file = undefined;
          await borrarArchivo(filename);
          throw new HttpError(400, regla.mensaje(originalname));
        }
        next();
      } catch (e) {
        next(e);
      }
    });
  };
}

// Middlewares de las rutas: dejan el archivo en req.file (filename es el nombre guardado)
// y convierten los errores de multer (por ejemplo, archivo muy grande) en mensajes claros.
export const recibirArchivo = recibir('material');
export const recibirEntrega = recibir('entrega');

// --- Ver y descargar ------------------------------------------------------------------

// Ruta en la carpeta local. Con R2 no hay archivo local: use leer() de lib/almacen.js.
export function rutaArchivo(nombreGuardado) {
  return rutaLocal(nombreGuardado);
}

export async function borrarArchivo(nombreGuardado) {
  await borrar(nombreGuardado);
}

export { existe as existeArchivo };

// Envía un archivo ya autorizado. En la carpeta local lo entrega la API (admite rangos para
// adelantar videos). En R2 la API no lo pasa por ella: con redirigir responde 302 al enlace
// firmado (imágenes, videos y descargas del navegador) y, si no, { url } en JSON para que la
// web lo pida con fetch sin la sesión.
export async function enviarArchivo(res, nombreGuardado, { nombreDescarga, redirigir = false, enLinea = false, cabeceras = {} } = {}) {
  const tipo = tipoDeArchivo(nombreDescarga ?? nombreGuardado);
  if (enR2) {
    const url = await enlaceDescarga(nombreGuardado, { tipo, nombreDescarga, enLinea });
    if (!redirigir) return res.json({ url });
    // El enlace vence en una hora; el navegador puede reutilizar la redirección unos minutos.
    res.set('Cache-Control', 'private, max-age=300');
    return res.redirect(302, url);
  }
  const headers = { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff', ...cabeceras };
  if (enLinea) return res.sendFile(rutaLocal(nombreGuardado), { headers });
  res.download(rutaLocal(nombreGuardado), nombreDescarga ?? path.basename(nombreGuardado), { headers });
}
