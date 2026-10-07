"use client";

import { useState } from "react";
import Link from "next/link";
import { api, HERRAMIENTAS, NOMBRE_HERRAMIENTA } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { Icono } from "@/components/Herramienta";
import FormMaterial from "@/components/FormMaterial";
import { fecha, tamano, useDatos } from "./comun";

const TIPO = { FILE: "Archivo", LINK: "Enlace", VIDEO: "Video" };

// Todo el material público: el que se subió directo a la biblioteca y el que el docente
// marcó como público en su curso. El administrador lo corrige, lo cambia de sección o lo quita.
export default function BibliotecaAdmin() {
  const [version, setVersion] = useState(0);
  const { datos, error, setError } = useDatos("/library", version);
  const [editando, setEditando] = useState(null);

  async function guardar(e, m) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    try {
      await api(`/materials/${m.id}`, {
        method: "PATCH",
        body: { title: f.get("title"), description: f.get("description"), tool: f.get("tool") },
      });
      setEditando(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function quitarDePublico(m) {
    if (!window.confirm(`"${m.title}" dejará de verse en la biblioteca, pero seguirá en su curso. ¿Continuar?`)) return;
    setError("");
    try {
      await api(`/materials/${m.id}`, { method: "PATCH", body: { visibility: "COURSE" } });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrar(m) {
    if (!window.confirm(`¿Borrar "${m.title}"? No se puede deshacer.`)) return;
    setError("");
    try {
      await api(`/materials/${m.id}`, { method: "DELETE" });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  const materiales = datos?.materials;
  const peso = materiales?.reduce((t, m) => t + (m.fileSize ?? 0), 0) ?? 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold tracking-tight">Biblioteca pública</h2>
        <Link href="/biblioteca" className="accion text-violet-300">Ver como visitante →</Link>
      </div>
      {materiales && (
        <p className="text-sm text-foreground/65">
          {materiales.length} materiales públicos{peso > 0 && ` · ${tamano(peso)} en archivos`}
        </p>
      )}

      <details className="desplegable">
        <summary>Subir material a la biblioteca</summary>
        <div className="mt-3">
          <FormMaterial onCreado={() => setVersion((v) => v + 1)} />
        </div>
      </details>

      <Aviso>{error}</Aviso>
      {materiales?.length === 0 && <p className="tarjeta p-5 text-sm text-foreground/70">La biblioteca está vacía.</p>}
      <ul className="flex flex-col gap-2">
        {materiales?.map((m) => (
          <li key={m.id} className={`tarjeta tono-${m.tool} p-4`}>
            {editando === m.id ? (
              <form onSubmit={(e) => guardar(e, m)} className="flex flex-col gap-3">
                <input name="title" defaultValue={m.title} required aria-label="Título" className="campo" />
                <textarea name="description" defaultValue={m.description ?? ""} rows={2} aria-label="Descripción" className="campo" />
                <div className="flex flex-wrap gap-2">
                  <select name="tool" defaultValue={m.tool} aria-label="Sección" className="campo">
                    {HERRAMIENTAS.map((h) => (
                      <option key={h.valor} value={h.valor}>{h.nombre}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn-primario">Guardar</button>
                  <button type="button" className="btn-secundario" onClick={() => setEditando(null)}>Cancelar</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Icono herramienta={m.tool} className="mt-0.5 h-5 w-5 shrink-0 text-tono" />
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-sm text-foreground/60">
                      {NOMBRE_HERRAMIENTA[m.tool]} · {TIPO[m.kind]}
                      {m.fileSize ? ` · ${tamano(m.fileSize)}` : ""} · {m.uploadedBy ?? "—"} · {fecha(m.createdAt)}
                      {m.courseId ? " · de un curso" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="accion" onClick={() => setEditando(m.id)}>Editar</button>
                  {m.courseId && (
                    <button type="button" className="accion" onClick={() => quitarDePublico(m)}>Quitar de la biblioteca</button>
                  )}
                  <button type="button" className="accion-peligro" onClick={() => borrar(m)}>Borrar</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
