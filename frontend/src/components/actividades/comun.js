"use client";

import { useEffect, useState } from "react";
import { pedirArchivo } from "@/lib/api";

// Piezas que comparten las pantallas de actividades, entregas y notas.

export const NOMBRE_TIPO = { TASK: "Tarea", WORKSHOP: "Taller", EVALUATION: "Evaluación" };

export const NOMBRE_ENTREGA = {
  TEXT: "Texto",
  FILE: "Archivo",
  PHOTO: "Foto",
  PSEINT: "Código PSeInt",
};

export function nota(n) {
  return n === null || n === undefined ? "—" : Number(n).toFixed(1).replace(".", ",");
}

export function fecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

// Valor para un <input type="datetime-local"> en la hora del navegador.
export function paraInputFecha(iso) {
  const d = new Date(iso);
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

const ESTADOS = {
  PENDIENTE: ["Pendiente", "border-sky-400/40 bg-sky-400/10 text-sky-300"],
  VENCIDA: ["No entregó", "border-rose-400/40 bg-rose-400/10 text-rose-300"],
  SUBMITTED: ["Calificando...", "border-violet-400/40 bg-violet-400/10 text-violet-200"],
  IN_REVIEW: ["En revisión", "border-amber-400/40 bg-amber-400/10 text-amber-300"],
  GRADED: ["Calificada", "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"],
};

export function Estado({ estado }) {
  const [texto, color] = ESTADOS[estado] ?? [estado, ""];
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>{texto}</span>;
}

// Lo que la plataforma revisó: casos de prueba, bloques de Scratch o la lectura de la IA.
export function DetalleCalificacion({ entrega, paraDocente = false }) {
  const d = entrega.gradingDetails;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {entrega.gradingNotes && <p className="text-foreground/80">{entrega.gradingNotes}</p>}
      {d?.tipo === "casos" && d.resultados?.length > 0 && (
        <ol className="flex flex-col gap-2">
          {d.resultados.map((r, i) => (
            <li key={i} className={`rounded-xl border p-3 ${r.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
              <p className="font-semibold">{r.ok ? "✓" : "✗"} Caso {i + 1}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Bloque titulo="Entrada" texto={r.entrada || "(sin datos)"} />
                <Bloque titulo="Salida esperada" texto={r.esperado} />
                <Bloque titulo="Salida del algoritmo" texto={r.obtenido || "(no escribió nada)"} />
              </div>
              {r.error && <p className="mt-2 text-rose-300">{r.error}</p>}
            </li>
          ))}
        </ol>
      )}
      {d?.tipo === "scratch" && (
        <ul className="flex flex-col gap-1">
          {d.revisiones.map((r) => (
            <li key={r.clave} className={r.ok ? "text-emerald-300" : "text-rose-300"}>
              {r.ok ? "✓" : "✗"} {r.nombre}
            </li>
          ))}
        </ul>
      )}
      {paraDocente && d?.lectura && (
        <details>
          <summary className="cursor-pointer text-foreground/70">Lo que leyó la IA</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 font-mono text-xs">{d.lectura}</pre>
        </details>
      )}
    </div>
  );
}

function Bloque({ titulo, texto }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">{titulo}</span>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-mono text-xs">{texto}</pre>
    </div>
  );
}

// Lo que entregó el estudiante: texto, código, foto o archivo.
export function ContenidoEntrega({ entrega }) {
  const esImagen = /\.(png|jpe?g|gif|webp)$/i.test(entrega.fileName ?? "");
  return (
    <div className="flex flex-col gap-2">
      {entrega.textAnswer && (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 font-mono text-sm">{entrega.textAnswer}</pre>
      )}
      {entrega.hasFile && <ArchivoEntrega entrega={entrega} esImagen={esImagen} />}
    </div>
  );
}

function ArchivoEntrega({ entrega, esImagen }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    let creada = null;
    pedirArchivo(`/submissions/${entrega.id}/file`)
      .then((blob) => {
        if (!vivo) return;
        creada = URL.createObjectURL(blob);
        setUrl(creada);
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [entrega.id]);

  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!url) return <p className="text-sm text-foreground/60">Cargando archivo...</p>;
  return (
    <div className="flex flex-col gap-1">
      {esImagen && (
        // next/image no sirve para URLs locales del navegador (blob:).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Entrega: ${entrega.fileName}`} className="max-h-[70vh] max-w-full self-start rounded-xl object-contain" />
      )}
      <a href={url} download={entrega.fileName} className="accion self-start">
        Descargar {entrega.fileName}
      </a>
    </div>
  );
}
