"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, HERRAMIENTAS, NOMBRE_HERRAMIENTA, useUsuario } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";
import Material from "@/components/Material";
import FormMaterial from "@/components/FormMaterial";

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
      <p>
        <Link href="/ingresar" className="underline">Ingrese</Link> para ver el curso.
      </p>
    );
  }
  if (!datos) return <Aviso>{error}</Aviso>;

  const { course, canEdit, topics, otherMaterials } = datos;
  const proxima = topics.find((t) => t.isNextClass);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/panel" className="text-sm opacity-70 hover:underline">← Mi panel</Link>
        <h1 className="text-2xl font-semibold">{course.name}</h1>
        <p className="text-sm opacity-70">Periodo {course.period}</p>
      </div>
      <Aviso>{error}</Aviso>

      {proxima && (
        <a href={`#tema-${proxima.id}`} className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <span className="text-sm font-semibold">Próxima clase:</span> {proxima.title}
        </a>
      )}

      {topics.length === 0 && <p className="opacity-70">Todavía no hay temas en este curso.</p>}

      <ol className="flex flex-col gap-6">
        {topics.map((t, i) => (
          <li key={t.id} id={`tema-${t.id}`} className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/15">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">
                  {t.title} {t.isNextClass && <span className="ml-2 align-middle text-xs font-normal text-amber-700 dark:text-amber-300">Próxima clase</span>}
                </h2>
                <p className="text-xs opacity-60">{NOMBRE_HERRAMIENTA[t.tool]}</p>
                {t.description && <p className="mt-1 opacity-80">{t.description}</p>}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-3 text-sm">
                  <button type="button" disabled={i === 0} className="hover:underline disabled:opacity-30"
                    onClick={() => accion(api(`/topics/${t.id}/move`, { method: "POST", body: { direction: "up" } }))}>Subir</button>
                  <button type="button" disabled={i === topics.length - 1} className="hover:underline disabled:opacity-30"
                    onClick={() => accion(api(`/topics/${t.id}/move`, { method: "POST", body: { direction: "down" } }))}>Bajar</button>
                  <button type="button" className="hover:underline"
                    onClick={() => accion(api(`/topics/${t.id}`, { method: "PATCH", body: { isNextClass: !t.isNextClass } }))}>
                    {t.isNextClass ? "Quitar próxima clase" : "Marcar próxima clase"}
                  </button>
                  <button type="button" className="text-red-600 hover:underline dark:text-red-400"
                    onClick={() => window.confirm(`¿Borrar el tema "${t.title}"? Su material queda en el curso.`) && accion(api(`/topics/${t.id}`, { method: "DELETE" }))}>
                    Borrar tema
                  </button>
                </div>
              )}
            </div>
            <ListaMateriales materiales={t.materials} canEdit={canEdit} accion={accion} />
            {canEdit && (
              <details className="text-sm">
                <summary className="cursor-pointer">Agregar material a este tema</summary>
                <div className="mt-2">
                  <FormMaterial courseId={course.id} topicId={t.id} herramienta={t.tool} onCreado={recargar} />
                </div>
              </details>
            )}
          </li>
        ))}
      </ol>

      {otherMaterials.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/15">
          <h2 className="text-xl font-semibold">Otro material</h2>
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
    <ul className="flex flex-col gap-2">
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
    <section className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/15">
      <h2 className="text-xl font-semibold">Nuevo tema</h2>
      <form onSubmit={enviar} className="flex flex-col gap-3 sm:max-w-md">
        <Campo etiqueta="Título" name="title" required />
        <Campo etiqueta="Descripción (opcional)" name="description" />
        <label className="flex flex-col gap-1 text-sm">
          Herramienta
          <select name="tool" defaultValue="PSEINT" className="rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/25">
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
