"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, HERRAMIENTAS, useUsuario } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";
import Material from "@/components/Material";
import FormMaterial from "@/components/FormMaterial";
import { CuadroHerramienta, EtiquetaHerramienta } from "@/components/Herramienta";

// Temas y material de apoyo del curso (RF-06 a RF-09).
// El estudiante los ve; el docente además los organiza.
export default function Curso() {
  const { id } = useParams();
  const usuario = useUsuario();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/courses/${id}/topics`)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id, usuario, version]);

  async function accion(promesa) {
    setError("");
    try {
      await promesa;
      recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  if (usuario === null) {
    return (
      <p className="tarjeta p-6">
        <Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para ver el curso.
      </p>
    );
  }
  if (!datos) return <Aviso>{error}</Aviso>;

  const { course, canEdit, topics, otherMaterials } = datos;
  const proxima = topics.find((t) => t.isNextClass);

  return (
    <div className="flex flex-col gap-8">
      <div className="aparecer flex flex-col gap-2">
        <Link href="/panel" className="self-start text-sm text-foreground/60 transition hover:text-violet-300">← Mi panel</Link>
        <h1 className="titulo-pagina">{course.name}</h1>
        <p className="text-sm text-foreground/65">Periodo {course.period}</p>
      </div>
      <Aviso>{error}</Aviso>

      {proxima && (
        <a href={`#tema-${proxima.id}`} className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-amber-500/5 px-5 py-4 transition hover:border-amber-300/70">
          <span className="text-2xl" aria-hidden="true">⭐</span>
          <span>
            <span className="text-sm font-semibold text-amber-300">Próxima clase:</span> {proxima.title}
          </span>
        </a>
      )}

      {topics.length === 0 && <p className="tarjeta p-6 text-foreground/70">Todavía no hay temas en este curso.</p>}

      <ol className="flex flex-col gap-5">
        {topics.map((t, i) => (
          <li
            key={t.id}
            id={`tema-${t.id}`}
            className={`tono-${t.tool} tarjeta relative flex scroll-mt-24 flex-col gap-4 overflow-hidden p-5 sm:p-6 ${t.isNextClass ? "ring-1 ring-amber-400/50" : ""}`}
          >
            <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-tono" />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <CuadroHerramienta herramienta={t.tool} grande />
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/45">Tema {i + 1}</p>
                  <h2 className="text-xl font-bold tracking-tight">
                    {t.title} {t.isNextClass && <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 align-middle text-xs font-semibold text-amber-300">Próxima clase</span>}
                  </h2>
                  <div><EtiquetaHerramienta herramienta={t.tool} /></div>
                  {t.description && <p className="mt-1 text-foreground/75">{t.description}</p>}
                </div>
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-1">
                  <button type="button" disabled={i === 0} className="accion"
                    onClick={() => accion(api(`/topics/${t.id}/move`, { method: "POST", body: { direction: "up" } }))}>Subir</button>
                  <button type="button" disabled={i === topics.length - 1} className="accion"
                    onClick={() => accion(api(`/topics/${t.id}/move`, { method: "POST", body: { direction: "down" } }))}>Bajar</button>
                  <button type="button" className="accion"
                    onClick={() => accion(api(`/topics/${t.id}`, { method: "PATCH", body: { isNextClass: !t.isNextClass } }))}>
                    {t.isNextClass ? "Quitar próxima clase" : "Marcar próxima clase"}
                  </button>
                  <button type="button" className="accion-peligro"
                    onClick={() => window.confirm(`¿Borrar el tema "${t.title}"? Su material queda en el curso.`) && accion(api(`/topics/${t.id}`, { method: "DELETE" }))}>
                    Borrar tema
                  </button>
                </div>
              )}
            </div>
            <ListaMateriales materiales={t.materials} canEdit={canEdit} accion={accion} />
            {canEdit && (
              <details className="desplegable">
                <summary>Agregar material a este tema</summary>
                <div className="mt-3">
                  <FormMaterial courseId={course.id} topicId={t.id} herramienta={t.tool} onCreado={recargar} />
                </div>
              </details>
            )}
          </li>
        ))}
      </ol>

      {otherMaterials.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold tracking-tight">Otro material</h2>
          <ListaMateriales materiales={otherMaterials} canEdit={canEdit} accion={accion} />
        </section>
      )}

      {canEdit && <NuevoTema courseId={course.id} onCreado={recargar} />}
    </div>
  );
}

function ListaMateriales({ materiales, canEdit, accion }) {
  if (materiales.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {materiales.map((m) => (
        <Material
          key={m.id}
          material={m}
          onBorrar={canEdit ? () => window.confirm(`¿Borrar "${m.title}"?`) && accion(api(`/materials/${m.id}`, { method: "DELETE" })) : undefined}
          onCambiarVisibilidad={
            canEdit
              ? () => accion(api(`/materials/${m.id}`, { method: "PATCH", body: { visibility: m.visibility === "PUBLIC" ? "COURSE" : "PUBLIC" } }))
              : undefined
          }
        />
      ))}
    </ul>
  );
}

function NuevoTema({ courseId, onCreado }) {
  const [error, setError] = useState("");

  async function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    try {
      await api(`/courses/${courseId}/topics`, { method: "POST", body: Object.fromEntries(new FormData(form)) });
      form.reset();
      onCreado();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Nuevo tema</h2>
      <form onSubmit={enviar} className="tarjeta flex flex-col gap-4 p-5 sm:max-w-md">
        <Campo etiqueta="Título" name="title" required />
        <Campo etiqueta="Descripción (opcional)" name="description" />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
          Herramienta
          <select name="tool" defaultValue="PSEINT" className="campo font-normal">
            {HERRAMIENTAS.map((h) => (
              <option key={h.valor} value={h.valor}>{h.nombre}</option>
            ))}
          </select>
        </label>
        <Aviso>{error}</Aviso>
        <div>
          <Boton type="submit">Agregar tema</Boton>
        </div>
      </form>
    </section>
  );
}
