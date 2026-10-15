// Paso de compilación de la API en Vercel (Vercel corre "vercel-build" en vez de "build").
// En producción aplica las migraciones a Neon y crea el primer administrador (SEED_ADMIN_*).
// Las vistas previas de los PR no tocan la base.
import { execSync } from 'node:child_process';

const correr = (comando, env = {}) => execSync(comando, { stdio: 'inherit', env: { ...process.env, ...env } });

correr('npx prisma generate');

if (process.env.VERCEL_ENV === 'production') {
  // Las migraciones van por la conexión directa de Neon; la API usa la conexión con pooler.
  const directa = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  correr('npx prisma migrate deploy', { DATABASE_URL: directa });
  correr('node prisma/seed.js', { DATABASE_URL: directa });
} else {
  console.log(`Entorno ${process.env.VERCEL_ENV ?? 'local'}: no se aplican migraciones.`);
}
