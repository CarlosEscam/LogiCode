"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, useUsuario } from "@/lib/api";
import { colorNota, fechaHora, nota, reloj } from "@/lib/quizzes";
import { Aviso, Boton } from "@/components/Formulario";
import { CampoRespuesta, Enunciado, Revision } from "@/components/Pregunta";

// Presentar un quiz y ver el resultado del intento.
export default function Intento() {
  const { attemptId } = useParams();
  const usuario = useUsuario();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/quiz-attempts/${attemptId}`)
      .then((d) => vivo && setDatos({ ...d, desfase: new Date(d.serverNow).getTime() - Date.now() }))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [attemptId, usuario, version]);

  if (usuario === null) return <p className="tarjeta p-6"><Link href="/ingresar" className="font-semibold text-enlace underline">Ingrese</Link> para presentar el quiz.</p>;
  if (!datos) return <Aviso>{error}</Aviso>;

  const volver = `/curso/${datos.quiz.courseId}/quizzes/${datos.quiz.id}`;
  if (datos.inProgress && datos.questions) {
    return <Presentar datos={datos} onEnviado={() => setVersion((v) => v + 1)} />;
  }
  if (datos.inProgress) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={volver} className="self-start text-sm text-foreground/60 hover:text-enlace">← {datos.quiz.title}</Link>
        <p className="tarjeta p-6 text-foreground/75">{datos.student?.fullName} está respondiendo el quiz. Termina a las {fechaHora(datos.attempt.deadline)}.</p>
      </div>
    );
  }
  return <Resultado datos={datos} volver={volver} />;
}

function Presentar({ datos, onEnviado }) {
  const { quiz, attempt, questions, desfase } = datos;
  const [respuestas, setRespuestas] = useState(datos.answers ?? {});
  const [actual, setActual] = useState(0);
  const [restante, setRestante] = useState(() => new Date(attempt.deadline).getTime() - (Date.now() + desfase));
  const [guardando, setGuardando] = useState(0);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const temporizadores = useRef({});
  const respuestasRef = useRef(respuestas);
  const enviado = useRef(false);

  const guardar = useCallback(
    async (questionId, answer) => {
      setGuardando((n) => n + 1);
      try {
        await api(`/quiz-attempts/${attempt.id}/answers`, { method: "PUT", body: { questionId, answer } });
        setError("");
      } catch (e) {
        setError(e.message);
      }
      setGuardando((n) => n - 1);
    },
    [attempt.id],
  );

  function responder(pregunta, valor) {
    const nuevas = { ...respuestasRef.current, [pregunta.id]: valor };
    respuestasRef.current = nuevas;
    setRespuestas(nuevas);
    clearTimeout(temporizadores.current[pregunta.id]);
    // Lo que se escribe se guarda cuando deja de teclear; lo que se elige, de una vez.
    const espera = pregunta.type === "SHORT_ANSWER" || pregunta.type === "OUTPUT" ? 700 : 0;
    temporizadores.current[pregunta.id] = setTimeout(() => guardar(pregunta.id, valor), espera);
  }

  const enviar = useCallback(
    async (automatico) => {
      if (enviado.current) return;
      enviado.current = true;
      setEnviando(true);
      Object.values(temporizadores.current).forEach(clearTimeout);
      // Los pasos que no movió cuentan en el orden en que los ve.
      const todas = { ...respuestasRef.current };
      for (const q of questions) if (q.type === "ORDER_STEPS" && todas[q.id] === undefined) todas[q.id] = q.options;
      try {
        await api(`/quiz-attempts/${attempt.id}/submit`, { method: "POST", body: { answers: todas, auto: automatico } });
      } catch (e) {
        // Si el intento ya se había cerrado, igual se muestra el resultado.
        if (!/ya se envió/.test(e.message)) setError(e.message);
      }
      onEnviado();
    },
    [attempt.id, questions, onEnviado],
  );

  useEffect(() => {
    const t = setInterval(() => {
      const quedan = new Date(attempt.deadline).getTime() - (Date.now() + desfase);
      setRestante(quedan);
      if (quedan <= 0) {
        clearInterval(t);
        enviar(true);
      }
    }, 250);
    return () => clearInterval(t);
  }, [attempt.deadline, desfase, enviar]);

  // Aviso del navegador si intenta salir con respuestas sin guardar.
  useEffect(() => {
    const aviso = (e) => {
      if (guardando > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [guardando]);

  const respondida = (q) => {
    const v = respuestas[q.id];
    return v !== undefined && v !== null && v !== "";
  };
  const sinResponder = questions.filter((q) => !respondida(q) && q.type !== "ORDER_STEPS").length;
  const pregunta = questions[actual];
  const poco = restante < 60_000;
  const total = quiz.timeLimitMinutes * 60_000;

  function confirmarEnvio() {
    const texto = sinResponder ? `Tiene ${sinResponder} ${sinResponder === 1 ? "pregunta" : "preguntas"} sin responder. ` : "";
    if (window.confirm(`${texto}¿Enviar el quiz? Después no podrá cambiar sus respuestas.`)) enviar(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-[6.75rem] z-10 sm:top-16 -mx-1 flex flex-col gap-3 rounded-2xl border border-borde bg-background/90 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{quiz.title}</p>
            <p className="text-xs text-foreground/60">
              {guardando > 0 ? "Guardando..." : "Respuestas guardadas"} · {questions.length - sinResponder} de {questions.length} respondidas
            </p>
          </div>
          <div
            role="timer"
            aria-live={poco ? "assertive" : "off"}
            className={`rounded-xl px-4 py-2 font-mono text-2xl font-bold tabular-nums ${poco ? "animate-pulse bg-peligro/20 text-peligro" : "bg-foreground/10"}`}
          >
            {reloj(restante)}
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
          <div className={`h-full rounded-full transition-all ${poco ? "bg-peligro" : "bg-gradient-to-r from-marca to-marca-2"}`} style={{ width: `${Math.max(0, Math.min(100, (restante / total) * 100))}%` }} />
        </div>
      </div>

      <Aviso>{error}</Aviso>

      <nav aria-label="Preguntas" className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setActual(i)}
            aria-current={i === actual ? "step" : undefined}
            className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${i === actual ? "bg-cian-oscuro text-white shadow-md shadow-marca/30" : respondida(q) ? "bg-exito/20 text-exito" : "bg-foreground/10 text-foreground/70 hover:bg-foreground/15"}`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <div key={pregunta.id} className={`tono-${pregunta.tool} tarjeta aparecer relative flex flex-col gap-5 overflow-hidden p-5 sm:p-6`}>
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-tono-vivo" />
        <Enunciado pregunta={pregunta} numero={actual + 1} puntos={pregunta.points} />
        <CampoRespuesta pregunta={pregunta} valor={respuestas[pregunta.id]} onCambio={(v) => responder(pregunta, v)} deshabilitado={enviando} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" className="btn-secundario" disabled={actual === 0} onClick={() => setActual((i) => i - 1)}>← Anterior</button>
          {actual < questions.length - 1 && <button type="button" className="btn-secundario" onClick={() => setActual((i) => i + 1)}>Siguiente →</button>}
        </div>
        <Boton onClick={confirmarEnvio} cargando={enviando}>Enviar quiz</Boton>
      </div>
    </div>
  );
}

function Resultado({ datos, volver }) {
  const { quiz, attempt, review, revealed, student, questionCount } = datos;
  return (
    <div className="flex flex-col gap-8">
      <div className="aparecer flex flex-col gap-2">
        <Link href={volver} className="self-start text-sm text-foreground/60 transition hover:text-enlace">← {quiz.title}</Link>
        <h1 className="titulo-pagina">{student ? `Respuestas de ${student.fullName}` : "Quiz enviado"}</h1>
        <p className="text-sm text-foreground/65">
          Intento {attempt.attemptNumber} · enviado {fechaHora(attempt.submittedAt)}
          {attempt.autoSubmitted && " · se envió solo porque se acabó el tiempo"}
        </p>
      </div>

      <div className="tarjeta flex flex-wrap items-center gap-8 p-6">
        {!quiz.isPractice && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Nota</p>
            <p className={`text-5xl font-bold ${colorNota(attempt.grade)}`}>{nota(attempt.grade)}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Correctas</p>
          <p className="text-3xl font-bold">{attempt.correctCount} <span className="text-lg text-foreground/60">de {questionCount}</span></p>
        </div>
      </div>

      {revealed ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Revisión</h2>
          <ol className="flex flex-col gap-3">
            {review.map((item, i) => <Revision key={item.id} item={item} numero={i + 1} />)}
          </ol>
        </section>
      ) : (
        <p className="tarjeta p-5 text-foreground/70">
          Las respuestas correctas y el ranking se publican cuando cierre el quiz ({fechaHora(quiz.closesAt)}).
        </p>
      )}
    </div>
  );
}
