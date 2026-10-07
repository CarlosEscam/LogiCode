"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, HERRAMIENTAS } from "@/lib/api";
import { NOMBRE_TIPO, paraInputFecha } from "@/lib/quizzes";
import { Aviso, Boton, Campo } from "@/components/Formulario";
import { EtiquetaHerramienta } from "@/components/Herramienta";

const TIEMPOS = [10, 15, 20, 30, 45, 60, 90];

function inicial(quiz, preguntas) {
  const ahora = new Date();
  ahora.setMinutes(0, 0, 0);
  ahora.setHours(ahora.getHours() + 1);
  const cierre = new Date(ahora.getTime() + 7 * 24 * 3_600_000);
  return {
    title: quiz?.title ?? "",
    description: quiz?.description ?? "",
    topicId: quiz?.topicId ?? "",
    timeLimitMinutes: quiz?.timeLimitMinutes ?? 30,
    opensAt: paraInputFecha(quiz?.opensAt ?? ahora),
    closesAt: paraInputFecha(quiz?.closesAt ?? cierre),
    maxAttempts: quiz?.maxAttempts ?? 1,
    isPractice: quiz?.isPractice ?? false,
    shuffleQuestions: quiz?.shuffleQuestions ?? true,
    published: quiz?.published ?? false,
    elegidas: preguntas?.map((p) => ({ ...p, points: p.points ?? 1 })) ?? [],
  };
}

// Crea o edita un quiz con preguntas del banco. Con bloqueado, ya hay intentos
// y las preguntas no se pueden cambiar.
export default function FormQuiz({ courseId, temas = [], quiz, preguntas, bloqueado, onGuardado, onCancelar }) {
  const [f, setF] = useState(() => inicial(quiz, preguntas));
  const [banco, setBanco] = useState(null);
  const [filtro, setFiltro] = useState({ tool: "", topicId: "", q: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const cambiar = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));

  useEffect(() => {
    if (bloqueado) return;
    let vivo = true;
    const params = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v));
    const t = setTimeout(() => {
      api(`/courses/${courseId}/questions?${params}`)
        .then((d) => vivo && setBanco(d.questions))
        .catch((e) => vivo && setError(e.message));
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [courseId, filtro, bloqueado]);

  const elegidaIds = new Set(f.elegidas.map((p) => p.id));
  const agregar = (p) => cambiar("elegidas", [...f.elegidas, { ...p, points: 1 }]);
  const agregarTodas = () => cambiar("elegidas", [...f.elegidas, ...banco.filter((p) => !elegidaIds.has(p.id)).map((p) => ({ ...p, points: 1 }))]);
  const quitar = (id) => cambiar("elegidas", f.elegidas.filter((p) => p.id !== id));
  const puntos = (id, valor) => cambiar("elegidas", f.elegidas.map((p) => (p.id === id ? { ...p, points: valor } : p)));
  function mover(i, delta) {
    const lista = [...f.elegidas];
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    cambiar("elegidas", lista);
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    const body = {
      title: f.title,
      description: f.description,
      topicId: f.topicId || null,
      timeLimitMinutes: Number(f.timeLimitMinutes),
      opensAt: new Date(f.opensAt).toISOString(),
      closesAt: new Date(f.closesAt).toISOString(),
      maxAttempts: Number(f.maxAttempts),
      isPractice: f.isPractice,
      shuffleQuestions: f.shuffleQuestions,
      published: f.published,
    };
    if (!bloqueado) body.questions = f.elegidas.map((p) => ({ questionId: p.id, points: Number(String(p.points).replace(",", ".")) }));
    setCargando(true);
    try {
      const r = quiz
        ? await api(`/quizzes/${quiz.id}`, { method: "PATCH", body })
        : await api(`/courses/${courseId}/quizzes`, { method: "POST", body });
      onGuardado?.(r.quiz);
    } catch (err) {
      setError(err.message);
    }
    setCargando(false);
  }

  const etiqueta = "flex flex-col gap-1.5 text-sm font-medium text-foreground/90";
  const totalPuntos = f.elegidas.reduce((s, p) => s + (Number(String(p.points).replace(",", ".")) || 0), 0);

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <div className="tarjeta flex flex-col gap-4 p-5">
        <Campo etiqueta="Título" value={f.title} onChange={(e) => cambiar("title", e.target.value)} required placeholder="Quiz 1: ciclos en PSeInt" />
        <label className={etiqueta}>
          Instrucciones (opcional)
          <textarea value={f.description} onChange={(e) => cambiar("description", e.target.value)} rows={2} className="campo font-normal" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={etiqueta}>
            Tema (opcional)
            <select value={f.topicId} onChange={(e) => cambiar("topicId", e.target.value)} className="campo font-normal">
              <option value="">Sin tema</option>
              {temas.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          <label className={etiqueta}>
            Tiempo total para responder
            <div className="flex gap-2">
              <select
                value={TIEMPOS.includes(Number(f.timeLimitMinutes)) ? f.timeLimitMinutes : "otro"}
                onChange={(e) => e.target.value !== "otro" && cambiar("timeLimitMinutes", Number(e.target.value))}
                className="campo flex-1 font-normal"
              >
                {TIEMPOS.map((t) => <option key={t} value={t}>{t} minutos</option>)}
                <option value="otro">Otro</option>
              </select>
              <input type="number" min={1} max={300} value={f.timeLimitMinutes} onChange={(e) => cambiar("timeLimitMinutes", e.target.value)} className="campo w-24 font-normal" aria-label="Minutos" />
            </div>
          </label>
          <Campo etiqueta="Abre" type="datetime-local" value={f.opensAt} onChange={(e) => cambiar("opensAt", e.target.value)} required />
          <Campo etiqueta="Cierra" type="datetime-local" value={f.closesAt} onChange={(e) => cambiar("closesAt", e.target.value)} required />
          {!f.isPractice && (
            <Campo etiqueta="Intentos por estudiante" type="number" min={1} max={10} value={f.maxAttempts} onChange={(e) => cambiar("maxAttempts", e.target.value)} required />
          )}
        </div>
        <p className="text-xs text-foreground/55">
          Cuando se acaba el tiempo, el quiz se envía solo con lo que el estudiante alcanzó a responder. La nota va de 0,0 a 5,0
          y depende solo de los aciertos. Las respuestas correctas y el ranking se muestran cuando cierra el quiz.
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.isPractice} onChange={(e) => cambiar("isPractice", e.target.checked)} className="accent-violet-500" />
            Quiz de repaso: sin nota, intentos ilimitados y las respuestas se ven al terminar
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.shuffleQuestions} onChange={(e) => cambiar("shuffleQuestions", e.target.checked)} className="accent-violet-500" />
            Cambiar el orden de las preguntas para cada estudiante
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.published} onChange={(e) => cambiar("published", e.target.checked)} className="accent-violet-500" />
            Publicado: los estudiantes del curso lo ven (si no, queda como borrador)
          </label>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">Preguntas del quiz</h2>
          <p className="text-sm text-foreground/60">
            {f.elegidas.length} {f.elegidas.length === 1 ? "pregunta" : "preguntas"} · {String(totalPuntos).replace(".", ",")} puntos
          </p>
        </div>
        {bloqueado && <Aviso>Ya hay estudiantes que presentaron este quiz: sus preguntas no se pueden cambiar.</Aviso>}
        {f.elegidas.length === 0 && <p className="tarjeta p-5 text-sm text-foreground/65">Agregue preguntas desde el banco, abajo.</p>}
        <ol className="flex flex-col gap-2">
          {f.elegidas.map((p, i) => (
            <li key={p.id} className={`tono-${p.tool} tarjeta flex flex-wrap items-center gap-3 px-4 py-3`}>
              <span className="w-6 text-right text-sm font-semibold text-foreground/50">{i + 1}.</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate">{p.statement}</p>
                <p className="flex items-center gap-2 text-xs text-foreground/55">
                  {NOMBRE_TIPO[p.type]} <EtiquetaHerramienta herramienta={p.tool} />
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-foreground/60">
                Puntos
                <input value={p.points} onChange={(e) => puntos(p.id, e.target.value)} disabled={bloqueado} inputMode="decimal" className="campo w-16 px-2 py-1 text-sm" />
              </label>
              {!bloqueado && (
                <span className="flex">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="accion" aria-label="Subir">↑</button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === f.elegidas.length - 1} className="accion" aria-label="Bajar">↓</button>
                  <button type="button" onClick={() => quitar(p.id)} className="accion-peligro">Quitar</button>
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {!bloqueado && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight">Banco de preguntas</h2>
            <Link href={`/curso/${courseId}/preguntas`} target="_blank" className="text-sm font-semibold text-violet-300 hover:underline">
              Crear preguntas en el banco ↗
            </Link>
          </div>
          <div className="tarjeta grid gap-3 p-4 sm:grid-cols-3">
            <input value={filtro.q} onChange={(e) => setFiltro((x) => ({ ...x, q: e.target.value }))} placeholder="Buscar" className="campo" aria-label="Buscar en el banco" />
            <select value={filtro.tool} onChange={(e) => setFiltro((x) => ({ ...x, tool: e.target.value }))} className="campo" aria-label="Herramienta">
              <option value="">Todas las herramientas</option>
              {HERRAMIENTAS.map((h) => <option key={h.valor} value={h.valor}>{h.nombre}</option>)}
            </select>
            <select value={filtro.topicId} onChange={(e) => setFiltro((x) => ({ ...x, topicId: e.target.value }))} className="campo" aria-label="Tema">
              <option value="">Todos los temas</option>
              {temas.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          {banco?.length === 0 && (
            <p className="tarjeta p-5 text-sm text-foreground/65">
              No hay preguntas con ese filtro. <Link href={`/curso/${courseId}/preguntas`} className="font-semibold text-violet-300 underline">Vaya al banco</Link> para crearlas.
            </p>
          )}
          {banco?.some((p) => !elegidaIds.has(p.id)) && (
            <button type="button" onClick={agregarTodas} className="accion self-start">+ Agregar todas las que se ven</button>
          )}
          <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
            {banco?.map((p) => (
              <li key={p.id} className={`tono-${p.tool} flex items-center gap-3 rounded-xl border border-borde bg-white/5 px-4 py-2.5`}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm">{p.statement}</p>
                  <p className="flex items-center gap-2 text-xs text-foreground/55">
                    {NOMBRE_TIPO[p.type]} <EtiquetaHerramienta herramienta={p.tool} /> {p.topic && <span>· {p.topic}</span>}
                  </p>
                </div>
                {elegidaIds.has(p.id) ? (
                  <span className="text-xs font-semibold text-emerald-300">Agregada ✓</span>
                ) : (
                  <button type="button" onClick={() => agregar(p)} className="accion text-violet-300">+ Agregar</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Aviso>{error}</Aviso>
      <div className="flex gap-2">
        <Boton type="submit" cargando={cargando}>{quiz ? "Guardar cambios" : "Crear quiz"}</Boton>
        {onCancelar && <button type="button" onClick={onCancelar} className="btn-secundario">Cancelar</button>}
      </div>
    </form>
  );
}
