import { Router } from 'express';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { retomarPendientes, esperarCola } from '../lib/calificador.js';

export const cronRouter = Router();

// Tareas programadas de Vercel (ver backend/vercel.json). Vercel las llama con
// "Authorization: Bearer CRON_SECRET"; sin esa clave no se ejecutan.
cronRouter.use((req, res, next) => {
  if (!config.cronSecret || req.get('authorization') !== `Bearer ${config.cronSecret}`) {
    throw new HttpError(401, 'No autorizado.');
  }
  next();
});

// GET /api/cron/diario: califica las entregas que quedaron sin calificar
// (en el PC esto lo hace server.js al arrancar).
cronRouter.get('/diario', async (req, res) => {
  const retomadas = await retomarPendientes();
  await esperarCola();
  res.json({ retomadas });
});
