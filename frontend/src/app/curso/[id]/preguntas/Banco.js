"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, HERRAMIENTAS, useUsuario } from "@/lib/api";
import { TIPOS_PREGUNTA } from "@/lib/quizzes";
import { Aviso } from "@/components/Formulario";
import FormPregunta from "@/components/FormPregunta";
import { Enunciado, textoCorrecta } from "@/components/Pregunta";

// Banco de preguntas del docente (RF-25): crear, editar, filtrar y reutilizar.
export default function Banco() {
  const { id } = useParams();
  const usuario = useUsuario();
  const [preguntas, setPreguntas] = useState(null);
  const [temas, setTemas] = useState([]);
  const [curso, setCurso] = useState(null);
  const [filtro, setFiltro] = useState({ tool: "", type: "", topicId: "", q: "", archived: "" });
  const [editando, setEditando] = useState(null);
  // El formulario de nueva pregunta empieza abierto si el banco está vacío y sigue abierto al guardar.
  const [abierto, setAbierto] = useState(false);
  const primeraCarga = useRef(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/courses/${id}/topics`)
      .then((d) => vivo && (setTemas(d.topics), setCurso(d.course)))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id, usuario]);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    const params = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v));
    const t = setTimeout(() => {
      api(`/courses/${id}/questions?${params}`)
        .then((d) => {
          if (!vivo) return;
          setPreguntas(d.questions);
          if (primeraCarga.current && d.questions.length === 0) setAbierto(true);
          primeraCarga.current = false;
        })
        .catch((e) => vivo && setError(e.message));
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [id, usuario, filtro, version]);

  async function accion(promesa, texto) {
    setError("");
    setAviso("");
    try {
      const r = await promesa;
      if (texto) setAviso(typeof texto === "function" ? texto(r) : texto);
      recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  if (usuario === null) return <p className="tarjeta p-6"><Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para ver el banco.</p>;

  const cambiarFiltro = (campo) => (e) => setFiltro((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <div className="flex flex-col gap-8">
      <div className="aparecer flex flex-col gap-2">
        <Link href={`/curso/${id}/quizzes`} className="self-start text-sm text-foreground/60 transition hover:text-violet-300">← Quizzes</Link>
        <h1 className="titulo-pagina">Banco de preguntas</h1>
        <p className="text-foreground/70">
          Sus preguntas sirven para todos sus quizzes, en este curso y en los de otros semestres.
          {curso && <span className="text-foreground/50"> · {curso.name} {curso.period}</span>}
        </p>
      </div>
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{aviso}</Aviso>

      <details className="desplegable" open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)}>
        <summary>Nueva pregunta</summary>
        <div className="mt-3">
          <FormPregunta courseId={id} temas={temas} onGuardada={() => accion(Promise.resolve(), "Pregunta guardada en el banco.")} />
        </div>
      </details>

      <section className="flex flex-col gap-4">
        <div className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input value={filtro.q} onChange={cambiarFiltro("q")} placeholder="Buscar en el enunciado" className="campo lg:col-span-2" aria-label="Buscar" />
          <select value={filtro.tool} onChange={cambiarFiltro("tool")} className="campo" aria-label="Herramienta">
            <option value="">Todas las herramientas</option>
            {HERRAMIENTAS.map((h) => <option key={h.valor} value={h.valor}>{h.nombre}</option>)}
          </select>
          <select value={filtro.type} onChange={cambiarFiltro("type")} className="campo" aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {TIPOS_PREGUNTA.map((t) => <option key={t.valor} value={t.valor}>{t.nombre}</option>)}
          </select>
          <select value={filtro.topicId} onChange={cambiarFiltro("topicId")} className="campo" aria-label="Tema">
            <option value="">Todos los temas</option>
            {temas.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-foreground/70 lg:col-span-5">
            <input type="checkbox" checked={filtro.archived === "1"} onChange={(e) => setFiltro((f) => ({ ...f, archived: e.target.checked ? "1" : "" }))} className="accent-violet-500" />
            Ver las archivadas
          </label>
        </div>

        {preguntas && (
          <p className="text-sm text-foreground/60">{preguntas.length === 1 ? "1 pregunta" : `${preguntas.length} preguntas`}</p>
        )}

        <ul className="flex flex-col gap-4">
          {preguntas?.map((p) =>
            editando === p.id ? (
              <li key={p.id}>
                <FormPregunta
                  courseId={id}
                  temas={temas}
                  pregunta={p}
                  onCancelar={() => setEditando(null)}
                  onGuardada={(_, recalificados) => {
                    setEditando(null);
                    accion(
                      Promise.resolve(),
                      recalificados ? `Pregunta guardada. Se recalcularon ${recalificados} intentos que ya la habían respondido.` : "Pregunta guardada.",
                    );
                  }}
                />
              </li>
            ) : (
              <li key={p.id} className={`tono-${p.tool} tarjeta relative flex flex-col gap-4 overflow-hidden p-5`}>
                <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-tono" />
                <Enunciado pregunta={p} />
                {p.type === "MULTIPLE_CHOICE" && (
                  <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                    {p.options.map((o, i) => (
                      <li key={i} className={`rounded-lg px-3 py-1.5 ${i === p.correctAnswer ? "bg-emerald-500/15 text-emerald-200" : "bg-white/5 text-foreground/75"}`}>
                        {String.fromCharCode(65 + i)}. {o} {i === p.correctAnswer && "✓"}
                      </li>
                    ))}
                  </ul>
                )}
                {p.type !== "MULTIPLE_CHOICE" && (
                  <p className="whitespace-pre-wrap rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                    <span className="font-semibold">Respuesta: </span>
                    {p.type === "ORDER_STEPS" || p.type === "OUTPUT" ? "\n" : ""}
                    {textoCorrecta(p)}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/55">
                  <span>
                    {p.topic ? `Tema: ${p.topic} · ` : ""}
                    {p.usedInQuizzes ? `En ${p.usedInQuizzes} ${p.usedInQuizzes === 1 ? "quiz" : "quizzes"}` : "Sin usar"}
                    {p.answered ? ` · ${p.answered} respuestas` : ""}
                  </span>
                  <span className="flex gap-1">
                    {!p.archived && <button type="button" className="accion" onClick={() => setEditando(p.id)}>Editar</button>}
                    {p.archived ? (
                      <button type="button" className="accion" onClick={() => accion(api(`/questions/${p.id}`, { method: "PATCH", body: { archived: false } }), "Pregunta restaurada.")}>
                        Restaurar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="accion-peligro"
                        onClick={() =>
                          window.confirm("¿Borrar esta pregunta del banco? Si ya está en un quiz, se archiva.") &&
                          accion(api(`/questions/${p.id}`, { method: "DELETE" }), (r) => (r?.archived ? "La pregunta ya está en un quiz: quedó archivada." : "Pregunta borrada."))
                        }
                      >
                        Borrar
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
