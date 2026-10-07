import { app } from './app.js';
import { config } from './config.js';
import { retomarPendientes } from './lib/calificador.js';

const server = app.listen(config.port, async () => {
  console.log(`API de LogiCode en http://localhost:${config.port}`);
  console.log(`Calificación de fotos con IA: ${config.ia.proveedor ?? 'sin configurar (quedan en revisión)'}`);
  const n = await retomarPendientes().catch(() => 0);
  if (n) console.log(`Retomando ${n} entrega(s) sin calificar.`);
});

// Subir una clase grabada por una conexión lenta puede pasar de los 5 minutos que Node da por defecto.
server.requestTimeout = 60 * 60 * 1000;
