import { prisma } from './prisma.js';
import { HttpError } from './errors.js';

// Relación del usuario con un curso:
// 'owner'  = docente del curso o administrador (puede editar),
// 'member' = estudiante con su cédula en la lista del curso (puede ver),
// null     = sin acceso.
export async function courseAccess(user, courseId) {
  if (!user) return null;
  if (user.role === 'ADMIN') return 'owner';
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { teacherId: true } });
  if (!course) return null;
  if (course.teacherId === user.id) return 'owner';
  const enLista = await prisma.rosterEntry.findFirst({ where: { courseId, userId: user.id }, select: { id: true } });
  return enLista ? 'member' : null;
}

export async function requireCourse(user, courseId, nivel = 'member') {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Curso no encontrado.');
  const acceso = await courseAccess(user, courseId);
  if (!acceso || (nivel === 'owner' && acceso !== 'owner')) {
    throw new HttpError(403, 'No tiene permiso sobre este curso.');
  }
  return { course, acceso };
}
