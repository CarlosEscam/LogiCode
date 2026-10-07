"use client";

import { useEffect, useState } from "react";
import { descargarMaterial, enlaceArchivo, obtenerArchivo } from "@/lib/api";
import { CuadroHerramienta, EtiquetaHerramienta } from "@/components/Herramienta";

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
  mp4: "video",
  webm: "video",
};

function tipoVista(nombre) {
  const ext = String(nombre ?? "").split(".").pop().toLowerCase();
  return VISTAS[ext] ?? null;
}

// Muestra el archivo dentro de la página. Se pide con la sesión y se abre desde
// una URL local del navegador, que se libera al cerrar la vista. Los videos no se
// cargan enteros: el reproductor los va pidiendo por partes con un enlace firmado.
function VistaPrevia({ material, tipo }) {
  const [url, setUrl] = useState(null);
  const [texto, setTexto] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    let creada = null;
    const cargar =
      tipo === "video"
        ? enlaceArchivo(material).then((enlace) => vivo && setUrl(enlace))
        : obtenerArchivo(material).then(async (blob) => {
            if (!vivo) return;
            if (tipo === "texto") {
              setTexto(await blob.text());
            } else {
              creada = URL.createObjectURL(blob);
              setUrl(creada);
            }
          });
    cargar.catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [material, tipo]);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!url && texto === null) return <p className="animate-pulse text-sm text-foreground/60">Cargando...</p>;

  if (tipo === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="max-h-[75vh] w-full max-w-3xl self-start rounded-xl border border-borde bg-black"
      />
    );
  }
  if (tipo === "texto") {
    return (
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-borde bg-black/40 p-4 font-mono text-sm">
        {texto}
      </pre>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {tipo === "pdf" ? (
        <iframe src={url} title={material.title} className="h-[75vh] w-full rounded-xl border border-borde" />
      ) : (
        // next/image no sirve para URLs locales del navegador (blob:).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={material.title} className="max-h-[75vh] max-w-full self-start rounded-xl object-contain" />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="accion self-start text-cyan-300">
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
    <li className={`tono-${material.tool} tarjeta-viva flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-[15rem] flex-1 items-start gap-3">
          <CuadroHerramienta herramienta={material.tool} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold leading-snug">{material.title}</p>
            {material.description && <p className="text-sm text-foreground/75">{material.description}</p>}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/55">
              <EtiquetaHerramienta herramienta={material.tool} />
              {material.kind === "FILE" && <span className="[overflow-wrap:anywhere]">{material.fileName}</span>}
              {material.uploadedBy && <span>· {material.uploadedBy}</span>}
              {material.visibility === "PUBLIC" && <span>· Público</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {vista && (
            <button type="button" className="accion text-cyan-300" onClick={() => setViendo((v) => !v)}>
              {viendo ? "Ocultar" : "Ver"}
            </button>
          )}
          {material.kind === "FILE" && (
            <button
              type="button"
              className="accion"
              onClick={() => descargarMaterial(material).catch((e) => setError(e.message))}
            >
              Descargar ({tamano(material.fileSize)})
            </button>
          )}
          {material.kind !== "FILE" && !video && (
            <a href={material.url} target="_blank" rel="noopener noreferrer" className="accion text-cyan-300">
              Abrir enlace
            </a>
          )}
          {onCambiarVisibilidad && (
            <button type="button" className="accion" onClick={onCambiarVisibilidad}>
              {material.visibility === "PUBLIC" ? "Solo para el curso" : "Hacer público"}
            </button>
          )}
          {onBorrar && (
            <button type="button" className="accion-peligro" onClick={onBorrar}>
              Borrar
            </button>
          )}
        </div>
      </div>
      {viendo && vista && <VistaPrevia material={material} tipo={vista} />}
      {video && (
        <div className="aspect-video w-full max-w-xl">
          <iframe
            className="h-full w-full rounded-xl border border-borde"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video)}`}
            title={material.title}
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {material.kind === "VIDEO" && !video && (
        <a href={material.url} target="_blank" rel="noopener noreferrer" className="accion self-start text-cyan-300">
          Ver video
        </a>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </li>
  );
}
