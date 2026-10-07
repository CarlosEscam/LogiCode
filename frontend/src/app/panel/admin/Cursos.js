"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { useDatos } from "./comun";

// Todos los cursos con su docente y cifras. El administrador puede pasar un curso a otro docente.
export default function Cursos() {
  const [version, setVersion] = useState(0);
  const { datos, error, setError } = useDatos("/admin/courses", version);
  const docentes = useDatos("/admin/users?role=TEACHER&status=ACTIVE");

  async function reasignar(curso, teacherId) {
    const nuevo = docentes.datos?.users.find((d) => d.id === Number(teacherId));
    if (!nuevo || !window.confirm(`¿Pasar "${curso.name}" a ${nuevo.fullName}?`)) return;
    setError("");
    try {
      await api(`/admin/courses/${curso.id}`, { method: "PATCH", body: { teacherId: nuevo.id } });
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Cursos</h2>
      <Aviso>{error || docentes.error}</Aviso>
      {datos?.courses.length === 0 && (
        <p className="tarjeta p-5 text-sm text-foreground/70">Todavía no hay cursos. Los crea el docente desde su panel.</p>
      )}
      <ul className="flex flex-col gap-3">
        {datos?.courses.map((c) => (
          <li key={c.id} className="tarjeta flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{c.name}</p>
                <p className="text-sm text-foreground/65">Periodo {c.period} · docente {c.teacher.fullName}</p>
              </div>
              <Link href={`/curso/${c.id}`} className="btn-secundario py-1.5">Abrir curso</Link>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="chip tono-GENERAL">{c.counts.roster} cédulas habilitadas</span>
              <span className="chip tono-ARDUINO">{c.counts.registered} con cuenta</span>
              <span className="chip tono-PSEINT">{c.counts.topics} temas</span>
              <span className="chip tono-DFD">{c.counts.materials} materiales</span>
              <span className="chip tono-SCRATCH">{c.counts.quizzes} quizzes</span>
            </div>
            <label className="flex flex-wrap items-center gap-2 text-sm text-foreground/75">
              Pasar a otro docente:
              <select value="" onChange={(e) => reasignar(c, e.target.value)} className="campo py-1.5 text-sm">
                <option value="">Elegir docente…</option>
                {docentes.datos?.users
                  .filter((d) => d.id !== c.teacher.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
                  ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
