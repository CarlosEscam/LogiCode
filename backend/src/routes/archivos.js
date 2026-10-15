import { Router } from 'express';
import { prepararSubida } from '../lib/uploads.js';
import { requireAuth } from '../middleware/auth.js';

// Subida directa de archivos a Cloudflare R2 (ver lib/uploads.js).
export const archivosRouter = Router();

// POST /api/archivos/subida { destino: 'material' | 'entrega', nombre, tamano }
// Responde { directo: true, url, headers, subida } con R2, o { directo: false } sin él.
archivosRouter.post('/subida', requireAuth, async (req, res) => {
  res.json(await prepararSubida(req.user, req.body));
});
