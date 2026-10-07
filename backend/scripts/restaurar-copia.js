// Restaura una copia de seguridad de LogiCode. BORRA todo lo que hay en la base.
// Uso: npm run restaurar-copia -- copias/logicode-20261007-210000.json.gz
import path from 'node:path';
import readline from 'node:readline/promises';
import { restaurarCopia } from '../src/lib/copias.js';
import { prisma } from '../src/lib/prisma.js';

const archivo = process.argv[2];
if (!archivo) {
  console.log('Indique el archivo de la copia. Ejemplo:\n  npm run restaurar-copia -- copias/logicode-20261007-210000.json.gz');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const respuesta = await rl.question(
  `Se borrará todo lo que hay en la base y se cargará ${path.basename(archivo)}.\nEscriba SI para continuar: `,
);
rl.close();
if (respuesta.trim().toUpperCase() !== 'SI') {
  console.log('No se hizo nada.');
  process.exit(0);
}

try {
  const filas = await restaurarCopia(path.resolve(archivo));
  for (const [tabla, n] of Object.entries(filas)) console.log(`${tabla}: ${n}`);
  console.log('Copia restaurada.');
} catch (err) {
  console.error('No se pudo restaurar la copia:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
