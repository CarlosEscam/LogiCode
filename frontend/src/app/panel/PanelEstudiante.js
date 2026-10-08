"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { colorNota, nota } from "@/lib/quizzes";
import { fechaCorta, NOMBRE_ACTIVIDAD, plazo, rutaPendiente } from "@/lib/estudiante";
import { JUEGOS } from "@/lib/juegos";
import { Aviso } from "@/components/Formulario";
import { CuadroHerramienta, Icono } from "@/components/Herramienta";

// Panel del estudiante (RF-15 a RF-18): lo que tiene por entregar, sus cursos con la
// próxima clase y el avance por tema, sus últimas notas y dónde practicar.
export default function PanelEstudiante() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    api("/me/summary")
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  if (!datos) return <Aviso>{error}</Aviso>;

  const { courses, pending, upcoming, recentGrades, practice, games } = datos;
  const proxima = courses.find((c) => c.nextClass);
  // La versión 1 tiene un curso; si hubiera varios, se muestra el promedio del primero que tenga notas.
  const promedio = courses.find((c) => c.promedio !== null)?.promedio ?? null;

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Cifra titulo="Por entregar" valor={pending.length} detalle={pending.length ? plazo(pending[0].closesAt).texto : "Está al día"} color={pending.length ? "text-acento" : "text-exito"} />
        <Cifra
          titulo="Próxima clase"
          valor={proxima ? proxima.nextClass.title : "Sin definir"}
          detalle={proxima ? proxima.name : "El docente la marca en el curso"}
          href={proxima ? `/curso/${proxima.id}#tema-${proxima.nextClass.id}` : undefined}
          pequeno
        />
        <Cifra
          titulo="Mis notas"
          valor={nota(promedio)}
          detalle={promedio !== null ? "Definitiva hasta hoy · ver detalle" : "Aún no tiene notas"}
          color={colorNota(promedio)}
          href="/mis-notas"
        />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">Por entregar</h2>
          <Link href="/mis-notas" className="text-sm text-enlace hover:text-enlace hover:underline">Ver todo lo entregado →</Link>
        </div>
        {pending.length === 0 ? (
          <p className="tarjeta flex items-center gap-3 p-5 text-foreground/75">
            <span className="text-2xl" aria-hidden="true">🎉</span>
            No tiene tareas, talleres, evaluaciones ni quizzes pendientes.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((p) => (
              <Pendiente key={`${p.kind}-${p.id}`} p={p} />
            ))}
          </ul>
        )}
        {upcoming.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">Próximamente</h3>
            <ul className="flex flex-col gap-2">
              {upcoming.map((q) => (
                <li key={q.id}>
                  <Link href={`/curso/${q.course.id}/quizzes/${q.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde bg-foreground/[0.03] px-4 py-2.5 text-sm transition hover:border-marca/50">
                    <span>
                      <span className="font-medium">{q.title}</span>
                      <span className="text-foreground/60"> · {q.isPractice ? "Quiz de repaso" : "Quiz"} · {q.course.name}</span>
                    </span>
                    <span className="text-enlace">Abre {fechaCorta(q.opensAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Mis cursos</h2>
        {courses.length === 0 && (
          <p className="tarjeta p-5 text-foreground/70">Todavía no está en ningún curso. Su docente debe agregar su cédula a la lista.</p>
        )}
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Curso curso={c} />
            </li>
          ))}
        </ul>
      </section>

      {recentGrades.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight">Últimas notas</h2>
            <Link href="/mis-notas" className="text-sm text-enlace hover:text-enlace hover:underline">Ver mis notas →</Link>
          </div>
          <ul className="tarjeta divide-y divide-borde">
            {recentGrades.map((g) => (
              <li key={`${g.kind}-${g.id}`} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{g.title}</span>
                  <span className="text-xs text-foreground/60">{g.kind === "QUIZ" ? "Quiz" : "Actividad"} · {g.course.name}</span>
                </span>
                <span className={`text-xl font-bold ${colorNota(g.nota)}`}>{nota(g.nota)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Practicar</h2>
        <p className="text-sm text-foreground/65">Sin nota: para repasar las veces que quiera.</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <Link href="/pseint" className="tono-PSEINT tarjeta-viva flex h-full flex-col gap-2 p-5">
              <CuadroHerramienta herramienta="PSEINT" />
              <span className="font-semibold">Editor de PSeInt</span>
              <span className="text-sm text-foreground/65">Escriba y pruebe sus algoritmos sin instalar nada.</span>
            </Link>
          </li>
          {JUEGOS.map((j) => {
            const mejor = games[j.clave];
            return (
              <li key={j.clave}>
                <Link href={j.ruta} className={`tono-${j.herramienta} tarjeta-viva flex h-full flex-col gap-2 p-5`}>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-tono/30 bg-tono/15 text-xl" aria-hidden="true">{j.emoji}</span>
                  <span className="font-semibold">{j.nombre}</span>
                  <span className="text-sm text-foreground/65">{j.descripcion}</span>
                  <span className="mt-auto pt-1 text-xs font-medium text-tono">
                    {mejor?.score !== undefined ? `Mejor: ${mejor.score} de ${mejor.maxScore}` : "Aún no ha jugado"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {practice.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">Quizzes de repaso abiertos</h3>
            <ul className="flex flex-wrap gap-2">
              {practice.map((q) => (
                <li key={q.id}>
                  <Link href={`/curso/${q.course.id}/quizzes/${q.id}`} className="btn-secundario">
                    🔁 {q.title}
                    {q.nota !== null && <span className={`text-xs ${colorNota(q.nota)}`}>({nota(q.nota)})</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Cifra({ titulo, valor, detalle, color = "", href, pequeno = false }) {
  const contenido = (
    <>
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{titulo}</span>
      <span className={`${pequeno ? "text-lg leading-snug" : "text-3xl"} font-bold ${color}`}>{valor}</span>
      <span className="text-sm text-foreground/60">{detalle}</span>
    </>
  );
  const clase = "flex h-full flex-col gap-1 p-5";
  return href ? (
    <Link href={href} className={`tarjeta-viva ${clase}`}>{contenido}</Link>
  ) : (
    <div className={`tarjeta ${clase}`}>{contenido}</div>
  );
}

function Pendiente({ p }) {
  const { texto, urgente } = plazo(p.closesAt);
  const herramienta = p.topic?.tool ?? "GENERAL";
  return (
    <li>
      <Link href={rutaPendiente(p)} className={`tono-${herramienta} tarjeta-viva flex flex-wrap items-center gap-4 p-4 sm:p-5`}>
        <CuadroHerramienta herramienta={herramienta} />
        <span className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="chip">{NOMBRE_ACTIVIDAD[p.kind === "QUIZ" ? "QUIZ" : p.type]}</span>
            <span className="font-semibold">{p.title}</span>
          </span>
          <span className="text-sm text-foreground/60">
            {p.course.name}
            {p.topic ? ` · ${p.topic.title}` : ""}
            {p.kind === "QUIZ" && p.timeLimitMinutes ? ` · ${p.timeLimitMinutes} min` : ""}
          </span>
        </span>
        <span className="flex w-full items-center justify-between gap-4 sm:w-auto">
          <span className="flex flex-col gap-0.5 sm:items-end sm:text-right">
            <span className={`text-sm font-semibold ${urgente ? "text-peligro" : "text-acento"}`}>{texto}</span>
            <span className="text-xs text-foreground/60">{fechaCorta(p.closesAt)}</span>
          </span>
          <span className="btn-primario py-1.5">{p.kind === "QUIZ" ? (p.attemptId ? "Continuar" : "Presentar") : "Entregar"}</span>
        </span>
      </Link>
    </li>
  );
}

function Curso({ curso }) {
  const temas = curso.temas.filter((t) => t.total > 0);
  return (
    <div className="tarjeta flex h-full flex-col gap-4 p-5">
      <Link href={`/curso/${curso.id}`} className="group flex flex-col gap-1">
        <span className="text-lg font-semibold">
          {curso.name} <span className="inline-block text-enlace transition group-hover:translate-x-1">→</span>
        </span>
        <span className="text-sm text-foreground/65">{curso.period} · Docente: {curso.teacher.fullName}</span>
      </Link>
      {curso.nextClass && (
        <Link href={`/curso/${curso.id}#tema-${curso.nextClass.id}`} className="flex items-center gap-2 rounded-xl border border-acento/40 bg-acento/10 px-3 py-2 text-sm transition hover:border-acento/70">
          <span aria-hidden="true">⭐</span>
          <span><span className="font-semibold text-acento">Próxima clase:</span> {curso.nextClass.title}</span>
        </Link>
      )}
      {temas.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Mi avance por tema</span>
          <ul className="flex flex-col gap-2">
            {temas.map((t) => (
              <li key={t.id} className={`tono-${t.tool} flex items-center gap-3 text-sm`}>
                <Icono herramienta={t.tool} className="h-4 w-4 shrink-0 text-tono" />
                <span className="w-32 shrink-0 truncate sm:w-40" title={t.title}>{t.title}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-label={`Avance en ${t.title}`} aria-valuemin={0} aria-valuemax={t.total} aria-valuenow={t.hechas}>
                  <span className="block h-full rounded-full bg-tono-vivo transition-all" style={{ width: `${(t.hechas / t.total) * 100}%` }} />
                </span>
                <span className="w-10 text-right text-xs text-foreground/60">{t.hechas}/{t.total}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-borde pt-3 text-sm">
        <Link href={`/curso/${curso.id}`} className="accion">📚 Temas y material</Link>
        <Link href={`/curso/${curso.id}/quizzes`} className="accion">🏆 Quizzes</Link>
        {curso.pendientes > 0 && <span className="ml-auto self-center text-xs font-semibold text-acento">{curso.pendientes} por entregar</span>}
      </div>
    </div>
  );
}
