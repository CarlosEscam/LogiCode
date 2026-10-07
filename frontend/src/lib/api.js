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
    // Con FormData (archivos) el navegador arma el Content-Type.
    const esFormulario = body instanceof FormData;
    res = await fetch(`${API_URL}/api${ruta}`, {
      method,
      headers: {
        ...(body && !esFormulario ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? (esFormulario ? body : JSON.stringify(body)) : undefined,
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

// Descarga el archivo de un material. Se pide con la sesión porque el material
// del curso no es público.
export async function descargarMaterial(material) {
  const token = leerSesion()?.token;
  let res;
  try {
    res = await fetch(`${API_URL}/api/materials/${material.id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error("No hay conexión con el servidor de LogiCode.");
  }
  if (!res.ok) {
    const datos = await res.json().catch(() => ({}));
    throw new Error(datos.error ?? "No se pudo descargar el archivo.");
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = material.fileName ?? "archivo";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
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

export const HERRAMIENTAS = [
  { valor: "PSEINT", nombre: "PSeInt" },
  { valor: "DFD", nombre: "DFD" },
  { valor: "SCRATCH", nombre: "Scratch" },
  { valor: "ARDUINO", nombre: "Arduino" },
  { valor: "GENERAL", nombre: "General" },
];

export const NOMBRE_HERRAMIENTA = Object.fromEntries(HERRAMIENTAS.map((h) => [h.valor, h.nombre]));

export const NOMBRE_ROL = { STUDENT: "Estudiante", TEACHER: "Docente", ADMIN: "Administrador" };
