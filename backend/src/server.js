import { app } from './app.js';
import { config } from './config.js';

const server = app.listen(config.port, () => {
  console.log(`API de LogiCode en http://localhost:${config.port}`);
});

// Subir una clase grabada por una conexión lenta puede pasar de los 5 minutos que Node da por defecto.
server.requestTimeout = 60 * 60 * 1000;
