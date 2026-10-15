import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Crea el primer administrador con los datos de backend/.env.
// Si ya existe un usuario con esa cédula, no hace nada.
const prisma = new PrismaClient();

const { SEED_ADMIN_CEDULA, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;

async function main() {
  if (!SEED_ADMIN_CEDULA || !SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.log('Seed omitido: complete las variables SEED_ADMIN_* en backend/.env.');
    return;
  }
  // Sin esto, copiar el ejemplo de la guía tal cual crea un administrador que no puede entrar.
  if (!/^\d{5,15}$/.test(SEED_ADMIN_CEDULA)) {
    throw new Error('SEED_ADMIN_CEDULA debe ser una cédula real: solo números, de 5 a 15 dígitos.');
  }
  if (SEED_ADMIN_PASSWORD.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres.');
  }
  const admin = await prisma.user.upsert({
    where: { cedula: SEED_ADMIN_CEDULA },
    update: {},
    create: {
      cedula: SEED_ADMIN_CEDULA,
      fullName: SEED_ADMIN_NAME,
      email: SEED_ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 12),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`Administrador listo: ${admin.fullName} (${admin.cedula})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
