// Hace una copia de seguridad de la base en la carpeta de copias (BACKUP_DIR).
// La usa la copia diaria de GitHub (.github/workflows/copia-diaria.yml) contra Neon.
// Uso: npm run hacer-copia
import { hacerCopia } from '../src/lib/copias.js';
import { prisma } from '../src/lib/prisma.js';

try {
  const copia = await hacerCopia();
  console.log(`Copia guardada: ${copia.name} (${copia.size} bytes)`);
} catch (err) {
  console.error('No se pudo hacer la copia:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
