import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Variables de entorno. La app no arranca si falta alguna obligatoria.
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revise backend/.env (ver .env.example).`);
  }
  return value;
}

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  // Carpeta donde se guardan los archivos subidos (por defecto backend/uploads).
  uploadDir: path.resolve(backendDir, process.env.UPLOAD_DIR ?? 'uploads'),
  // Dirección de la web, para armar los enlaces de los correos.
  appUrl: process.env.APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};
