"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, useUsuario } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import Calificar from "@/components/actividades/Calificar";
import { ContenidoEntrega, DetalleCalificacion, NOMBRE_TIPO, fecha } from "@/components/actividades/comun";

// Entregas que la plataforma no pudo calificar con seguridad: fotos con baja confianza,
// errores de sintaxis, proyectos de Scratch, Arduino y archivos sin calificador (RF-13).
export default function Revision() {
  const { id } = useParams();
  const usuario = useUsuario();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/courses/${id}/review`)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id, usuario, version]);

  if (usuario === null) {
    return (
      <p className="tarjeta p-6">
        <Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para revisar entregas.
      </p>
    );
  }
  if (!datos) return <Aviso>{error}</Aviso>;

  const { course, submissions } = datos;
  return (
    <div className="flex flex-col gap-6">
      <div className="aparecer flex flex-col gap-2">
        <Link href={`/curso/${id}`} className="self-start text-sm text-foreground/60 transition hover:text-violet-300">← {course.name}</Link>
        <h1 className="titulo-pagina">Por revisar</h1>
        <p className="text-sm text-foreground/65">
          La plataforma dejó aquí lo que no pudo calificar con seguridad. Revise la entrega, confirme o ajuste la nota propuesta y
          el estudiante la verá de inmediato.
        </p>
      </div>
      <Aviso>{error}</Aviso>
      {submissions.length === 0 && <p className="tarjeta p-6 text-foreground/75">No hay entregas por revisar. 🎉</p>}
      <ul className="flex flex-col gap-4">
        {submissions.map((s) => (
          <li key={s.id} className="tarjeta flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-semibold">{s.student.fullName}</p>
                <p className="text-sm text-foreground/60">
                  <Link href={`/curso/${id}/actividad/${s.activity.id}`} className="hover:text-violet-300 hover:underline">
                    {NOMBRE_TIPO[s.activity.type]}: {s.activity.title}
                  </Link>{" "}
                  · intento {s.attemptNumber} · {fecha(s.submittedAt)}
                </p>
              </div>
            </div>
            <ContenidoEntrega entrega={s} />
            <DetalleCalificacion entrega={s} paraDocente />
            <Calificar entrega={s} maximo={s.activity.maxGrade} onGuardada={() => setVersion((v) => v + 1)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
