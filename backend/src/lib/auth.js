import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { urlFoto } from './perfil.js';

const SESSION_HOURS = 8;

export const hashPassword = (plain) => bcrypt.hash(plain, 12);
export const checkPassword = (plain, hash) => bcrypt.compare(plain, hash);

export function signSession(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    expiresIn: `${SESSION_HOURS}h`,
  });
}

export function readSession(token) {
  return jwt.verify(token, config.jwtSecret);
}

// Enlace firmado para abrir el archivo de un material sin la cabecera de sesión,
// que el reproductor de video y las descargas del navegador no pueden enviar.
// Usa otra clave para que no sirva como sesión ni al revés.
const FIRMA_HORAS = 6;
const claveArchivos = () => `${config.jwtSecret}:archivos`;

export function firmarArchivo(materialId, user) {
  return jwt.sign({ mid: materialId, ...(user ? { sub: String(user.id) } : {}) }, claveArchivos(), {
    expiresIn: `${FIRMA_HORAS}h`,
  });
}

export function leerFirmaArchivo(firma) {
  return jwt.verify(firma, claveArchivos());
}

// Datos del usuario que se pueden enviar al navegador (nunca el hash).
export function publicUser(user) {
  const { id, cedula, fullName, email, role, status } = user;
  return { id, cedula, fullName, email, role, status, avatarUrl: urlFoto(user) };
}
