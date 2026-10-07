import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { publicUser } from '../lib/auth.js';
import * as v from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Rutas del administrador: aprobación de docentes (RF-02).
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

// GET /api/admin/teachers?status=PENDING
adminRouter.get('/teachers', async (req, res) => {
  const estados = ['PENDING', 'ACTIVE', 'DISABLED'];
  const status = estados.includes(req.query.status) ? req.query.status : undefined;
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER', status },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ teachers: teachers.map(publicUser) });
});

async function cambiarEstado(req, res, status) {
  const teacher = await prisma.user.findUnique({ where: { id: v.id(req.params.id) } });
  if (!teacher || teacher.role !== 'TEACHER') throw new HttpError(404, 'Docente no encontrado.');
  const actualizado = await prisma.user.update({ where: { id: teacher.id }, data: { status } });
  res.json({ teacher: publicUser(actualizado) });
}

// POST /api/admin/teachers/:id/approve
adminRouter.post('/teachers/:id/approve', (req, res) => cambiarEstado(req, res, 'ACTIVE'));

// POST /api/admin/teachers/:id/disable (rechazar una solicitud o quitar el acceso)
adminRouter.post('/teachers/:id/disable', (req, res) => cambiarEstado(req, res, 'DISABLED'));
