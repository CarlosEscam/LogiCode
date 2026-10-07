"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Aviso } from "@/components/Formulario";

// Cursos del estudiante; cada uno lleva a sus temas y material. Actividades y notas llegan después.
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
      <h2 className="text-xl font-bold tracking-tight">Mis cursos</h2>
      <Aviso>{error}</Aviso>
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
  );
}
