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

// Pide el archivo de un material con la sesión (el material del curso no es público).
export async function obtenerArchivo(material) {
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
    throw new Error(datos.error ?? "No se pudo abrir el archivo.");
  }
  return res.blob();
}

// Enlace firmado al archivo de un material. Sirve donde el navegador no puede mandar
// la sesión: el reproductor de video y las descargas directas.
export async function enlaceArchivo(material) {
  const { url } = await api(`/materials/${material.id}/enlace`);
  return `${API_URL}${url}`;
}

// La descarga la hace el navegador con su propio avance, sin cargar el archivo en memoria.
export async function descargarMaterial(material) {
  const a = document.createElement("a");
  a.href = await enlaceArchivo(material);
  a.download = material.fileName ?? "archivo";
  a.click();
}

// Igual que api() con un formulario, pero informa el avance de la subida (fetch no lo hace).
export function subirConAvance(ruta, formulario, onAvance) {
  const token = leerSesion()?.token;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api${ruta}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onAvance(Math.floor((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error("No hay conexión con el servidor de LogiCode."));
    xhr.onload = () => {
      let datos = {};
      try {
        datos = JSON.parse(xhr.responseText);
      } catch {
        // respuesta sin JSON
      }
      if (xhr.status === 401 && token) cerrarSesion();
      if (xhr.status >= 400) reject(new Error(datos.error ?? "Ocurrió un error. Intente de nuevo."));
      else resolve(datos);
    };
    xhr.send(formulario);
  });
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

// Cambia los datos del usuario guardados en la sesión (por ejemplo, su foto nueva).
// Si no cambió nada no se avisa, para no volver a pintar la página.
export function actualizarUsuario(user) {
  const sesion = leerSesion();
  if (!sesion || JSON.stringify(sesion.user) === JSON.stringify(user)) return;
  guardarSesion({ token: sesion.token, user });
}

// Dirección completa de una foto de perfil, o null si la persona no tiene.
export function urlFoto(persona) {
  return persona?.avatarUrl ? `${API_URL}${persona.avatarUrl}` : null;
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

// El usuario se lee una vez por cada sesión guardada: devolver siempre el mismo objeto
// evita que los efectos que dependen de él se repitan sin fin.
let ultimo = { crudo: undefined, user: undefined };

function usuarioDe(crudo) {
  if (crudo !== ultimo.crudo) {
    let user = null;
    try {
      user = crudo ? JSON.parse(crudo).user : null;
    } catch {
      user = null;
    }
    ultimo = { crudo, user };
  }
  return ultimo.user;
}

// Usuario de la sesión actual: undefined mientras carga, null si no hay sesión.
export function useUsuario() {
  const crudo = useSyncExternalStore(suscribir, leerCrudo, () => undefined);
  return crudo === undefined ? undefined : usuarioDe(crudo);
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
