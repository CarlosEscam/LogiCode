import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { checkPassword, hashPassword, publicUser } from '../lib/auth.js';
import { MAX_FOTO_KB, extensionDeImagen } from '../lib/perfil.js';
import { borrarArchivo, rutaArchivo, tipoDeArchivo } from '../lib/uploads.js';
import { cerrarVencidos } from '../lib/quizzes.js';
import { NO_QUIZ, plazoDe, planillaDelCurso } from '../lib/actividades.js';
import * as v from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Lo del usuario de la sesión: su perfil (foto, correo, contraseña) y, si es estudiante,
// su resumen, sus notas (RF-15, RF-17) y sus puntajes en los juegos (RF-18).
export const meRouter = Router();
// Fotos de perfil: las ve cualquiera, porque salen en el foro, que es público.
export const usersRouter = Router();

meRouter.use(requireAuth);

const num = (d) => (d === null || d === undefined ? null : Number(d));

// --- Perfil ---------------------------------------------------------------------

// PATCH /api/me { email }: el nombre y la cédula vienen de la lista del docente y no se cambian aquí.
meRouter.patch('/', async (req, res) => {
  const email = v.email(req.body.email);
  const otro = await prisma.user.findFirst({ where: { email, id: { not: req.user.id } }, select: { id: true } });
  if (otro) throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { email } });
  res.json({ user: publicUser(user) });
});

// POST /api/me/password { currentPassword, newPassword }
meRouter.post('/password', async (req, res) => {
  const nueva = v.password(req.body.newPassword);
  if (!(await checkPassword(String(req.body.currentPassword ?? ''), req.user.passwordHash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta.');
  }
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await hashPassword(nueva) } });
  res.json({ mensaje: 'Contraseña actualizada.' });
});

// La web recorta y reduce la foto antes de enviarla, así que basta con un límite pequeño.
const recibirFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FOTO_KB * 1024, files: 1 },
}).single('avatar');

function leerFoto(req, res, next) {
  recibirFoto(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const mensaje = err.code === 'LIMIT_FILE_SIZE' ? `La foto supera ${MAX_FOTO_KB / 1024} MB.` : 'No se pudo recibir la foto.';
      return next(new HttpError(400, mensaje));
    }
    next(err);
  });
}

// PUT /api/me/avatar (multipart, campo avatar): JPEG, PNG o WebP.
meRouter.put('/avatar', leerFoto, async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Elija una foto.');
  const ext = extensionDeImagen(req.file.buffer);
  if (!ext) throw new HttpError(400, 'La foto debe ser JPG, PNG o WebP.');
  const nombre = `avatar-${crypto.randomBytes(12).toString('hex')}${ext}`;
  await fs.promises.writeFile(rutaArchivo(nombre), req.file.buffer);
  const anterior = req.user.avatarPath;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarPath: nombre } });
  await borrarArchivo(anterior);
  res.json({ user: publicUser(user) });
});

// DELETE /api/me/avatar: vuelve a las iniciales.
meRouter.delete('/avatar', async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarPath: null } });
  await borrarArchivo(req.user.avatarPath);
  res.json({ user: publicUser(user) });
});

// GET /api/users/:id/avatar
usersRouter.get('/:id/avatar', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: v.id(req.params.id) }, select: { avatarPath: true } });
  if (!user?.avatarPath) throw new HttpError(404, 'Este usuario no tiene foto.');
  const ruta = rutaArchivo(user.avatarPath);
  if (!fs.existsSync(ruta)) throw new HttpError(404, 'Este usuario no tiene foto.');
  res.set({
    'Content-Type': tipoDeArchivo(path.basename(ruta)),
    'X-Content-Type-Options': 'nosniff',
    // La dirección cambia con cada foto nueva (?v=...), así que se puede guardar mucho tiempo.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  fs.createReadStream(ruta).pipe(res);
});

// --- Actividades y quizzes del estudiante ------------------------------------------

// Estado de una actividad para el estudiante:
// CALIFICADA, EN_REVISION (entregada, la nota aún no está), PENDIENTE o NO_ENTREGO (venció sin entrega).
function estadoActividad(activity, studentId, ahora) {
  const entregas = activity.submissions;
  const { cierre, intentos } = plazoDe(activity, activity.extensions, studentId);
  const calificadas = entregas.filter((s) => s.status === 'GRADED' && s.finalGrade !== null);
  const mejor = calificadas.reduce((m, s) => (!m || Number(s.finalGrade) > Number(m.finalGrade) ? s : m), null);
  let estado = 'PENDIENTE';
  if (mejor) estado = 'CALIFICADA';
  else if (entregas.length) estado = 'EN_REVISION';
  else if (cierre < ahora) estado = 'NO_ENTREGO';
  const ultima = entregas.at(-1);
  return {
    estado,
    cierre,
    intentosRestantes: Math.max(0, intentos - entregas.length),
    nota: mejor ? num(mejor.finalGrade) : null,
    entregadaEl: ultima?.submittedAt ?? null,
    // La retroalimentación se ve cuando la entrega ya tiene nota.
    comentario: mejor?.teacherComment ?? null,
    observaciones: mejor?.gradingNotes ?? null,
    calificadaEl: mejor?.gradedAt ?? null,
  };
}

function estadoQuiz(quiz, ahora) {
  if (quiz.opensAt > ahora) return 'UPCOMING';
  return quiz.closesAt < ahora ? 'CLOSED' : 'OPEN';
}

// Todo lo del estudiante en sus cursos, ya con su estado. Lo usan el resumen y las notas.
async function datosDelEstudiante(user) {
  const ahora = new Date();
  await cerrarVencidos({ studentId: user.id });
  const cursos = await prisma.course.findMany({
    where: { roster: { some: { userId: user.id } } },
    orderBy: { id: 'asc' },
    include: {
      teacher: { select: { fullName: true } },
      topics: { orderBy: { position: 'asc' }, select: { id: true, title: true, tool: true, isNextClass: true } },
      activities: {
        where: { ...NO_QUIZ, opensAt: { lte: ahora } },
        orderBy: [{ closesAt: 'asc' }, { id: 'asc' }],
        include: {
          topic: { select: { id: true, title: true, tool: true } },
          extensions: true,
          submissions: { where: { studentId: user.id }, orderBy: { attemptNumber: 'asc' } },
        },
      },
      quizzes: {
        where: { published: true },
        orderBy: [{ closesAt: 'asc' }, { id: 'asc' }],
        include: {
          topic: { select: { id: true, title: true, tool: true } },
          attempts: { where: { studentId: user.id }, orderBy: { attemptNumber: 'asc' } },
          allowances: { where: { studentId: user.id } },
        },
      },
    },
  });

  // La definitiva sale de la planilla del docente, con los mismos porcentajes y reglas.
  const definitivas = await Promise.all(
    cursos.map(async (c) => (await planillaDelCurso(c.id)).estudiantes.find((e) => e.cedula === user.cedula)?.definitiva ?? null),
  );

  return cursos.map((c, i) => {
    const actividades = c.activities.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      submissionType: a.submissionType,
      topic: a.topic,
      maxGrade: num(a.maxGrade),
      ...estadoActividad(a, user.id, ahora),
    }));
    const quizzes = c.quizzes.map((q) => {
      const enviados = q.attempts.filter((t) => t.submittedAt);
      const abierto = q.attempts.find((t) => !t.submittedAt && t.deadline > ahora);
      const mejor = enviados.reduce((m, t) => (t.grade !== null && (m === null || Number(t.grade) > m) ? Number(t.grade) : m), null);
      const permitidos = q.isPractice ? Infinity : q.maxAttempts + (q.allowances[0]?.extraAttempts ?? 0);
      const status = estadoQuiz(q, ahora);
      let estado = 'PENDIENTE';
      if (abierto) estado = 'EN_CURSO';
      else if (enviados.length) estado = 'PRESENTADO';
      else if (status === 'CLOSED') estado = 'NO_PRESENTADO';
      else if (status === 'UPCOMING') estado = 'PROXIMO';
      return {
        id: q.id,
        title: q.title,
        isPractice: q.isPractice,
        topic: q.topic,
        timeLimitMinutes: q.timeLimitMinutes,
        opensAt: q.opensAt,
        closesAt: q.closesAt,
        status,
        estado,
        nota: mejor,
        intentosRestantes: permitidos === Infinity ? null : Math.max(0, permitidos - q.attempts.length),
        intentoAbierto: abierto?.id ?? null,
      };
    });

    // Avance por tema: cuántas actividades y quizzes del tema ya hizo.
    const temas = c.topics.map((t) => {
      const del = [...actividades.filter((a) => a.topic?.id === t.id), ...quizzes.filter((q) => q.topic?.id === t.id && q.status !== 'UPCOMING')];
      const hechas = del.filter((x) => ['CALIFICADA', 'EN_REVISION', 'PRESENTADO'].includes(x.estado)).length;
      return { id: t.id, title: t.title, tool: t.tool, total: del.length, hechas };
    });

    return {
      id: c.id,
      name: c.name,
      period: c.period,
      teacher: c.teacher,
      nextClass: c.topics.find((t) => t.isNextClass) ?? null,
      temas,
      actividades,
      quizzes,
      promedio: definitivas[i],
    };
  });
}

const JUEGOS = ['ADIVINA_SALIDA', 'MEMORAMA_DFD', 'ORDENAR_PASOS'];

// Mejor partida de cada juego: más aciertos y, si empatan, menos tiempo.
async function mejoresPartidas(userId) {
  const partidas = await prisma.gameScore.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  const mejores = {};
  for (const p of partidas) {
    const actual = mejores[p.game];
    const ratio = p.maxScore ? p.score / p.maxScore : 0;
    const ratioActual = actual ? actual.score / actual.maxScore : -1;
    const masRapido = actual && ratio === ratioActual && (p.seconds ?? Infinity) < (actual.seconds ?? Infinity);
    if (!actual || ratio > ratioActual || masRapido) mejores[p.game] = p;
  }
  return Object.fromEntries(
    JUEGOS.map((j) => {
      const m = mejores[j];
      const jugadas = partidas.filter((p) => p.game === j).length;
      return [j, m ? { score: m.score, maxScore: m.maxScore, seconds: m.seconds, jugadas } : { jugadas }];
    }),
  );
}

// GET /api/me/summary: el panel del estudiante.
meRouter.get('/summary', requireRole('STUDENT'), async (req, res) => {
  const cursos = await datosDelEstudiante(req.user);
  const pendientes = [];
  const proximos = [];
  const recientes = [];
  for (const c of cursos) {
    const curso = { id: c.id, name: c.name };
    for (const a of c.actividades) {
      if (a.estado === 'PENDIENTE') pendientes.push({ kind: 'ACTIVITY', id: a.id, title: a.title, type: a.type, closesAt: a.cierre, topic: a.topic, course: curso });
      if (a.estado === 'CALIFICADA') recientes.push({ kind: 'ACTIVITY', id: a.id, title: a.title, nota: a.nota, fecha: a.calificadaEl ?? a.entregadaEl, course: curso });
    }
    for (const q of c.quizzes) {
      if (q.estado === 'PENDIENTE' || q.estado === 'EN_CURSO') {
        if (!q.isPractice || q.estado === 'EN_CURSO') {
          pendientes.push({ kind: 'QUIZ', id: q.id, title: q.title, closesAt: q.closesAt, topic: q.topic, course: curso, attemptId: q.intentoAbierto, timeLimitMinutes: q.timeLimitMinutes });
        }
      }
      if (q.estado === 'PROXIMO') proximos.push({ kind: 'QUIZ', id: q.id, title: q.title, opensAt: q.opensAt, closesAt: q.closesAt, isPractice: q.isPractice, course: curso });
      if (q.estado === 'PRESENTADO' && !q.isPractice && q.nota !== null) recientes.push({ kind: 'QUIZ', id: q.id, title: q.title, nota: q.nota, fecha: q.closesAt, course: curso });
    }
  }
  const porFecha = (campo) => (a, b) => new Date(a[campo]) - new Date(b[campo]);
  pendientes.sort(porFecha('closesAt'));
  proximos.sort(porFecha('opensAt'));
  recientes.sort((a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0));

  // Repasos abiertos: quizzes sin nota que el estudiante puede presentar cuantas veces quiera.
  const repasos = cursos.flatMap((c) =>
    c.quizzes.filter((q) => q.isPractice && q.status === 'OPEN').map((q) => ({ id: q.id, title: q.title, topic: q.topic, course: { id: c.id, name: c.name }, nota: q.nota })),
  );

  res.json({
    courses: cursos.map(({ actividades, quizzes, ...c }) => ({
      ...c,
      pendientes: pendientes.filter((p) => p.course.id === c.id).length,
    })),
    pending: pendientes,
    upcoming: proximos.slice(0, 5),
    recentGrades: recientes.slice(0, 5),
    practice: repasos,
    games: await mejoresPartidas(req.user.id),
  });
});

// GET /api/me/grades: notas y retroalimentación de cada actividad y quiz (RF-15, RF-17).
meRouter.get('/grades', requireRole('STUDENT'), async (req, res) => {
  res.json({ courses: await datosDelEstudiante(req.user) });
});

// --- Juegos (RF-18) ---------------------------------------------------------------

// POST /api/me/games { game, score, maxScore, seconds }: guarda una partida terminada.
meRouter.post('/games', async (req, res) => {
  const game = String(req.body.game ?? '');
  if (!JUEGOS.includes(game)) throw new HttpError(400, 'Juego no válido.');
  const entero = (valor, max) => {
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0 || n > max) throw new HttpError(400, 'Puntaje no válido.');
    return n;
  };
  const maxScore = entero(req.body.maxScore, 1000);
  const score = entero(req.body.score, maxScore);
  if (maxScore === 0) throw new HttpError(400, 'Puntaje no válido.');
  const seconds = req.body.seconds === undefined || req.body.seconds === null ? null : entero(req.body.seconds, 86_400);
  await prisma.gameScore.create({ data: { userId: req.user.id, game, score, maxScore, seconds } });
  res.status(201).json({ games: await mejoresPartidas(req.user.id) });
});

// GET /api/me/games: mejores puntajes del usuario.
meRouter.get('/games', async (req, res) => {
  res.json({ games: await mejoresPartidas(req.user.id) });
});
