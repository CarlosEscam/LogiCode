"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { NOMBRE_TIPO, fecha } from "@/components/actividades/comun";

// Lo que el estudiante tiene por entregar y sus cursos; cada curso lleva a sus temas, material y actividades.
export default function PanelEstudiante() {
  const [cursos, setCursos] = useState(null);
  const [pendientes, setPendientes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    Promise.all([api("/courses"), api("/activities/pending")])
      .then(([c, p]) => {
        if (!vivo) return;
        setCursos(c.courses);
        // Se marca lo que cierra en menos de un día.
        const ahora = Date.now();
        setPendientes(p.activities.map((a) => ({ ...a, pronto: new Date(a.closesAt) - ahora < 86400000 })));
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <Aviso>{error}</Aviso>
      {pendientes?.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Por entregar</h2>
          <ul className="flex flex-col gap-2">
            {pendientes.map((a) => (
              <li key={a.id}>
                <Link href={`/curso/${a.course.id}/actividad/${a.id}`} className="tarjeta-viva flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <span>
                    <span className="chip mr-2">{NOMBRE_TIPO[a.type]}</span>
                    <span className="font-semibold">{a.title}</span>
                    <span className="ml-2 text-sm text-foreground/55">{a.course.name}</span>
                  </span>
                  <span className={`text-sm ${a.pronto ? "font-semibold text-amber-300" : "text-foreground/70"}`}>
                    Cierra {fecha(a.closesAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Mis cursos</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {cursos?.map((c) => (
            <li key={c.id}>
              <Link href={`/curso/${c.id}`} className="tarjeta-viva group flex flex-col gap-1 p-5">
                <p className="text-lg font-semibold">
                  {c.name} <span className="inline-block text-marca-2 transition group-hover:translate-x-1">→</span>
                </p>
                <p className="text-sm text-foreground/65">{c.period} · Docente: {c.teacher.fullName}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
