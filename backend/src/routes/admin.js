import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { hashPassword, publicUser } from '../lib/auth.js';
import { sendMail } from '../lib/mailer.js';
import { hacerCopia, listarCopias, rutaCopia } from '../lib/copias.js';
import * as v from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Rutas del administrador: aprobación de docentes (RF-02), cuentas de usuario,
// vista de los cursos, estadísticas de la plataforma y copias de seguridad (RNF-07).
// El administrador no ve notas ni entregas (RNF-04): eso es del docente y el estudiante.
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

const ROLES = ['STUDENT', 'TEACHER', 'ADMIN'];
const ESTADOS = ['PENDING', 'ACTIVE', 'DISABLED'];
const POR_PAGINA = 25;
const RESET_MINUTES = 60;
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// ---------------------------------------------------------------------------
// Docentes pendientes
// ---------------------------------------------------------------------------

// GET /api/admin/teachers?status=PENDING
adminRouter.get('/teachers', async (req, res) => {
  const status = ESTADOS.includes(req.query.status) ? req.query.status : undefined;
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

// ---------------------------------------------------------------------------
// Resumen de la plataforma
// ---------------------------------------------------------------------------

// GET /api/admin/stats
adminRouter.get('/stats', async (req, res) => {
  const hace7dias = new Date(Date.now() - 7 * 24 * 3600_000);
  const [
    porRol,
    cursos,
    cedulas,
    registradas,
    temas,
    materiales,
    biblioteca,
    hilos,
    mensajes,
    quizzes,
    intentos,
    nuevos,
    ultimos,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role', 'status'], _count: { _all: true } }),
    prisma.course.count(),
    prisma.rosterEntry.count(),
    prisma.rosterEntry.count({ where: { userId: { not: null } } }),
    prisma.topic.count(),
    prisma.material.count(),
    prisma.material.count({ where: { visibility: 'PUBLIC' } }),
    prisma.forumThread.count(),
    prisma.forumPost.count({ where: { deletedAt: null } }),
    prisma.quiz.count({ where: { published: true } }),
    prisma.quizAttempt.count({ where: { submittedAt: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: hace7dias } } }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);

  const usuarios = Object.fromEntries(ROLES.map((r) => [r, { total: 0, PENDING: 0, ACTIVE: 0, DISABLED: 0 }]));
  for (const g of porRol) {
    usuarios[g.role][g.status] += g._count._all;
    usuarios[g.role].total += g._count._all;
  }

  res.json({
    users: usuarios,
    newUsersLast7Days: nuevos,
    courses: cursos,
    roster: { total: cedulas, registered: registradas },
    topics: temas,
    materials: { total: materiales, public: biblioteca },
    forum: { threads: hilos, posts: mensajes },
    quizzes: { published: quizzes, attemptsSubmitted: intentos },
    recentUsers: ultimos.map(usuarioAdmin),
  });
});

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

function usuarioAdmin(user) {
  return { ...publicUser(user), createdAt: user.createdAt };
}

async function buscarUsuario(req) {
  const user = await prisma.user.findUnique({ where: { id: v.id(req.params.id) } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado.');
  return user;
}

// GET /api/admin/users?q=&role=&status=&page=1
adminRouter.get('/users', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const where = {
    role: ROLES.includes(req.query.role) ? req.query.role : undefined,
    status: ESTADOS.includes(req.query.status) ? req.query.status : undefined,
    ...(q && {
      OR: [
        { cedula: { contains: q.replace(/[\s.]/g, '') } },
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);
  res.json({ users: users.map(usuarioAdmin), total, page, pages: Math.max(1, Math.ceil(total / POR_PAGINA)) });
});

// GET /api/admin/users/:id: la cuenta con sus cursos y su actividad (sin notas).
adminRouter.get('/users/:id', async (req, res) => {
  const user = await buscarUsuario(req);
  const [dicta, inscrito, hilos, mensajes, materiales] = await Promise.all([
    prisma.course.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, period: true },
    }),
    prisma.rosterEntry.findMany({
      where: { userId: user.id },
      include: { course: { select: { id: true, name: true, period: true } } },
    }),
    prisma.forumThread.count({ where: { authorId: user.id } }),
    prisma.forumPost.count({ where: { authorId: user.id, deletedAt: null } }),
    prisma.material.count({ where: { uploadedById: user.id } }),
  ]);
  res.json({
    user: usuarioAdmin(user),
    coursesTaught: dicta,
    coursesEnrolled: inscrito.map((r) => r.course),
    activity: { forumThreads: hilos, forumPosts: mensajes, materials: materiales },
  });
});

// Debe quedar al menos un administrador activo, para que nadie pierda el control de la plataforma.
async function quedaOtroAdmin(userId) {
  const otros = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE', id: { not: userId } } });
  return otros > 0;
}

// PATCH /api/admin/users/:id { fullName?, email?, role?, status? }
adminRouter.patch('/users/:id', async (req, res) => {
  const user = await buscarUsuario(req);
  const b = req.body;
  const data = {};

  if (b.fullName !== undefined) data.fullName = v.nombre(b.fullName);
  if (b.email !== undefined) {
    data.email = v.email(b.email);
    const otro = await prisma.user.findFirst({ where: { email: data.email, id: { not: user.id } } });
    if (otro) throw new HttpError(409, 'Ya existe otra cuenta con ese correo.');
  }
  if (b.role !== undefined && b.role !== user.role) {
    if (!ROLES.includes(b.role)) throw new HttpError(400, 'Rol no válido.');
    if (user.id === req.user.id) throw new HttpError(400, 'No puede cambiar su propio rol.');
    if (user.role === 'ADMIN' && !(await quedaOtroAdmin(user.id))) {
      throw new HttpError(400, 'Debe quedar al menos un administrador activo.');
    }
    if (user.role === 'TEACHER' && (await prisma.course.count({ where: { teacherId: user.id } })) > 0) {
      throw new HttpError(400, 'Este docente tiene cursos. Asigne los cursos a otro docente antes de cambiarle el rol.');
    }
    data.role = b.role;
  }
  if (b.status !== undefined && b.status !== user.status) {
    if (!ESTADOS.includes(b.status)) throw new HttpError(400, 'Estado no válido.');
    if (user.id === req.user.id) throw new HttpError(400, 'No puede deshabilitar su propia cuenta.');
    if (user.role === 'ADMIN' && b.status !== 'ACTIVE' && !(await quedaOtroAdmin(user.id))) {
      throw new HttpError(400, 'Debe quedar al menos un administrador activo.');
    }
    data.status = b.status;
  }

  const actualizado = await prisma.user.update({ where: { id: user.id }, data });
  res.json({ user: usuarioAdmin(actualizado) });
});

// POST /api/admin/users/:id/reset-password { mode: 'link' | 'temporary' }
// link: envía al correo el mismo enlace de "olvidé mi contraseña".
// temporary: crea una contraseña temporal y la devuelve una sola vez, para entregarla en persona.
adminRouter.post('/users/:id/reset-password', async (req, res) => {
  const user = await buscarUsuario(req);
  if (req.body.mode === 'temporary') {
    const temporal = crypto.randomBytes(9).toString('base64url');
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(temporal) } }),
      prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    return res.json({ temporaryPassword: temporal, mensaje: 'Entregue esta contraseña a la persona; no se volverá a mostrar.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
  });
  await sendMail({
    to: user.email,
    subject: 'Restablecer contraseña de LogiCode',
    text: `Hola ${user.fullName}. Un administrador pidió restablecer su contraseña. Abra este enlace para crear una nueva (vence en ${RESET_MINUTES} minutos):\n${config.appUrl}/restablecer?token=${token}`,
  });
  res.json({ mensaje: `Enviamos el enlace a ${user.email}.` });
});

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

// GET /api/admin/courses: todos los cursos con su docente y cuántos estudiantes tienen.
adminRouter.get('/courses', async (req, res) => {
  const cursos = await prisma.course.findMany({
    orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    include: {
      teacher: { select: { id: true, fullName: true, cedula: true } },
      _count: { select: { roster: true, topics: true, materials: true, quizzes: true } },
    },
  });
  const registrados = await prisma.rosterEntry.groupBy({
    by: ['courseId'],
    where: { userId: { not: null } },
    _count: { _all: true },
  });
  const porCurso = Object.fromEntries(registrados.map((r) => [r.courseId, r._count._all]));
  res.json({
    courses: cursos.map((c) => ({
      id: c.id,
      name: c.name,
      period: c.period,
      createdAt: c.createdAt,
      teacher: c.teacher,
      counts: {
        roster: c._count.roster,
        registered: porCurso[c.id] ?? 0,
        topics: c._count.topics,
        materials: c._count.materials,
        quizzes: c._count.quizzes,
      },
    })),
  });
});

// PATCH /api/admin/courses/:id { teacherId }: pasa el curso a otro docente activo.
adminRouter.patch('/courses/:id', async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: v.id(req.params.id) } });
  if (!course) throw new HttpError(404, 'Curso no encontrado.');
  const docente = await prisma.user.findUnique({ where: { id: v.id(req.body.teacherId) } });
  if (!docente || docente.role !== 'TEACHER' || docente.status !== 'ACTIVE') {
    throw new HttpError(400, 'Elija un docente con la cuenta activa.');
  }
  const actualizado = await prisma.course.update({
    where: { id: course.id },
    data: { teacherId: docente.id },
    include: { teacher: { select: { id: true, fullName: true, cedula: true } } },
  });
  res.json({ course: actualizado });
});

// ---------------------------------------------------------------------------
// Copias de seguridad (RNF-07)
// ---------------------------------------------------------------------------

// GET /api/admin/backups
adminRouter.get('/backups', async (req, res) => {
  res.json({ backups: await listarCopias() });
});

// POST /api/admin/backups: hace una copia ahora.
adminRouter.post('/backups', async (req, res) => {
  res.status(201).json({ backup: await hacerCopia() });
});

// GET /api/admin/backups/:name: descarga una copia.
adminRouter.get('/backups/:name', async (req, res) => {
  const ruta = rutaCopia(req.params.name);
  if (!ruta) throw new HttpError(404, 'Copia no encontrada.');
  res.download(ruta, req.params.name, { headers: { 'Content-Type': 'application/gzip' } });
});
