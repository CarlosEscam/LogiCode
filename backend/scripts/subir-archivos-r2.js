// Copia a Cloudflare R2 los archivos que ya están en la carpeta local (backend/uploads):
// material, entregas, fotos de perfil y videos. Se corre una vez, con las variables R2_*
// en backend/.env, antes de publicar en Vercel:
//
//   npm run subir-archivos-r2
//
// Los archivos conservan su nombre, así que la base no cambia. Los que ya están en R2 se
// saltan, así que se puede volver a correr si se corta. No borra nada de la carpeta local.
import fs from 'node:fs';
import { config } from '../src/config.js';
import { enR2, guardar, rutaLocal, tamano } from '../src/lib/almacen.js';
import { tipoDeArchivo } from '../src/lib/uploads.js';

if (!enR2) {
  console.error('Faltan las variables R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY o R2_BUCKET en backend/.env.');
  process.exit(1);
}

// Revisa el formato de las claves sin mostrarlas. En R2 el Account ID y el Access Key ID
// tienen 32 letras y números (0-9, a-f) y el Secret Access Key, 64. Un token de la API de
// Cloudflare (el que empieza distinto y se usa con "Bearer") no sirve aquí.
const { cuenta, claveId, claveSecreta, bucket } = config.r2;
const problemas = [];
const revisar = (nombre, valor, largo) => {
  if (!/^[0-9a-f]+$/i.test(valor) || valor.length !== largo) {
    problemas.push(`${nombre} tiene ${valor.length} caracteres${/^[0-9a-f]*$/i.test(valor) ? '' : ' y alguno que no es 0-9 o a-f'}; debe tener ${largo} (solo 0-9 y a-f).`);
  }
};
if (!process.env.R2_ENDPOINT) revisar('R2_ACCOUNT_ID', cuenta, 32);
revisar('R2_ACCESS_KEY_ID', claveId, 32);
revisar('R2_SECRET_ACCESS_KEY', claveSecreta, 64);
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) problemas.push(`R2_BUCKET "${bucket}" no es un nombre de bucket válido (minúsculas, números y guiones).`);
if (problemas.length) {
  console.error('Revise backend/.env (ver docs/archivos-en-r2.md, paso 3):');
  for (const p of problemas) console.error(`- ${p}`);
  process.exit(1);
}
console.log(`Bucket ${bucket} en ${config.r2.endpoint}\n`);

let nombres;
try {
  nombres = fs.readdirSync(config.uploadDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
} catch {
  console.error(`No se encontró la carpeta ${config.uploadDir}.`);
  process.exit(1);
}

let subidos = 0;
let saltados = 0;
let fallidos = 0;
for (const nombre of nombres) {
  try {
    const local = fs.statSync(rutaLocal(nombre)).size;
    if ((await tamano(nombre)) === local) {
      saltados++;
      continue;
    }
    await guardar(nombre, await fs.promises.readFile(rutaLocal(nombre)), tipoDeArchivo(nombre));
    subidos++;
    console.log(`Subido ${nombre} (${(local / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    fallidos++;
    console.error(`No se pudo subir ${nombre}: ${err.message}`);
    // Si falla el primero, fallarán todos por lo mismo: no se repite el error.
    if (subidos + saltados === 0) {
      console.error('\nSe detuvo en el primer archivo. Revise las variables R2_* con docs/archivos-en-r2.md.');
      process.exit(1);
    }
  }
}

console.log(`\nListo: ${subidos} subidos, ${saltados} ya estaban en R2, ${fallidos} con error (de ${nombres.length}).`);
process.exit(fallidos ? 1 : 0);
