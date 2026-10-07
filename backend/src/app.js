import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { coursesRouter } from './routes/courses.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
// En Express 5 req.body queda sin definir si la petición no trae JSON.
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/courses', coursesRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores: nunca expone detalles internos al cliente.
app.use((err, req, res, _next) => {
  if (!err.expose) console.error(err);
  res.status(err.status ?? 500).json({ error: err.expose ? err.message : 'Error interno del servidor' });
});
