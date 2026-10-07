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
  // IA para calificar fotos y respuestas abiertas (ver lib/ia.js).
  ia: {
    proveedor: ['ollama', 'gemini'].includes(process.env.AI_PROVIDER) ? process.env.AI_PROVIDER : null,
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    ollamaModelo: process.env.OLLAMA_MODEL ?? 'qwen2.5vl:7b',
    geminiClave: process.env.GEMINI_API_KEY ?? '',
    geminiModelo: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    // Con menos confianza que esto, la nota queda "en revisión" para el docente.
    confianzaMinima: Number(process.env.AI_MIN_CONFIDENCE ?? 0.75),
    tiempoMaximoMs: Number(process.env.AI_TIMEOUT_SECONDS ?? 180) * 1000,
  },
};
