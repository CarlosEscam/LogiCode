"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useUsuario } from "@/lib/api";
import { colorNota, nota } from "@/lib/quizzes";
import { ESTADO_ACTIVIDAD, ESTADO_QUIZ_ESTUDIANTE, fechaCorta, NOMBRE_ACTIVIDAD, rutaActividad } from "@/lib/estudiante";
import { Aviso, Encabezado } from "@/components/Formulario";
import { EtiquetaHerramienta } from "@/components/Herramienta";

// Mis notas (RF-15, RF-17): cada actividad y quiz con su estado, su nota y la
// retroalimentación del docente o de la plataforma.
export default function MisNotas() {
  const usuario = useUsuario();
  const [cursos, setCursos] = useState(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("TODO");

  const esEstudiante = usuario?.role === "STUDENT";
  useEffect(() => {
    if (!esEstudiante) return;
    let vivo = true;
    api("/me/grades")
      .then((d) => vivo && setCursos(d.courses))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [esEstudiante]);

  if (usuario === undefined) return null;
  if (!esEstudiante) {
    return (
      <p className="tarjeta p-6">
        {usuario ? "Esta página es para estudiantes. Las notas del curso están en la planilla del docente." : (
          <><Link href="/ingresar" className="font-semibold text-enlace underline">Ingrese</Link> para ver sus notas.</>
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/panel" className="self-start text-sm text-foreground/60 transition hover:text-enlace">← Mi panel</Link>
        <Encabezado titulo="Mis notas">Lo que ha entregado, lo que le falta y lo que le dijo su docente.</Encabezado>
      </div>
      <Aviso>{error}</Aviso>

      {cursos && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar">
          {[
            ["TODO", "Todo"],
            ["PENDIENTE", "Por entregar"],
            ["CALIFICADA", "Calificadas"],
            ["EN_REVISION", "En revisión"],
          ].map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={filtro === valor}
              onClick={() => setFiltro(valor)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${filtro === valor ? "border-marca bg-marca/15 text-enlace" : "border-borde text-foreground/70 hover:border-marca/50"}`}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      {cursos?.length === 0 && <p className="tarjeta p-6 text-foreground/70">Todavía no está en ningún curso.</p>}

      {cursos?.map((c) => (
        <Curso key={c.id} curso={c} filtro={filtro} />
      ))}
    </div>
  );
}

// Los quizzes se filtran con los mismos nombres que las actividades.
const ESTADO_COMO_ACTIVIDAD = { PENDIENTE: "PENDIENTE", EN_CURSO: "PENDIENTE", PRESENTADO: "CALIFICADA", NO_PRESENTADO: "NO_ENTREGO", PROXIMO: "PROXIMO" };

function Curso({ curso, filtro }) {
  const actividades = curso.actividades.filter((a) => filtro === "TODO" || a.estado === filtro);
  const quizzes = curso.quizzes.filter((q) => filtro === "TODO" || ESTADO_COMO_ACTIVIDAD[q.estado] === filtro);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{curso.name}</h2>
          <p className="text-sm text-foreground/60">{curso.period} · Docente: {curso.teacher.fullName}</p>
        </div>
        <div className="tarjeta flex items-center gap-3 px-4 py-2">
          <span className="text-sm text-foreground/65">Definitiva hasta hoy</span>
          <span className={`text-2xl font-bold ${colorNota(curso.promedio)}`}>{nota(curso.promedio)}</span>
        </div>
      </div>
      <p className="text-xs text-foreground/60">
        Es la misma cuenta de la planilla de su docente: suma las notas puestas y, con 0,0, lo que venció sin entregar, con el porcentaje de cada actividad. Los quizzes de repaso no cuentan.
      </p>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">Tareas, talleres y evaluaciones</h3>
        {actividades.length === 0 ? (
          <p className="text-sm text-foreground/60">{curso.actividades.length ? "Nada con este filtro." : "El docente todavía no ha publicado actividades."}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {actividades.map((a) => (
              <li key={a.id}>
                <Actividad a={a} courseId={curso.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">Quizzes</h3>
        {quizzes.length === 0 ? (
          <p className="text-sm text-foreground/60">{curso.quizzes.length ? "Nada con este filtro." : "Todavía no hay quizzes publicados."}</p>
        ) : (
          <ul className="tarjeta divide-y divide-borde">
            {quizzes.map((q) => (
              <li key={q.id}>
                <Link href={`/curso/${curso.id}/quizzes/${q.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-foreground/[0.03]">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{q.title}{q.isPractice && <span className="ml-2 text-xs font-normal text-foreground/60">Repaso sin nota</span>}</span>
                    <span className="text-xs text-foreground/60">
                      {q.estado === "PROXIMO" ? `Abre ${fechaCorta(q.opensAt)}` : `Cierra ${fechaCorta(q.closesAt)}`}
                      {q.topic ? ` · ${q.topic.title}` : ""}
                    </span>
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_QUIZ_ESTUDIANTE[q.estado].clase}`}>{ESTADO_QUIZ_ESTUDIANTE[q.estado].nombre}</span>
                  <span className={`w-12 text-right text-xl font-bold ${q.isPractice ? "text-foreground/60" : colorNota(q.estado === "NO_PRESENTADO" ? 0 : q.nota)}`}>
                    {q.estado === "NO_PRESENTADO" && !q.isPractice ? "0,0" : nota(q.nota)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Actividad({ a, courseId }) {
  const estado = ESTADO_ACTIVIDAD[a.estado];
  const notaVisible = a.estado === "NO_ENTREGO" ? 0 : a.nota;
  return (
    <Link href={rutaActividad(courseId, a.id)} className={`tono-${a.topic?.tool ?? "GENERAL"} tarjeta-viva flex flex-col gap-3 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="chip">{NOMBRE_ACTIVIDAD[a.type]}</span>
            <span className="font-semibold">{a.title}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
            {a.topic && <EtiquetaHerramienta herramienta={a.topic.tool} />}
            {a.topic?.title}
            <span>{a.estado === "PENDIENTE" ? `Cierra ${fechaCorta(a.cierre)}` : a.entregadaEl ? `Entregada ${fechaCorta(a.entregadaEl)}` : `Cerró ${fechaCorta(a.cierre)}`}</span>
            {a.estado === "PENDIENTE" && a.intentosRestantes > 1 && <span>· {a.intentosRestantes} intentos</span>}
          </span>
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estado.clase}`}>{estado.nombre}</span>
        <span className={`w-12 text-right text-2xl font-bold ${colorNota(notaVisible)}`}>{nota(notaVisible)}</span>
      </div>
      {(a.comentario || a.observaciones) && (
        <div className="flex flex-col gap-2 border-t border-borde pt-3 text-sm">
          {a.comentario && (
            <p><span className="font-semibold text-enlace">Comentario del docente:</span> <span className="whitespace-pre-line text-foreground/85">{a.comentario}</span></p>
          )}
          {a.observaciones && (
            <p><span className="font-semibold text-enlace">Revisión de la plataforma:</span> <span className="whitespace-pre-line text-foreground/75">{a.observaciones}</span></p>
          )}
        </div>
      )}
    </Link>
  );
}
