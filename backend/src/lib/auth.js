import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

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

// Datos del usuario que se pueden enviar al navegador (nunca el hash).
export function publicUser(user) {
  const { id, cedula, fullName, email, role, status } = user;
  return { id, cedula, fullName, email, role, status };
}
