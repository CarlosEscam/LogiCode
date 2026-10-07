import { Router } from 'express';
import fs from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { courseAccess, requireCourse } from '../lib/access.js';
import { publicMaterial, TOOLS } from '../lib/material.js';
import { recibirArchivo, rutaArchivo, borrarArchivo, tipoDeArchivo } from '../lib/uploads.js';
import { firmarArchivo, leerFirmaArchivo } from '../lib/auth.js';
import * as v from '../lib/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

// Material de apoyo (RF-09, RF-20). Un material pertenece a un curso (y opcionalmente a un tema)
// o se sube directo a la biblioteca (sin curso, siempre público).
export const materialsRouter = Router();

function enlaceValido(url) {
  try {
    const u = new URL(String(url ?? '').trim());
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {
    // se responde abajo
  }
  throw new HttpError(400, 'El enlace debe empezar por http:// o https://');
}

// Quién puede editar o borrar: quien lo subió, el docente del curso o un administrador.
async function puedeEditar(user, material) {
  if (user.role === 'ADMIN' || material.uploadedById === user.id) return true;
  return material.courseId !== null && (await courseAccess(user, material.courseId)) === 'owner';
}

// Quién puede ver o descargar: todos si es público; si no, los del curso.
async function puedeVer(user, material) {
  if (material.visibility === 'PUBLIC') return true;
  return material.courseId !== null && (await courseAccess(user, material.courseId)) !== null;
}

// POST /api/materials (multipart/form-data si trae archivo, o JSON para enlaces y videos)
// Campos: title, description, kind (FILE | LINK | VIDEO), url, tool, visibility, courseId, topicId, file
materialsRouter.post('/', requireAuth, recibirArchivo, async (req, res) => {
  try {
    const b = req.body;
    const title = String(b.title ?? '').trim();
    if (title.length < 2 || title.length > 200) throw new HttpError(400, 'Escriba el título del material.');
    const kind = b.kind;
    if (!['FILE', 'LINK', 'VIDEO'].includes(kind)) throw new HttpError(400, 'Tipo de material no válido.');
    const tool = b.tool || 'GENERAL';
    if (!TOOLS.includes(tool)) throw new HttpError(400, 'Herramienta no válida.');

    const data = {
      title,
      description: String(b.description ?? '').trim() || null,
      kind,
      tool,
      uploadedById: req.user.id,
    };

    if (kind === 'FILE') {
      if (!req.file) throw new HttpError(400, 'Adjunte el archivo.');
      Object.assign(data, {
        filePath: req.file.filename,
        fileName: req.file.originalname.slice(0, 255),
        fileType: req.file.mimetype.slice(0, 100),
        fileSize: req.file.size,
      });
    } else {
      data.url = enlaceValido(b.url);
    }

    if (b.courseId) {
      const { course } = await requireCourse(req.user, v.id(b.courseId), 'owner');
      data.courseId = course.id;
      data.visibility = b.visibility === 'PUBLIC' ? 'PUBLIC' : 'COURSE';
      if (b.topicId) {
        const topic = await prisma.topic.findUnique({ where: { id: v.id(b.topicId) } });
        if (!topic || topic.courseId !== course.id) throw new HttpError(400, 'El tema no es de este curso.');
        data.topicId = topic.id;
      }
    } else {
      // Subida directa a la biblioteca: docentes y administradores.
      if (!['TEACHER', 'ADMIN'].includes(req.user.role)) throw new HttpError(403, 'No tiene permiso para subir a la biblioteca.');
      data.visibility = 'PUBLIC';
    }

    const material = await prisma.material.create({ data, include: { uploadedBy: { select: { fullName: true } } } });
    res.status(201).json({ material: publicMaterial(material) });
  } catch (err) {
    // Si algo falla después de guardar el archivo, no se deja huérfano.
    await borrarArchivo(req.file?.filename);
    throw err;
  }
});

async function buscar(req) {
  const material = await prisma.material.findUnique({
    where: { id: v.id(req.params.id) },
    include: { uploadedBy: { select: { fullName: true } } },
  });
  if (!material) throw new HttpError(404, 'Material no encontrado.');
  return material;
}

// PATCH /api/materials/:id { title?, description?, visibility?, topicId? }
materialsRouter.patch('/:id', requireAuth, async (req, res) => {
  const material = await buscar(req);
  if (!(await puedeEditar(req.user, material))) throw new HttpError(403, 'No puede editar este material.');
  const data = {};
  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (title.length < 2 || title.length > 200) throw new HttpError(400, 'Escriba el título del material.');
    data.title = title;
  }
  if (req.body.description !== undefined) data.description = String(req.body.description).trim() || null;
  if (req.body.visibility !== undefined && material.courseId !== null) {
    data.visibility = req.body.visibility === 'PUBLIC' ? 'PUBLIC' : 'COURSE';
  }
  if (req.body.topicId !== undefined && material.courseId !== null) {
    if (req.body.topicId === null || req.body.topicId === '') {
      data.topicId = null;
    } else {
      const topic = await prisma.topic.findUnique({ where: { id: v.id(req.body.topicId) } });
      if (!topic || topic.courseId !== material.courseId) throw new HttpError(400, 'El tema no es de este curso.');
      data.topicId = topic.id;
    }
  }
  const actualizado = await prisma.material.update({
    where: { id: material.id },
    data,
    include: { uploadedBy: { select: { fullName: true } } },
  });
  res.json({ material: publicMaterial(actualizado) });
});

// DELETE /api/materials/:id
materialsRouter.delete('/:id', requireAuth, async (req, res) => {
  const material = await buscar(req);
  if (!(await puedeEditar(req.user, material))) throw new HttpError(403, 'No puede borrar este material.');
  await prisma.material.delete({ where: { id: material.id } });
  await borrarArchivo(material.filePath);
  res.status(204).end();
});

// Revisa que el usuario pueda ver el material y que el archivo siga en el servidor.
async function archivoVisible(req) {
  const material = await buscar(req);
  if (!(await puedeVer(req.user, material))) {
    throw new HttpError(req.user ? 403 : 401, 'Este material es solo para los estudiantes del curso.');
  }
  if (material.kind !== 'FILE' || !material.filePath) throw new HttpError(404, 'Este material no tiene archivo.');
  const ruta = rutaArchivo(material.filePath);
  if (!fs.existsSync(ruta)) throw new HttpError(404, 'El archivo ya no está en el servidor.');
  return { material, ruta };
}

// GET /api/materials/:id/enlace: enlace firmado al archivo, para reproducir videos y descargar
// directo con el navegador. Vence a las pocas horas y queda atado al usuario que lo pidió.
materialsRouter.get('/:id/enlace', optionalAuth, async (req, res) => {
  const { material } = await archivoVisible(req);
  const firma = firmarArchivo(material.id, req.user);
  res.json({ url: `/api/materials/${material.id}/file?firma=${encodeURIComponent(firma)}` });
});

// Con ?firma= el usuario sale del enlace firmado; sin ella, de la sesión si la hay.
async function sesionOFirma(req, res, next) {
  if (req.query.firma === undefined) return optionalAuth(req, res, next);
  let datos;
  try {
    datos = leerFirmaArchivo(String(req.query.firma));
  } catch {
    throw new HttpError(401, 'El enlace venció. Recargue la página.');
  }
  if (String(datos.mid) !== req.params.id) throw new HttpError(401, 'El enlace no es de este material.');
  if (datos.sub) {
    const user = await prisma.user.findUnique({ where: { id: Number(datos.sub) } });
    if (!user || user.status !== 'ACTIVE') throw new HttpError(401, 'La sesión ya no es válida.');
    req.user = user;
  }
  next();
}

// GET /api/materials/:id/file: entrega el archivo si el usuario puede verlo.
// La web lo usa para descargar y para mostrarlo en la página; admite rangos para adelantar videos.
materialsRouter.get('/:id/file', sesionOFirma, async (req, res) => {
  const { material, ruta } = await archivoVisible(req);
  res.download(ruta, material.fileName ?? material.filePath, {
    headers: { 'Content-Type': tipoDeArchivo(material.fileName ?? material.filePath), 'X-Content-Type-Options': 'nosniff' },
  });
});

// GET /api/library?tool=PSEINT: biblioteca pública para visitantes (RF-20).
export const libraryRouter = Router();

libraryRouter.get('/', async (req, res) => {
  const tool = TOOLS.includes(req.query.tool) ? req.query.tool : undefined;
  const materials = await prisma.material.findMany({
    where: { visibility: 'PUBLIC', tool },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { fullName: true } } },
  });
  res.json({ materials: materials.map(publicMaterial) });
});
