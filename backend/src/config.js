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

// Direcciones de la web que pueden usar la API, separadas por comas.
// Un * vale por cualquier texto: https://logicode-*.vercel.app acepta las vistas previas de Vercel.
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  corsOrigins,
  // En Vercel la API corre como función: no hay disco que dure ni tareas cada hora.
  enVercel: Boolean(process.env.VERCEL),
  // Clave con la que Vercel llama a las tareas programadas (ver routes/cron.js).
  cronSecret: process.env.CRON_SECRET ?? '',
  // Carpeta donde se guardan los archivos subidos (por defecto backend/uploads).
  uploadDir: path.resolve(backendDir, process.env.UPLOAD_DIR ?? 'uploads'),
  // Cloudflare R2 para los archivos subidos (ver docs/archivos-en-r2.md). Si falta alguna
  // de estas variables, los archivos se guardan en uploadDir como siempre.
  r2: {
    // Sin espacios: al copiar y pegar desde Cloudflare es fácil que se cuele uno.
    cuenta: (process.env.R2_ACCOUNT_ID ?? '').trim(),
    claveId: (process.env.R2_ACCESS_KEY_ID ?? '').trim(),
    claveSecreta: (process.env.R2_SECRET_ACCESS_KEY ?? '').trim(),
    bucket: (process.env.R2_BUCKET ?? '').trim(),
    // Solo para pruebas con otro servicio compatible con S3; en R2 sale de la cuenta.
    endpoint: (process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID?.trim() ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com` : '')).replace(/\/+$/, ''),
  },
  // Carpeta de las copias de seguridad de la base (por defecto backend/copias).
  backupDir: path.resolve(backendDir, process.env.BACKUP_DIR ?? 'copias'),
  // Dirección de la web, para armar los enlaces de los correos.
  // En Vercel, por defecto, la dirección de producción del proyecto (web y API comparten dirección).
  appUrl: (
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : corsOrigins[0]) ||
    'http://localhost:3000'
  ).replace(/\/+$/, ''),
  // IA para calificar fotos y respuestas abiertas (ver lib/ia.js).
  ia: {
    proveedor: ['ollama', 'gemini'].includes(process.env.AI_PROVIDER) ? process.env.AI_PROVIDER : null,
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    ollamaModelo: process.env.OLLAMA_MODEL ?? 'qwen2.5vl:7b',
    geminiClave: process.env.GEMINI_API_KEY ?? '',
    // gemini-flash-latest es el alias de Google que siempre apunta al Flash vigente.
    geminiModelo: process.env.GEMINI_MODEL || 'gemini-flash-latest',
    // Con menos confianza que esto, la nota queda "en revisión" para el docente.
    confianzaMinima: Number(process.env.AI_MIN_CONFIDENCE ?? 0.75),
    tiempoMaximoMs: Number(process.env.AI_TIMEOUT_SECONDS ?? 180) * 1000,
  },
};
