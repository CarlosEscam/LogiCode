import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// La configuración se lee al importar la app: primero las variables como en Vercel.
process.env.CORS_ORIGIN = 'https://logicode.vercel.app, https://logicode-*-carlos.vercel.app/';
process.env.CRON_SECRET = 'clave-del-cron';
const { app } = await import('../src/app.js');
const { config } = await import('../src/config.js');
const { prisma } = await import('../src/lib/prisma.js');

after(() => prisma.$disconnect());

const permitido = async (origin) => (await request(app).get('/api/health').set('Origin', origin)).headers['access-control-allow-origin'];

test('CORS acepta varias direcciones y el * de las vistas previas', async () => {
  assert.equal(await permitido('https://logicode.vercel.app'), 'https://logicode.vercel.app');
  assert.equal(await permitido('https://logicode-abc123-carlos.vercel.app'), 'https://logicode-abc123-carlos.vercel.app');
  assert.equal(await permitido('https://otra.vercel.app'), undefined);
  assert.equal(await permitido('https://logicode.vercel.app.evil.com'), undefined);
});

test('APP_URL vacío usa la primera dirección de CORS_ORIGIN', () => {
  assert.equal(config.appUrl, 'https://logicode.vercel.app');
});

test('la tarea diaria solo corre con la clave de Vercel', async () => {
  assert.equal((await request(app).get('/api/cron/diario')).status, 401);
  assert.equal((await request(app).get('/api/cron/diario').set('Authorization', 'Bearer otra')).status, 401);
  const res = await request(app).get('/api/cron/diario').set('Authorization', 'Bearer clave-del-cron');
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.retomadas, 'number');
});
