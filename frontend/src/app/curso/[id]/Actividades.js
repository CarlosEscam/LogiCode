"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { Estado, NOMBRE_ENTREGA, NOMBRE_TIPO, fecha, nota } from "@/components/actividades/comun";

// Actividades del curso en la página del curso (RF-15). El docente ve además
// cuántas entregas hay por revisar y los accesos a crear actividades y a las notas.
export default function Actividades({ courseId }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    api(`/courses/${courseId}/activities`)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [courseId]);

  if (!datos) return <Aviso>{error}</Aviso>;
  const { activities, canEdit } = datos;
  const porRevisar = activities.reduce((s, a) => s + (a.porRevisar ?? 0), 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Actividades</h2>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/curso/${courseId}/revision`} className="btn-secundario">
              Por revisar
              {porRevisar > 0 && <span className="rounded-full bg-amber-400 px-2 text-xs font-bold text-black">{porRevisar}</span>}
            </Link>
            <Link href={`/curso/${courseId}/notas`} className="btn-secundario">Notas</Link>
            <Link href={`/curso/${courseId}/actividades/nueva`} className="btn-primario">+ Nueva actividad</Link>
          </div>
        )}
      </div>
      {activities.length === 0 && (
        <p className="tarjeta p-5 text-foreground/70">
          {canEdit ? "Todavía no ha creado actividades." : "No hay actividades abiertas por ahora."}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {activities.map((a) => (
          <li key={a.id}>
            <Link href={`/curso/${courseId}/actividad/${a.id}`} className={`tono-${a.topic?.tool ?? "GENERAL"} tarjeta-viva flex h-full flex-col gap-2 p-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{NOMBRE_TIPO[a.type]}</span>
                <span className="text-xs text-foreground/55">{NOMBRE_ENTREGA[a.submissionType]}</span>
                {!canEdit && <Estado estado={a.estado} />}
              </div>
              <p className="font-semibold">{a.title}</p>
              <p className="text-sm text-foreground/65">
                {new Date(a.opensAt) > new Date() ? `Abre ${fecha(a.opensAt)}` : `Cierra ${fecha(a.closesAt)}`}
                {a.weight !== null && ` · ${a.weight} %`}
              </p>
              {canEdit ? (
                <p className="text-sm text-foreground/75">
                  {a.entregas} entrega(s)
                  {a.porRevisar > 0 && <span className="ml-2 font-semibold text-amber-300">{a.porRevisar} por revisar</span>}
                </p>
              ) : (
                a.nota !== null && <p className="text-sm">Nota: <strong>{nota(a.nota)}</strong></p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
