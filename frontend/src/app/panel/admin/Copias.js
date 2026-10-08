"use client";

import { useState } from "react";
import { api, descargarConSesion } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { tamano, useDatos } from "./comun";

function fechaHora(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

// Copias de seguridad de la base (RNF-07): la API hace una al día y guarda las últimas 14.
export default function Copias() {
  const [version, setVersion] = useState(0);
  const { datos, error, setError } = useDatos("/admin/backups", version);
  const [aviso, setAviso] = useState("");
  const [haciendo, setHaciendo] = useState(false);

  async function hacerAhora() {
    setError("");
    setAviso("");
    setHaciendo(true);
    try {
      const { backup } = await api("/admin/backups", { method: "POST" });
      setAviso(`Copia guardada: ${backup.name}`);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setHaciendo(false);
    }
  }

  async function descargar(nombre) {
    setError("");
    try {
      await descargarConSesion(`/admin/backups/${encodeURIComponent(nombre)}`, nombre);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Copias de seguridad</h2>
      <p className="text-sm text-foreground/70">
        LogiCode guarda sola una copia de la base de datos cada día mientras está encendida, y conserva las 14 más recientes en la carpeta
        <code className="mx-1 rounded bg-foreground/10 px-1.5">backend/copias</code>. Descargue una de vez en cuando y guárdela fuera del computador.
        Los archivos subidos (material y videos) están en <code className="mx-1 rounded bg-foreground/10 px-1.5">backend/uploads</code> y se copian aparte.
      </p>
      <div>
        <button type="button" className="btn-primario" disabled={haciendo} onClick={hacerAhora}>
          {haciendo ? "Haciendo la copia..." : "Hacer una copia ahora"}
        </button>
      </div>
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{aviso}</Aviso>
      {datos?.backups.length === 0 && <p className="tarjeta p-5 text-sm text-foreground/70">Todavía no hay copias.</p>}
      {datos?.backups.length > 0 && (
        <ul className="tarjeta divide-y divide-borde">
          {datos.backups.map((c) => (
            <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{fechaHora(c.createdAt)}</span>
                <span className="text-foreground/60"> · {tamano(c.size)}</span>
              </span>
              <button type="button" className="accion text-enlace" onClick={() => descargar(c.name)}>Descargar</button>
            </li>
          ))}
        </ul>
      )}
      <details className="text-sm text-foreground/70">
        <summary className="cursor-pointer font-medium text-foreground/85">¿Cómo se restaura una copia?</summary>
        <p className="mt-2">
          Con la API detenida, en la carpeta <code className="rounded bg-foreground/10 px-1.5">backend</code> ejecute
          <code className="mx-1 rounded bg-foreground/10 px-1.5">npm run restaurar-copia -- copias/NOMBRE-DE-LA-COPIA.json.gz</code>
          y escriba SI. Se borra lo que hay en la base y se carga la copia.
        </p>
      </details>
    </section>
  );
}
