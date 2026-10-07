"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Aviso } from "@/components/Formulario";

// Por ahora, los cursos del estudiante. Actividades y notas llegan en las siguientes fases.
export default function PanelEstudiante() {
  const [cursos, setCursos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    api("/courses")
      .then((d) => vivo && setCursos(d.courses))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Mis cursos</h2>
      <Aviso>{error}</Aviso>
      <ul className="flex flex-col gap-2">
        {cursos?.map((c) => (
          <li key={c.id} className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20">
            <p className="font-medium">{c.name}</p>
            <p className="text-sm opacity-70">{c.period} · Docente: {c.teacher.fullName}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
