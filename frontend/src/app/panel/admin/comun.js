"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Pide datos a la API y los vuelve a pedir cuando cambia la ruta o la versión.
export function useDatos(ruta, version = 0) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    api(ruta)
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        setError("");
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [ruta, version]);

  return { datos, error, setError };
}

export const NOMBRE_ESTADO = { ACTIVE: "Activa", PENDING: "Pendiente", DISABLED: "Deshabilitada" };

const COLOR_ESTADO = {
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  DISABLED: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

export function Estado({ estado }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${COLOR_ESTADO[estado]}`}>
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}

export function fecha(iso) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export function tamano(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
