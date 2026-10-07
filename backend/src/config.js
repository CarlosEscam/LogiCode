import 'dotenv/config';

// Variables de entorno. La app no arranca si falta alguna obligatoria.
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revise backend/.env (ver .env.example).`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  // Dirección de la web, para armar los enlaces de los correos.
  appUrl: process.env.APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};
