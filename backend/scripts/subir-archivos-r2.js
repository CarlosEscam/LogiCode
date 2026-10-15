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
  }
}

console.log(`\nListo: ${subidos} subidos, ${saltados} ya estaban en R2, ${fallidos} con error (de ${nombres.length}).`);
process.exit(fallidos ? 1 : 0);
