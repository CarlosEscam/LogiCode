import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from './errors.js';

// Archivos de material de apoyo. Se guardan con un nombre aleatorio fuera de la
// carpeta pública; solo se descargan por la API, que revisa la visibilidad.
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

fs.mkdirSync(config.uploadDir, { recursive: true });

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

export const uploadMaterial = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) => {
      cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase());
    },
  }),
  // multer solo admite un límite: el de los videos. El de los demás archivos se revisa al terminar.
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    // multer entrega el nombre en latin1; se pasa a UTF-8 para conservar tildes.
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(file.originalname).toLowerCase();
    if (!EXTENSIONES.has(ext)) {
      return cb(new HttpError(400, `No se permiten archivos ${ext || 'sin extensión'}.`));
    }
    cb(null, true);
  },
}).single('file');

// Convierte los errores de multer (por ejemplo, archivo muy grande) en mensajes claros.
export function recibirArchivo(req, res, next) {
  uploadMaterial(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const mensaje = err.code === 'LIMIT_FILE_SIZE' ? `El archivo supera ${MAX_VIDEO_MB / 1024} GB.` : 'No se pudo recibir el archivo.';
      return next(new HttpError(400, mensaje));
    }
    if (!err && req.file && !esVideo(req.file.originalname) && req.file.size > MAX_MB * 1024 * 1024) {
      await borrarArchivo(req.file.filename);
      return next(new HttpError(400, `El archivo supera ${MAX_MB} MB.`));
    }
    next(err);
  });
}

export function rutaArchivo(nombreGuardado) {
  return path.join(config.uploadDir, path.basename(nombreGuardado));
}

export async function borrarArchivo(nombreGuardado) {
  if (!nombreGuardado) return;
  await fs.promises.rm(rutaArchivo(nombreGuardado), { force: true });
}
