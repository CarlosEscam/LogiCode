import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { parseRoster } from '../lib/roster.js';
import * as v from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Cursos y lista de cédulas habilitadas (RF-05).
export const coursesRouter = Router();
coursesRouter.use(requireAuth);

// El docente solo maneja sus cursos; el administrador, todos.
async function cursoPropio(req) {
  const course = await prisma.course.findUnique({ where: { id: v.id(req.params.id) } });
  if (!course) throw new HttpError(404, 'Curso no encontrado.');
  if (req.user.role !== 'ADMIN' && course.teacherId !== req.user.id) {
    throw new HttpError(403, 'Este curso no es suyo.');
  }
  return course;
}

// GET /api/courses: los cursos que ve el usuario según su rol.
coursesRouter.get('/', async (req, res) => {
  const where =
    req.user.role === 'ADMIN' ? {}
    : req.user.role === 'TEACHER' ? { teacherId: req.user.id }
    : { roster: { some: { userId: req.user.id } } };
  const courses = await prisma.course.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { teacher: { select: { fullName: true } }, _count: { select: { roster: true } } },
  });
  res.json({ courses });
});

// POST /api/courses { name, period }
coursesRouter.post('/', requireRole('TEACHER'), async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const period = String(req.body.period ?? '').trim();
  if (name.length < 3 || name.length > 150) throw new HttpError(400, 'Escriba el nombre del curso.');
  if (!/^\d{4}-[12]$/.test(period)) throw new HttpError(400, 'El periodo debe tener la forma 2026-2.');
  const course = await prisma.course.create({ data: { name, period, teacherId: req.user.id } });
  res.status(201).json({ course });
});

// GET /api/courses/:id/roster
coursesRouter.get('/:id/roster', requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const course = await cursoPropio(req);
  const roster = await prisma.rosterEntry.findMany({
    where: { courseId: course.id },
    orderBy: { cedula: 'asc' },
    include: { user: { select: { fullName: true, email: true } } },
  });
  res.json({
    roster: roster.map((r) => ({
      id: r.id,
      cedula: r.cedula,
      fullName: r.user?.fullName ?? r.fullName,
      email: r.user?.email ?? null,
      registered: r.userId !== null,
    })),
  });
});

// POST /api/courses/:id/roster { text }: agrega cédulas pegadas desde Excel o un .csv.
coursesRouter.post('/:id/roster', requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const course = await cursoPropio(req);
  const { entries, invalid } = parseRoster(req.body.text);
  if (entries.length === 0) throw new HttpError(400, 'No se encontró ninguna cédula válida.');

  const { count } = await prisma.rosterEntry.createMany({
    data: entries.map((e) => ({ ...e, courseId: course.id })),
    skipDuplicates: true,
  });

  // Si alguno ya tenía cuenta de estudiante (por ejemplo, de otro curso), queda enlazado.
  const cuentas = await prisma.user.findMany({
    where: { role: 'STUDENT', cedula: { in: entries.map((e) => e.cedula) } },
    select: { id: true, cedula: true },
  });
  for (const u of cuentas) {
    await prisma.rosterEntry.updateMany({
      where: { courseId: course.id, cedula: u.cedula, userId: null },
      data: { userId: u.id },
    });
  }

  res.status(201).json({ added: count, alreadyListed: entries.length - count, invalid });
});

// DELETE /api/courses/:id/roster/:entryId
coursesRouter.delete('/:id/roster/:entryId', requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  const course = await cursoPropio(req);
  const { count } = await prisma.rosterEntry.deleteMany({
    where: { id: v.id(req.params.entryId), courseId: course.id },
  });
  if (count === 0) throw new HttpError(404, 'La cédula no está en la lista.');
  res.status(204).end();
});
