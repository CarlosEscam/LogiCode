import crypto from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword, signSession } from '../src/lib/auth.js';

// Datos de prueba con cédulas aleatorias, para que los archivos de prueba
// puedan correr en paralelo sin chocar. cleanup() borra todo lo creado.
export const PASSWORD = 'clave-segura-123';
const creados = { users: [], courses: [] };

export function nuevaCedula() {
  return '9' + crypto.randomInt(1e9, 1e10 - 1);
}

export async function crearUsuario({ role = 'STUDENT', status = 'ACTIVE' } = {}) {
  const cedula = nuevaCedula();
  const user = await prisma.user.create({
    data: {
      cedula,
      fullName: `Prueba ${role} ${cedula}`,
      email: `${cedula}@prueba.test`,
      passwordHash: await hashPassword(PASSWORD),
      role,
      status,
    },
  });
  creados.users.push(user.id);
  return { user, token: signSession(user) };
}

export async function crearCurso(teacherId) {
  const course = await prisma.course.create({ data: { name: 'Curso de prueba', period: '2026-2', teacherId } });
  creados.courses.push(course.id);
  return course;
}

export function registrarUsuario(id) {
  creados.users.push(id);
}

export function registrarCurso(id) {
  creados.courses.push(id);
}

export async function cleanup() {
  await prisma.course.deleteMany({ where: { id: { in: creados.courses } } });
  // El foro guarda el autor sin borrado en cascada: se limpia antes que los usuarios.
  await prisma.forumPost.deleteMany({ where: { authorId: { in: creados.users } } });
  await prisma.forumThread.deleteMany({ where: { authorId: { in: creados.users } } });
  // El banco de preguntas es del docente y no se borra con el curso.
  await prisma.question.deleteMany({ where: { createdById: { in: creados.users } } });
  await prisma.user.deleteMany({ where: { id: { in: creados.users } } });
  await prisma.$disconnect();
}
