import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

// GET /api/health: confirma que la API está arriba y que responde la base de datos.
healthRouter.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ estado: 'ok', baseDeDatos: 'conectada' });
  } catch {
    res.status(503).json({ estado: 'error', baseDeDatos: 'sin conexión' });
  }
});
