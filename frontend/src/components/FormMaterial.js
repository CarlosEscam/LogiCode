"use client";

import { useState } from "react";
import { api, HERRAMIENTAS, subirConAvance } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";

// Los mismos límites del servidor; se revisan antes para no subir en vano un archivo grande.
const MAX_MB = 20;
const MAX_VIDEO_MB = 1024;

function revisarTamano(archivo) {
  if (!archivo?.size) return "";
  const video = /\.(mp4|webm)$/i.test(archivo.name);
  if (video && archivo.size > MAX_VIDEO_MB * 1024 * 1024) return "El video supera 1 GB.";
  if (!video && archivo.size > MAX_MB * 1024 * 1024) return `El archivo supera ${MAX_MB} MB.`;
  return "";
}

// Formulario para agregar material. Sin courseId, el material va directo a la biblioteca.
export default function FormMaterial({ courseId, topicId, herramienta = "GENERAL", onCreado }) {
  const [tipo, setTipo] = useState("FILE");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [avance, setAvance] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    if (courseId) datos.set("courseId", courseId);
    if (topicId) datos.set("topicId", topicId);
    datos.set("visibility", datos.get("publico") ? "PUBLIC" : "COURSE");
    datos.delete("publico");
    if (tipo !== "FILE") datos.delete("file");
    const demasiado = tipo === "FILE" ? revisarTamano(datos.get("file")) : "";
    if (demasiado) return setError(demasiado);
    setError("");
    setCargando(true);
    try {
      const { material } =
        tipo === "FILE"
          ? await subirConAvance("/materials", datos, setAvance)
          : await api("/materials", { method: "POST", body: datos });
      form.reset();
      setTipo("FILE");
      onCreado?.(material);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
      setAvance(null);
    }
  }

  return (
    <form onSubmit={enviar} className="tarjeta flex flex-col gap-4 p-5">
      <div className="flex flex-wrap gap-4 text-sm">
        {[
          ["FILE", "Archivo"],
          ["LINK", "Enlace"],
          ["VIDEO", "Video de YouTube"],
        ].map(([valor, nombre]) => (
          <label key={valor} className="flex cursor-pointer items-center gap-2 accent-marca">
            <input type="radio" name="kind" value={valor} checked={tipo === valor} onChange={() => setTipo(valor)} />
            {nombre}
          </label>
        ))}
      </div>
      <Campo etiqueta="Título" name="title" required />
      <Campo etiqueta="Descripción (opcional)" name="description" />
      {tipo === "FILE" ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
          Archivo: PDF, Office, imagen, video (.mp4 o .webm), .psc, .dfd, .sb3, .ino o .zip. Máximo 20 MB; los videos, hasta 1 GB.
          <input type="file" name="file" required className="campo text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-marca/15 file:px-3 file:py-1 file:font-semibold file:text-enlace" />
        </label>
      ) : (
        <Campo etiqueta="Enlace" name="url" type="url" placeholder="https://" required />
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
        Herramienta
        <select name="tool" defaultValue={herramienta} className="campo font-normal">
          {HERRAMIENTAS.map((h) => (
            <option key={h.valor} value={h.valor}>{h.nombre}</option>
          ))}
        </select>
      </label>
      {courseId && (
        <label className="flex cursor-pointer items-center gap-2 text-sm accent-marca">
          <input type="checkbox" name="publico" /> Público: también aparece en la biblioteca para visitantes
        </label>
      )}
      <Aviso>{error}</Aviso>
      <div className="flex items-center gap-3">
        <Boton type="submit" cargando={cargando}>Agregar material</Boton>
        {avance !== null && (
          <span className="animate-pulse text-sm font-medium text-enlace" role="status">
            {avance < 100 ? `Subiendo... ${avance}%` : "Guardando..."}
          </span>
        )}
      </div>
    </form>
  );
}
