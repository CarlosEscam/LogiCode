"use client";

import { useSyncExternalStore } from "react";

// Llamadas a la API y manejo de la sesión en el navegador.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const CLAVE = "logicode-sesion";
const EVENTO = "logicode-sesion";

export async function api(ruta, { method = "GET", body } = {}) {
  const token = leerSesion()?.token;
  let res;
  try {
    res = await fetch(`${API_URL}/api${ruta}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No hay conexión con el servidor de LogiCode.");
  }
  if (res.status === 204) return null;
  const datos = await res.json().catch(() => ({}));
  if (res.status === 401 && token) cerrarSesion();
  if (!res.ok) throw new Error(datos.error ?? "Ocurrió un error. Intente de nuevo.");
  return datos;
}

function leerCrudo() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

function leerSesion() {
  const crudo = leerCrudo();
  try {
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export function guardarSesion({ token, user }) {
  localStorage.setItem(CLAVE, JSON.stringify({ token, user }));
  window.dispatchEvent(new Event(EVENTO));
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE);
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(aviso) {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

// Usuario de la sesión actual: undefined mientras carga, null si no hay sesión.
export function useUsuario() {
  const crudo = useSyncExternalStore(suscribir, leerCrudo, () => undefined);
  if (crudo === undefined) return undefined;
  try {
    return crudo ? JSON.parse(crudo).user : null;
  } catch {
    return null;
  }
}

export const NOMBRE_ROL = { STUDENT: "Estudiante", TEACHER: "Docente", ADMIN: "Administrador" };
