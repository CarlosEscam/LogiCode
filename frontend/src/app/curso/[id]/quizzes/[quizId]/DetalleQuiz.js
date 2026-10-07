"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, useUsuario } from "@/lib/api";
import { colorNota, duracion, ESTADO_QUIZ, fechaHora, nota } from "@/lib/quizzes";
import { Aviso, Boton } from "@/components/Formulario";
import FormQuiz from "@/components/FormQuiz";
import MasFalladas from "@/components/MasFalladas";
import { Enunciado, textoCorrecta } from "@/components/Pregunta";

// Detalle de un quiz: el docente lo edita y ve los resultados; el estudiante lo presenta.
export default function DetalleQuiz() {
  const { id, quizId } = useParams();
  const usuario = useUsuario();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/quizzes/${quizId}`)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [quizId, usuario, version]);

  if (usuario === null) return <p className="tarjeta p-6"><Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para ver el quiz.</p>;
  if (!datos) return <Aviso>{error}</Aviso>;

  const { quiz } = datos;
  const estado = ESTADO_QUIZ[quiz.status];

  return (
    <div className="flex flex-col gap-8">
      <div className="aparecer flex flex-col gap-2">
        <Link href={`/curso/${id}/quizzes`} className="self-start text-sm text-foreground/60 transition hover:text-violet-300">← Quizzes</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="titulo-pagina">{quiz.title}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estado.clase}`}>{estado.nombre}</span>
          {quiz.isPractice && <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-300">Repaso sin nota</span>}
        </div>
        <p className="text-sm text-foreground/65">
          {quiz.questionCount} preguntas · {quiz.timeLimitMinutes} minutos · abre {fechaHora(quiz.opensAt)} · cierra {fechaHora(quiz.closesAt)}
          {quiz.topic ? ` · Tema: ${quiz.topic}` : ""}
        </p>
        {quiz.description && <p className="whitespace-pre-wrap text-foreground/80">{quiz.description}</p>}
      </div>
      <Aviso>{error}</Aviso>
      {datos.canEdit ? <VistaDocente datos={datos} courseId={id} recargar={recargar} setError={setError} /> : <VistaEstudiante datos={datos} />}
    </div>
  );
}

function VistaEstudiante({ datos }) {
  const router = useRouter();
  const { quiz, attempts, attemptsAllowed } = datos;
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const enCurso = attempts.find((a) => !a.submittedAt);
  const quedan = attemptsAllowed === null ? Infinity : attemptsAllowed - attempts.length;

  async function empezar() {
    if (!enCurso && !window.confirm(`Tendrá ${quiz.timeLimitMinutes} minutos desde que empiece. El reloj sigue aunque cierre la página. ¿Empezar?`)) return;
    setCargando(true);
    setError("");
    try {
      const { attemptId } = await api(`/quizzes/${quiz.id}/start`, { method: "POST" });
      router.push(`/quiz/${attemptId}`);
    } catch (e) {
      setError(e.message);
      setCargando(false);
    }
  }

  return (
    <>
      <div className="tarjeta flex flex-col gap-4 p-6">
        <ul className="flex flex-col gap-1.5 text-sm text-foreground/75">
          <li>⏱ Tiene {quiz.timeLimitMinutes} minutos en total. Cuando se acaban, el quiz se envía solo.</li>
          <li>💾 Sus respuestas se guardan mientras responde; si se cae la conexión, puede volver a entrar.</li>
          {!quiz.isPractice && <li>🎯 La nota va de 0,0 a 5,0 y depende solo de los aciertos.</li>}
          <li>🏆 {quiz.isPractice ? "Al terminar ve las respuestas correctas." : "Las respuestas correctas y el ranking se ven cuando cierra el quiz."}</li>
          {attemptsAllowed !== null && <li>🔁 Intentos: {attempts.length} de {attemptsAllowed}.</li>}
        </ul>
        <Aviso>{error}</Aviso>
        {quiz.status === "OPEN" && (enCurso || quedan > 0) && (
          <div>
            <Boton onClick={empezar} cargando={cargando}>{enCurso ? "Continuar el quiz" : attempts.length ? "Presentar otra vez" : "Empezar el quiz"}</Boton>
          </div>
        )}
        {quiz.status === "OPEN" && !enCurso && quedan <= 0 && (
          <p className="text-sm text-foreground/65">Ya usó sus intentos. Si necesita otro, pídaselo al docente.</p>
        )}
        {quiz.status === "UPCOMING" && <p className="text-sm text-sky-300">El quiz abre el {fechaHora(quiz.opensAt)}.</p>}
        {quiz.status === "CLOSED" && attempts.length === 0 && <p className="text-sm text-rose-300">El quiz cerró y no lo presentó.</p>}
      </div>

      {attempts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Mis intentos</h2>
          <ul className="flex flex-col gap-2">
            {attempts.map((a) => (
              <li key={a.id} className="tarjeta flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="text-sm text-foreground/70">
                  Intento {a.attemptNumber} · {a.submittedAt ? `enviado ${fechaHora(a.submittedAt)}${a.autoSubmitted ? " (se acabó el tiempo)" : ""}` : "en curso"}
                </span>
                <span className="flex items-center gap-4">
                  {a.submittedAt && (
                    <span className="text-sm text-foreground/70">
                      {quiz.isPractice ? `${a.correctCount} de ${quiz.questionCount} correctas` : <>Nota <span className={`text-lg font-bold ${colorNota(a.grade)}`}>{nota(a.grade)}</span></>}
                    </span>
                  )}
                  <Link href={`/quiz/${a.id}`} className="accion text-violet-300">{a.submittedAt ? "Ver" : "Continuar"}</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Ranking quizId={quiz.id} />
    </>
  );
}

function Ranking({ quizId, filas: filasDadas }) {
  const [datos, setDatos] = useState(filasDadas ? { available: true, ranking: filasDadas } : null);

  useEffect(() => {
    if (filasDadas) return;
    let vivo = true;
    api(`/quizzes/${quizId}/ranking`).then((d) => vivo && setDatos(d)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [quizId, filasDadas]);

  const filas = filasDadas ?? datos?.ranking;
  if (!datos) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold tracking-tight">🏆 Ranking</h2>
      {!datos.available ? (
        <p className="tarjeta p-5 text-sm text-foreground/65">El ranking se publica cuando cierra el quiz, el {fechaHora(datos.closesAt)}.</p>
      ) : filas.length === 0 ? (
        <p className="tarjeta p-5 text-sm text-foreground/65">Nadie ha presentado el quiz todavía.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {filas.map((f) => (
            <li
              key={f.studentId}
              className={`tarjeta flex items-center gap-4 px-5 py-3 ${f.isMe ? "ring-2 ring-marca" : ""} ${f.position <= 3 ? "bg-gradient-to-r from-amber-500/10 to-transparent" : ""}`}
            >
              <span className="w-8 text-center text-xl font-bold">{["🥇", "🥈", "🥉"][f.position - 1] ?? f.position}</span>
              <span className="flex-1 font-medium">{f.fullName}{f.isMe && <span className="ml-2 text-xs text-violet-300">(usted)</span>}</span>
              <span className="hidden text-sm text-foreground/55 sm:inline">{f.correctCount} correctas · {duracion(f.seconds)}</span>
              <span className={`text-lg font-bold ${colorNota(f.grade)}`}>{nota(f.grade)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function VistaDocente({ datos, courseId, recargar, setError }) {
  const router = useRouter();
  const { quiz, questions, hasAttempts } = datos;
  const [editando, setEditando] = useState(false);
  const [temas, setTemas] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [aviso, setAviso] = useState("");
  const [versionResultados, setVersionResultados] = useState(0);

  useEffect(() => {
    let vivo = true;
    api(`/courses/${courseId}/topics`).then((d) => vivo && setTemas(d.topics)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [courseId]);

  useEffect(() => {
    let vivo = true;
    api(`/quizzes/${quiz.id}/results`)
      .then((d) => vivo && setResultados(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [quiz.id, versionResultados, setError]);

  async function accion(promesa, texto) {
    setError("");
    setAviso("");
    try {
      await promesa;
      if (texto) setAviso(texto);
      recargar();
      setVersionResultados((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrar() {
    const texto = hasAttempts ? "Se borrarán también los intentos y las notas de los estudiantes." : "";
    if (!window.confirm(`¿Borrar el quiz "${quiz.title}"? ${texto}`)) return;
    try {
      await api(`/quizzes/${quiz.id}`, { method: "DELETE" });
      router.push(`/curso/${courseId}/quizzes`);
    } catch (e) {
      setError(e.message);
    }
  }

  if (editando) {
    return (
      <FormQuiz
        courseId={courseId}
        temas={temas}
        quiz={quiz}
        preguntas={questions}
        bloqueado={hasAttempts}
        onCancelar={() => setEditando(false)}
        onGuardado={() => {
          setEditando(false);
          accion(Promise.resolve(), "Quiz guardado.");
        }}
      />
    );
  }

  const r = resultados;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primario" onClick={() => accion(api(`/quizzes/${quiz.id}`, { method: "PATCH", body: { published: !quiz.published } }), quiz.published ? "El quiz volvió a borrador." : "Quiz publicado: ya lo ven los estudiantes del curso.")}>
          {quiz.published ? "Ocultar (pasar a borrador)" : "Publicar"}
        </button>
        <button type="button" className="btn-secundario" onClick={() => setEditando(true)}>Editar</button>
        <button type="button" className="btn-secundario" onClick={() => accion(Promise.resolve())}>Actualizar resultados</button>
        <button type="button" className="accion-peligro px-4" onClick={borrar}>Borrar quiz</button>
      </div>
      <Aviso tipo="ok">{aviso}</Aviso>

      {r && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold tracking-tight">Resultados</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra titulo="Presentaron" valor={`${r.summary.submitted} de ${r.summary.students}`} />
            <Cifra titulo="Promedio" valor={nota(r.summary.average)} color={colorNota(r.summary.average)} />
            <Cifra titulo="Aprobaron (≥ 3,0)" valor={r.summary.passed} />
            <Cifra titulo="Preguntas" valor={quiz.questionCount} />
          </div>
          {r.students.length === 0 ? (
            <p className="tarjeta p-5 text-sm text-foreground/65">El curso no tiene cédulas cargadas todavía.</p>
          ) : (
            <div className="tarjeta overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-borde bg-white/5 text-xs uppercase tracking-wide text-foreground/60">
                  <tr>
                    <th className="px-4 py-3">Estudiante</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Nota</th>
                    <th className="px-4 py-3">Intentos</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {r.students.map((s) => (
                    <tr key={s.cedula} className="border-b border-borde/60 transition last:border-0 hover:bg-white/5">
                      <td className="px-4 py-2.5">
                        <p>{s.fullName ?? "—"}</p>
                        <p className="font-mono text-xs text-foreground/50">{s.cedula}</p>
                      </td>
                      <td className="px-4 py-2.5"><EstadoEstudiante s={s} /></td>
                      <td className={`px-4 py-2.5 text-base font-bold ${colorNota(s.grade)}`}>{nota(s.grade)}</td>
                      <td className="px-4 py-2.5 text-foreground/70">
                        {s.attempts.length}{s.attemptsAllowed !== null ? ` de ${s.attemptsAllowed}` : ""}
                        {s.attempts.some((a) => a.autoSubmitted) && <span className="block text-xs text-amber-300">se le acabó el tiempo</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="flex flex-wrap justify-end gap-1">
                          {s.bestAttemptId && <Link href={`/quiz/${s.bestAttemptId}`} className="accion text-violet-300">Ver respuestas</Link>}
                          {s.registered && !quiz.isPractice && s.attempts.length > 0 && (
                            <button
                              type="button"
                              className="accion"
                              onClick={() =>
                                window.confirm(`¿Habilitar otro intento a ${s.fullName}?`) &&
                                accion(api(`/quizzes/${quiz.id}/allowances`, { method: "POST", body: { studentId: s.studentId } }), `${s.fullName} tiene un intento más.`)
                              }
                            >
                              + Intento
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {r && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Preguntas más falladas</h2>
          <MasFalladas preguntas={r.questionStats} vacio="Cuando los estudiantes presenten el quiz verá aquí qué preguntas fallan más." />
        </section>
      )}

      {r && <Ranking quizId={quiz.id} filas={r.ranking} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Preguntas y respuestas</h2>
        <ol className="flex flex-col gap-3">
          {questions.map((p, i) => (
            <li key={p.id} className="tarjeta flex flex-col gap-3 p-5">
              <Enunciado pregunta={p} numero={i + 1} puntos={p.points} />
              <p className="whitespace-pre-wrap rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                <span className="font-semibold">Respuesta: </span>
                {p.type === "ORDER_STEPS" || p.type === "OUTPUT" ? "\n" : ""}
                {textoCorrecta(p)}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function Cifra({ titulo, valor, color = "" }) {
  return (
    <div className="tarjeta flex flex-col gap-1 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">{titulo}</p>
      <p className={`text-2xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}

function EstadoEstudiante({ s }) {
  if (!s.registered) return <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-foreground/60">Sin cuenta</span>;
  const estilos = {
    SUBMITTED: ["Presentó", "bg-emerald-500/15 text-emerald-300"],
    IN_PROGRESS: ["Respondiendo", "bg-sky-500/15 text-sky-300"],
    NOT_STARTED: ["No ha presentado", "bg-white/10 text-foreground/60"],
  };
  const [texto, clase] = estilos[s.status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${clase}`}>{texto}</span>;
}
