"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, useUsuario } from "@/lib/api";
import { colorNota, ESTADO_QUIZ, fechaHora, nota } from "@/lib/quizzes";
import { Aviso } from "@/components/Formulario";
import MasFalladas from "@/components/MasFalladas";

// Quizzes del curso. El docente los administra; el estudiante ve los publicados.
export default function Quizzes() {
  const { id } = useParams();
  const usuario = useUsuario();
  const [datos, setDatos] = useState(null);
  const [falladas, setFalladas] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/courses/${id}/quizzes`)
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        if (d.canEdit) api(`/courses/${id}/quiz-stats`).then((s) => vivo && setFalladas(s.mostFailed));
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id, usuario]);

  if (usuario === null) return <p className="tarjeta p-6"><Link href="/ingresar" className="font-semibold text-enlace underline">Ingrese</Link> para ver los quizzes.</p>;
  if (!datos) return <Aviso>{error}</Aviso>;

  const { course, canEdit, quizzes } = datos;

  return (
    <div className="flex flex-col gap-8">
      <div className="aparecer flex flex-col gap-2">
        <Link href={`/curso/${id}`} className="self-start text-sm text-foreground/60 transition hover:text-enlace">← {course.name}</Link>
        <h1 className="titulo-pagina">Quizzes</h1>
        <p className="text-foreground/70">
          {canEdit
            ? "Arme quizzes con su banco de preguntas. La plataforma los califica sola de 0,0 a 5,0."
            : "Cada quiz tiene un tiempo total; cuando se acaba, se envía solo con lo que alcanzó a responder."}
        </p>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <Link href={`/curso/${id}/quizzes/nuevo`} className="btn-primario px-5 py-2.5">+ Nuevo quiz</Link>
          <Link href={`/curso/${id}/preguntas`} className="btn-secundario px-5 py-2.5">Banco de preguntas</Link>
        </div>
      )}

      {quizzes.length === 0 && (
        <p className="tarjeta p-6 text-foreground/70">
          {canEdit ? "Todavía no hay quizzes. Empiece por crear preguntas en el banco." : "Todavía no hay quizzes publicados."}
        </p>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {quizzes.map((q) => (
          <li key={q.id}>
            <Link href={`/curso/${id}/quizzes/${q.id}`} className="tarjeta-viva flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-snug">{q.title}</h2>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_QUIZ[q.status].clase}`}>{ESTADO_QUIZ[q.status].nombre}</span>
              </div>
              <p className="text-sm text-foreground/65">
                {q.questionCount} preguntas · {q.timeLimitMinutes} min{q.isPractice ? " · Repaso sin nota" : ""}
                {q.topic ? ` · ${q.topic}` : ""}
              </p>
              <p className="text-xs text-foreground/60">
                {q.status === "UPCOMING" ? `Abre ${fechaHora(q.opensAt)}` : `Cierra ${fechaHora(q.closesAt)}`}
              </p>
              <div className="mt-auto flex items-end justify-between gap-3 border-t border-borde pt-3 text-sm">
                {canEdit ? (
                  <>
                    <span className="text-foreground/65">{q.submittedCount} presentaron</span>
                    <span className="text-foreground/65">
                      Promedio <span className={`font-bold ${colorNota(q.averageGrade)}`}>{nota(q.averageGrade)}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground/65">
                      {q.inProgressAttemptId ? "En curso" : q.bestGrade !== null ? "Presentado" : q.status === "OPEN" ? "Pendiente" : q.status === "CLOSED" ? "No presentado" : ""}
                    </span>
                    {q.bestGrade !== null && !q.isPractice && (
                      <span className="text-foreground/65">Nota <span className={`text-lg font-bold ${colorNota(q.bestGrade)}`}>{nota(q.bestGrade)}</span></span>
                    )}
                  </>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {canEdit && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Preguntas más falladas del curso</h2>
          <p className="text-sm text-foreground/65">En todos los quizzes. Le ayudan a saber qué tema reforzar en la próxima clase.</p>
          <MasFalladas preguntas={falladas} />
        </section>
      )}
    </div>
  );
}
