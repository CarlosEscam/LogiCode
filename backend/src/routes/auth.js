import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { hashPassword, checkPassword, signSession, publicUser } from '../lib/auth.js';
import { sendMail } from '../lib/mailer.js';
import * as v from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const RESET_MINUTES = 60;
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// POST /api/auth/register (RF-01, RF-02)
// Estudiante: solo si su cédula está en la lista de algún curso; queda activo.
// Docente: queda pendiente hasta que un administrador lo apruebe.
authRouter.post('/register', async (req, res) => {
  const cedula = v.cedula(req.body.cedula);
  const fullName = v.nombre(req.body.fullName);
  const email = v.email(req.body.email);
  const password = v.password(req.body.password);
  const role = req.body.role === 'TEACHER' ? 'TEACHER' : 'STUDENT';

  const existente = await prisma.user.findFirst({ where: { OR: [{ cedula }, { email }] } });
  if (existente) {
    const campo = existente.cedula === cedula ? 'cédula' : 'correo';
    throw new HttpError(409, `Ya existe una cuenta con ese ${campo}.`);
  }

  if (role === 'STUDENT') {
    const habilitada = await prisma.rosterEntry.findFirst({ where: { cedula } });
    if (!habilitada) {
      throw new HttpError(403, 'Su cédula no está habilitada. Pida a su docente que la agregue a la lista del curso.');
    }
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const creado = await tx.user.create({
      data: { cedula, fullName, email, passwordHash, role, status: role === 'TEACHER' ? 'PENDING' : 'ACTIVE' },
    });
    if (role === 'STUDENT') {
      await tx.rosterEntry.updateMany({ where: { cedula, userId: null }, data: { userId: creado.id } });
    }
    return creado;
  });

  if (user.status === 'PENDING') {
    return res.status(201).json({
      user: publicUser(user),
      mensaje: 'Cuenta creada. Podrá ingresar cuando un administrador apruebe su cuenta de docente.',
    });
  }
  res.status(201).json({ user: publicUser(user), token: signSession(user) });
});

// POST /api/auth/login (RF-03)
authRouter.post('/login', async (req, res) => {
  const cedula = String(req.body.cedula ?? '').replace(/[\s.]/g, '');
  const password = String(req.body.password ?? '');
  const user = cedula ? await prisma.user.findUnique({ where: { cedula } }) : null;

  // Mismo mensaje para cédula o contraseña incorrecta, para no revelar qué cédulas existen.
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Cédula o contraseña incorrecta.');
  }
  if (user.status === 'PENDING') throw new HttpError(403, 'Su cuenta de docente está pendiente de aprobación.');
  if (user.status === 'DISABLED') throw new HttpError(403, 'Su cuenta está deshabilitada. Comuníquese con un administrador.');

  res.json({ user: publicUser(user), token: signSession(user) });
});

// GET /api/auth/me: datos del usuario de la sesión actual.
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// POST /api/auth/forgot-password (RF-04). Recibe cédula o correo.
// Siempre responde lo mismo, exista o no la cuenta.
authRouter.post('/forgot-password', async (req, res) => {
  const dato = String(req.body.cedulaOrEmail ?? '').trim().toLowerCase();
  const user = dato
    ? await prisma.user.findFirst({ where: { OR: [{ cedula: dato.replace(/[\s.]/g, '') }, { email: dato }] } })
    : null;

  if (user && user.status !== 'DISABLED') {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
    });
    await sendMail({
      to: user.email,
      subject: 'Recuperar contraseña de LogiCode',
      text: `Hola ${user.fullName}. Para crear una contraseña nueva abra este enlace (vence en ${RESET_MINUTES} minutos):\n${config.appUrl}/restablecer?token=${token}`,
    });
  }
  res.json({ mensaje: 'Si la cuenta existe, enviamos un enlace al correo registrado.' });
});

// POST /api/auth/reset-password: token del enlace + contraseña nueva.
authRouter.post('/reset-password', async (req, res) => {
  const token = String(req.body.token ?? '');
  const password = v.password(req.body.password);
  const registro = token
    ? await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } })
    : null;
  if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
    throw new HttpError(400, 'El enlace no es válido o ya venció. Solicite uno nuevo.');
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: registro.userId }, data: { passwordHash } }),
    // Al usar un enlace se invalidan también los demás que estuvieran pendientes.
    prisma.passwordResetToken.updateMany({
      where: { userId: registro.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  res.json({ mensaje: 'Contraseña actualizada. Ya puede ingresar.' });
});
