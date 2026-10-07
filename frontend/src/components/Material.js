"use client";

import { useEffect, useState } from "react";
import { descargarMaterial, NOMBRE_HERRAMIENTA, obtenerArchivo } from "@/lib/api";

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

// Qué archivos se pueden ver en la página; el resto solo se descarga
// (Office, Scratch, DFD y .zip necesitan su propio programa).
const VISTAS = {
  pdf: "pdf",
  png: "imagen",
  jpg: "imagen",
  jpeg: "imagen",
  gif: "imagen",
  webp: "imagen",
  txt: "texto",
  md: "texto",
  psc: "texto",
  ino: "texto",
};

function tipoVista(nombre) {
  const ext = String(nombre ?? "").split(".").pop().toLowerCase();
  return VISTAS[ext] ?? null;
}

// Muestra el archivo dentro de la página. Se pide con la sesión y se abre desde
// una URL local del navegador, que se libera al cerrar la vista.
function VistaPrevia({ material, tipo }) {
  const [url, setUrl] = useState(null);
  const [texto, setTexto] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    let creada = null;
    obtenerArchivo(material)
      .then(async (blob) => {
        if (!vivo) return;
        if (tipo === "texto") {
          setTexto(await blob.text());
        } else {
          creada = URL.createObjectURL(blob);
          setUrl(creada);
        }
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [material, tipo]);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!url && texto === null) return <p className="text-sm opacity-60">Cargando...</p>;

  if (tipo === "texto") {
    return (
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-black/5 p-3 font-mono text-sm dark:bg-white/10">
        {texto}
      </pre>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {tipo === "pdf" ? (
        <iframe src={url} title={material.title} className="h-[75vh] w-full rounded-md border border-black/10 dark:border-white/15" />
      ) : (
        // next/image no sirve para URLs locales del navegador (blob:).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={material.title} className="max-h-[75vh] max-w-full self-start rounded-md object-contain" />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
        Abrir en una pestaña nueva
      </a>
    </div>
  );
}

function tamano(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Un material de apoyo: archivo para descargar, enlace o video.
export default function Material({ material, onBorrar, onCambiarVisibilidad }) {
  const [error, setError] = useState("");
  const [viendo, setViendo] = useState(false);
  const video = material.kind === "VIDEO" ? idYoutube(material.url) : null;
  const vista = material.kind === "FILE" ? tipoVista(material.fileName) : null;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-black/10 px-3 py-2 dark:border-white/15">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{material.title}</p>
          {material.description && <p className="text-sm opacity-80">{material.description}</p>}
          <p className="text-xs opacity-60">
            {material.kind === "FILE" && `${material.fileName} · `}
            {NOMBRE_HERRAMIENTA[material.tool]}
            {material.uploadedBy && ` · ${material.uploadedBy}`}
            {material.visibility === "PUBLIC" && " · Público"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {vista && (
            <button type="button" className="font-medium hover:underline" onClick={() => setViendo((v) => !v)}>
              {viendo ? "Ocultar" : "Ver"}
            </button>
          )}
          {material.kind === "FILE" && (
            <button
              type="button"
              className="hover:underline"
              onClick={() => descargarMaterial(material).catch((e) => setError(e.message))}
            >
              Descargar ({tamano(material.fileSize)})
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
      {viendo && vista && <VistaPrevia material={material} tipo={vista} />}
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
