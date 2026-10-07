import { HttpError } from './errors.js';

// Validaciones de los datos que llegan en los formularios.

export function cedula(value) {
  const limpia = String(value ?? '').replace(/[\s.]/g, '');
  if (!/^\d{5,15}$/.test(limpia)) {
    throw new HttpError(400, 'La cédula debe tener entre 5 y 15 dígitos.');
  }
  return limpia;
}

export function email(value) {
  const limpio = String(value ?? '').trim().toLowerCase();
  if (limpio.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
    throw new HttpError(400, 'El correo no es válido.');
  }
  return limpio;
}

export function nombre(value) {
  const limpio = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (limpio.length < 3 || limpio.length > 150) {
    throw new HttpError(400, 'Escriba el nombre completo.');
  }
  return limpio;
}

export function password(value) {
  const texto = String(value ?? '');
  if (texto.length < 8 || texto.length > 72) {
    throw new HttpError(400, 'La contraseña debe tener entre 8 y 72 caracteres.');
  }
  return texto;
}

export function id(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'No encontrado.');
  return n;
}
