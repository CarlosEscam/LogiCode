import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { TOOLS } from '../lib/material.js';
import * as v from '../lib/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

// Foro (RF-21 a RF-23): cualquier visitante lee; para escribir hay que iniciar sesión.
// Docentes y administradores moderan: fijan, cierran y borran temas, y ocultan mensajes.
export const forumRouter = Router();

const POR_PAGINA = 20;
const autor = { select: { id: true, fullName: true, role: true } };

const esModerador = (user) => Boolean(user) && (user.role === 'TEACHER' || user.role === 'ADMIN');

function titulo(value) {
  const limpio = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (limpio.length < 5 || limpio.length > 200) throw new HttpError(400, 'El título debe tener entre 5 y 200 caracteres.');
  return limpio;
}

function mensaje(value) {
  const limpio = String(value ?? '').trim();
  if (!limpio) throw new HttpError(400, 'Escriba el mensaje.');
  if (limpio.length > 10_000) throw new HttpError(400, 'El mensaje no puede pasar de 10.000 caracteres.');
  return limpio;
}

function categoria(value) {
  if (!TOOLS.includes(value)) throw new HttpError(400, 'Categoría no válida.');
  return value;
}

// Un mensaje borrado se muestra como "mensaje eliminado"; solo los moderadores ven su texto.
function publicPost(p, user) {
  const borrado = p.deletedAt !== null;
  return {
    id: p.id,
    body: borrado && !esModerador(user) ? null : p.body,
    author: p.author,
    createdAt: p.createdAt,
    editedAt: p.editedAt,
    deleted: borrado,
    canEdit: !borrado && user?.id === p.authorId,
    canDelete: !borrado && (user?.id === p.authorId || esModerador(user)),
  };
}

async function buscarTema(id) {
  const thread = await prisma.forumThread.findUnique({ where: { id: v.id(id) } });
  if (!thread) throw new HttpError(404, 'Tema no encontrado.');
  return thread;
}

// GET /api/forum: resumen de cada categoría (temas, mensajes y última actividad).
forumRouter.get('/', optionalAuth, async (req, res) => {
  const [temas, mensajes] = await Promise.all([
    prisma.forumThread.groupBy({ by: ['category'], _count: { _all: true }, _max: { lastPostAt: true } }),
    prisma.$queryRaw`
      SELECT t."category", COUNT(p."id")::int AS "posts"
      FROM "ForumPost" p JOIN "ForumThread" t ON t."id" = p."threadId"
      WHERE p."deletedAt" IS NULL
      GROUP BY t."category"`,
  ]);
  res.json({
    canModerate: esModerador(req.user),
    categories: TOOLS.map((c) => {
      const t = temas.find((x) => x.category === c);
      return {
        category: c,
        threads: t?._count._all ?? 0,
        posts: mensajes.find((x) => x.category === c)?.posts ?? 0,
        lastPostAt: t?._max.lastPostAt ?? null,
      };
    }),
  });
});

// GET /api/forum/threads?category=PSEINT&q=texto&page=1
forumRouter.get('/threads', optionalAuth, async (req, res) => {
  const where = {};
  if (req.query.category) where.category = categoria(req.query.category);
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { posts: { some: { deletedAt: null, body: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  const total = await prisma.forumThread.count({ where });
  const pages = Math.max(1, Math.ceil(total / POR_PAGINA));
  const page = Math.min(Math.max(1, Number.parseInt(req.query.page, 10) || 1), pages);
  const threads = await prisma.forumThread.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { lastPostAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * POR_PAGINA,
    take: POR_PAGINA,
    include: { author: autor, _count: { select: { posts: { where: { deletedAt: null } } } } },
  });
  res.json({
    page,
    pages,
    total,
    canModerate: esModerador(req.user),
    threads: threads.map(({ _count, authorId, ...t }) => ({ ...t, replies: Math.max(0, _count.posts - 1) })),
  });
});

// POST /api/forum/threads { category, title, body }: el body es el primer mensaje.
forumRouter.post('/threads', requireAuth, async (req, res) => {
  const data = { category: categoria(req.body.category ?? 'GENERAL'), title: titulo(req.body.title) };
  const body = mensaje(req.body.body);
  const thread = await prisma.forumThread.create({
    data: { ...data, authorId: req.user.id, posts: { create: { body, authorId: req.user.id } } },
  });
  res.status(201).json({ thread });
});

// GET /api/forum/threads/:id: el tema con todos sus mensajes en orden.
forumRouter.get('/threads/:id', optionalAuth, async (req, res) => {
  const encontrado = await prisma.forumThread.findUnique({ where: { id: v.id(req.params.id) }, include: { author: autor } });
  if (!encontrado) throw new HttpError(404, 'Tema no encontrado.');
  const { authorId, ...thread } = encontrado;
  const posts = await prisma.forumPost.findMany({
    where: { threadId: thread.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { author: autor },
  });
  const moderador = esModerador(req.user);
  res.json({
    thread,
    posts: posts.map((p) => publicPost(p, req.user)),
    canReply: Boolean(req.user) && (!thread.isClosed || moderador),
    canModerate: moderador,
    canEditTitle: moderador || req.user?.id === authorId,
    canDelete: moderador || (req.user?.id === authorId && posts.every((p) => p.authorId === authorId)),
  });
});

// PATCH /api/forum/threads/:id { title?, category?, isPinned?, isClosed? }
// El autor puede corregir el título; lo demás es de los moderadores.
forumRouter.patch('/threads/:id', requireAuth, async (req, res) => {
  const thread = await buscarTema(req.params.id);
  const moderador = esModerador(req.user);
  const data = {};
  if (req.body.title !== undefined) {
    if (!moderador && thread.authorId !== req.user.id) throw new HttpError(403, 'Solo el autor o un moderador cambia el título.');
    data.title = titulo(req.body.title);
  }
  for (const campo of ['category', 'isPinned', 'isClosed']) {
    if (req.body[campo] === undefined) continue;
    if (!moderador) throw new HttpError(403, 'Solo los docentes y administradores moderan el foro.');
    data[campo] = campo === 'category' ? categoria(req.body.category) : Boolean(req.body[campo]);
  }
  const actualizado = await prisma.forumThread.update({ where: { id: thread.id }, data });
  res.json({ thread: actualizado });
});

// DELETE /api/forum/threads/:id: lo borra un moderador, o el autor si nadie le ha respondido.
forumRouter.delete('/threads/:id', requireAuth, async (req, res) => {
  const thread = await buscarTema(req.params.id);
  if (!esModerador(req.user)) {
    const ajenos = await prisma.forumPost.count({ where: { threadId: thread.id, authorId: { not: req.user.id } } });
    if (thread.authorId !== req.user.id || ajenos > 0) {
      throw new HttpError(403, 'Solo un moderador puede borrar un tema que ya tiene respuestas.');
    }
  }
  await prisma.forumThread.delete({ where: { id: thread.id } });
  res.status(204).end();
});

// POST /api/forum/threads/:id/posts { body }: responder. Un tema cerrado solo admite moderadores.
forumRouter.post('/threads/:id/posts', requireAuth, async (req, res) => {
  const thread = await buscarTema(req.params.id);
  if (thread.isClosed && !esModerador(req.user)) throw new HttpError(403, 'Este tema está cerrado.');
  const body = mensaje(req.body.body);
  const [post] = await prisma.$transaction([
    prisma.forumPost.create({ data: { threadId: thread.id, authorId: req.user.id, body }, include: { author: autor } }),
    prisma.forumThread.update({ where: { id: thread.id }, data: { lastPostAt: new Date() } }),
  ]);
  res.status(201).json({ post: publicPost(post, req.user) });
});

async function buscarMensaje(id) {
  const post = await prisma.forumPost.findUnique({ where: { id: v.id(id) }, include: { thread: true } });
  if (!post) throw new HttpError(404, 'Mensaje no encontrado.');
  return post;
}

// PATCH /api/forum/posts/:id { body }: solo el autor corrige su mensaje.
forumRouter.patch('/posts/:id', requireAuth, async (req, res) => {
  const post = await buscarMensaje(req.params.id);
  if (post.authorId !== req.user.id || post.deletedAt) throw new HttpError(403, 'Solo el autor puede editar este mensaje.');
  if (post.thread.isClosed && !esModerador(req.user)) throw new HttpError(403, 'Este tema está cerrado.');
  const actualizado = await prisma.forumPost.update({
    where: { id: post.id },
    data: { body: mensaje(req.body.body), editedAt: new Date() },
    include: { author: autor },
  });
  res.json({ post: publicPost(actualizado, req.user) });
});

// DELETE /api/forum/posts/:id: el autor o un moderador lo ocultan; queda registro en la base.
forumRouter.delete('/posts/:id', requireAuth, async (req, res) => {
  const post = await buscarMensaje(req.params.id);
  if (post.authorId !== req.user.id && !esModerador(req.user)) {
    throw new HttpError(403, 'No puede borrar el mensaje de otra persona.');
  }
  if (!post.deletedAt) await prisma.forumPost.update({ where: { id: post.id }, data: { deletedAt: new Date() } });
  res.status(204).end();
});
