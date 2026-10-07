import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from './errors.js';

// Archivos de material de apoyo. Se guardan con un nombre aleatorio fuera de la
// carpeta pública; solo se descargan por la API, que revisa la visibilidad.
export const MAX_MB = 20;

// Formatos de las herramientas del curso y documentos comunes.
const EXTENSIONES = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.zip', '.psc', '.dfd', '.sb3', '.ino',
]);

fs.mkdirSync(config.uploadDir, { recursive: true });

export const uploadMaterial = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) => {
      cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase());
    },
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
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
  uploadMaterial(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const mensaje = err.code === 'LIMIT_FILE_SIZE' ? `El archivo supera ${MAX_MB} MB.` : 'No se pudo recibir el archivo.';
      return next(new HttpError(400, mensaje));
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
