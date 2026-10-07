"use client";

import { useState } from "react";
import { descargarMaterial, NOMBRE_HERRAMIENTA } from "@/lib/api";

// Id del video si el enlace es de YouTube, para mostrarlo incrustado.
function idYoutube(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const [, tipo, id] = u.pathname.split("/");
      if (tipo === "shorts" || tipo === "embed") return id;
    }
  } catch {
    // no es un enlace válido
  }
  return null;
}

function tamano(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Un material de apoyo: archivo para descargar, enlace o video.
export default function Material({ material, onBorrar, onCambiarVisibilidad }) {
  const [error, setError] = useState("");
  const video = material.kind === "VIDEO" ? idYoutube(material.url) : null;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-black/10 px-3 py-2 dark:border-white/15">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{material.title}</p>
          {material.description && <p className="text-sm opacity-80">{material.description}</p>}
          <p className="text-xs opacity-60">
            {NOMBRE_HERRAMIENTA[material.tool]}
            {material.uploadedBy && ` · ${material.uploadedBy}`}
            {material.visibility === "PUBLIC" && " · Público"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {material.kind === "FILE" && (
            <button
              type="button"
              className="hover:underline"
              onClick={() => descargarMaterial(material).catch((e) => setError(e.message))}
            >
              Descargar {material.fileName} ({tamano(material.fileSize)})
            </button>
          )}
          {material.kind !== "FILE" && !video && (
            <a href={material.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              Abrir enlace
            </a>
          )}
          {onCambiarVisibilidad && (
            <button type="button" className="hover:underline" onClick={onCambiarVisibilidad}>
              {material.visibility === "PUBLIC" ? "Solo para el curso" : "Hacer público"}
            </button>
          )}
          {onBorrar && (
            <button type="button" className="text-red-600 hover:underline dark:text-red-400" onClick={onBorrar}>
              Borrar
            </button>
          )}
        </div>
      </div>
      {video && (
        <div className="aspect-video w-full max-w-xl">
          <iframe
            className="h-full w-full rounded-md"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video)}`}
            title={material.title}
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {material.kind === "VIDEO" && !video && (
        <a href={material.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
          Ver video
        </a>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}
