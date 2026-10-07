import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

after(() => prisma.$disconnect());

test('GET /api/health responde ok con la base de datos conectada', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { estado: 'ok', baseDeDatos: 'conectada' });
});

test('una ruta inexistente responde 404 en JSON', async () => {
  const res = await request(app).get('/api/no-existe');
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Ruta no encontrada');
});
