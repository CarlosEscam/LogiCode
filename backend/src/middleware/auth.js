import { prisma } from '../lib/prisma.js';
import { readSession } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';

// Exige una sesión válida y deja el usuario en req.user.
// Se consulta la base en cada petición para que un usuario deshabilitado pierda el acceso de inmediato.
export async function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Inicie sesión para continuar.');

  let session;
  try {
    session = readSession(token);
  } catch {
    throw new HttpError(401, 'La sesión expiró. Ingrese de nuevo.');
  }

  const user = await prisma.user.findUnique({ where: { id: Number(session.sub) } });
  if (!user || user.status !== 'ACTIVE') throw new HttpError(401, 'La sesión ya no es válida.');
  req.user = user;
  next();
}

// Para rutas que también ven los visitantes: si hay una sesión válida deja req.user,
// y si no, sigue sin usuario.
export async function optionalAuth(req, res, next) {
  if (!req.get('authorization')) return next();
  try {
    await requireAuth(req, res, () => {});
  } catch {
    req.user = undefined;
  }
  next();
}

// Uso: router.get('/', requireAuth, requireRole('ADMIN'), ...)
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'No tiene permiso para esta acción.');
    next();
  };
}
