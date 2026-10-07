"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, subirConAvance, useUsuario } from "@/lib/api";
import { Aviso, Boton } from "@/components/Formulario";
import FormActividad from "@/components/actividades/FormActividad";
import Calificar from "@/components/actividades/Calificar";
import EditorPseint, { PLANTILLA_PSEINT } from "@/components/actividades/EditorPseint";
import {
  ContenidoEntrega, DetalleCalificacion, Estado, NOMBRE_ENTREGA, NOMBRE_TIPO, fecha, nota,
} from "@/components/actividades/comun";

// Una actividad: el estudiante la entrega y ve su nota (RF-16, RF-17);
// el docente la edita, da prórrogas y califica las entregas (RF-11, RF-13, RF-27).
export default function Actividad() {
  const { id, aid } = useParams();
  const usuario = useUsuario();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/activities/${aid}`)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [aid, usuario, version]);

  // Mientras alguna entrega se está calificando (fotos con IA), se consulta cada pocos segundos.
  const calificando = datos && !datos.canEdit && datos.submissions.some((s) => s.status === "SUBMITTED");
  useEffect(() => {
    if (!calificando) return;
    const t = setTimeout(recargar, 3000);
    return () => clearTimeout(t);
  }, [calificando, datos, recargar]);

  if (usuario === null) {
    return (
      <p className="tarjeta p-6">
        <Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para ver la actividad.
      </p>
    );
  }
  if (!datos) return <Aviso>{error}</Aviso>;

  const a = datos.activity;
  return (
    <div className="flex flex-col gap-6">
      <div className="aparecer flex flex-col gap-2">
        <Link href={`/curso/${id}`} className="self-start text-sm text-foreground/60 transition hover:text-violet-300">← Volver al curso</Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`tono-${a.topic?.tool ?? "GENERAL"} chip`}>{NOMBRE_TIPO[a.type]}</span>
          <span className="text-sm text-foreground/60">Entrega: {NOMBRE_ENTREGA[a.submissionType]}</span>
          {a.topic && <span className="text-sm text-foreground/60">· Tema: {a.topic.title}</span>}
        </div>
        <h1 className="titulo-pagina">{a.title}</h1>
        <p className="text-sm text-foreground/70">
          Abre {fecha(a.opensAt)} · Cierra <strong>{fecha(a.closesAt)}</strong>
          {a.weight !== null && ` · ${a.weight} % de la definitiva`}
        </p>
      </div>
      <Aviso>{error}</Aviso>
      {datos.canEdit ? <VistaDocente datos={datos} courseId={id} recargar={recargar} /> : <VistaEstudiante datos={datos} recargar={recargar} />}
    </div>
  );
}

function Instrucciones({ actividad }) {
  if (!actividad.instructions && !actividad.rubric) return null;
  return (
    <section className="tarjeta flex flex-col gap-3 p-5">
      {actividad.instructions && <p className="whitespace-pre-wrap">{actividad.instructions}</p>}
      {actividad.rubric && (
        <p className="whitespace-pre-wrap text-sm text-foreground/75">
          <strong>Rúbrica:</strong> {actividad.rubric}
        </p>
      )}
    </section>
  );
}

// --- Estudiante -------------------------------------------------------------------

function VistaEstudiante({ datos, recargar }) {
  const a = datos.activity;
  const ultima = datos.submissions.at(-1);
  return (
    <>
      <Instrucciones actividad={a} />
      <section className="flex flex-wrap items-center gap-3 text-sm">
        {datos.nota !== null && (
          <span className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 font-semibold text-emerald-200">
            Su nota: {nota(datos.nota)} / {nota(a.maxGrade)}
          </span>
        )}
        <span className="text-foreground/70">
          {datos.intentosRestantes > 0 ? `Le queda(n) ${datos.intentosRestantes} intento(s).` : "Ya usó todos sus intentos."}
        </span>
      </section>

      {datos.puedeEntregar ? (
        <FormEntrega actividad={a} onEntregada={recargar} ultima={ultima} />
      ) : (
        !datos.submissions.length && <p className="tarjeta p-5 text-foreground/75">La actividad cerró sin entrega. Si necesita más tiempo, pídale una prórroga al docente.</p>
      )}

      {datos.submissions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Sus entregas</h2>
          {[...datos.submissions].reverse().map((s) => (
            <article key={s.id} className="tarjeta flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Intento {s.attemptNumber} · {fecha(s.submittedAt)}</p>
                <div className="flex items-center gap-2">
                  <Estado estado={s.status} />
                  {s.finalGrade !== null && <strong className="text-lg">{nota(s.finalGrade)}</strong>}
                </div>
              </div>
              {s.status === "IN_REVIEW" && <p className="text-sm text-amber-200">El docente revisará esta entrega y pondrá la nota.</p>}
              {s.teacherComment && (
                <p className="rounded-xl border border-marca/30 bg-marca/10 p-3 text-sm"><strong>Comentario del docente:</strong> {s.teacherComment}</p>
              )}
              <DetalleCalificacion entrega={s} />
              <details>
                <summary className="cursor-pointer text-sm text-foreground/70">Ver lo que entregó</summary>
                <div className="mt-2"><ContenidoEntrega entrega={s} /></div>
              </details>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

function FormEntrega({ actividad, onEntregada, ultima }) {
  const tipo = actividad.submissionType;
  const [codigo, setCodigo] = useState(ultima?.textAnswer ?? PLANTILLA_PSEINT);
  const [vista, setVista] = useState(null);
  const [avance, setAvance] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => () => vista && URL.revokeObjectURL(vista), [vista]);

  async function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const archivo = datos.get("file");
    const conArchivo = archivo && archivo.size > 0;
    if (!window.confirm("¿Entregar ahora? Después no podrá cambiar este intento.")) return;
    setError("");
    setCargando(true);
    try {
      if (conArchivo) {
        if (tipo === "PSEINT") datos.delete("textAnswer");
        await subirConAvance(`/activities/${actividad.id}/submissions`, datos, setAvance);
      } else {
        await api(`/activities/${actividad.id}/submissions`, { method: "POST", body: { textAnswer: tipo === "PSEINT" ? codigo : datos.get("textAnswer") } });
      }
      form.reset();
      setVista(null);
      onEntregada();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
      setAvance(null);
    }
  }

  return (
    <form onSubmit={enviar} className="tarjeta flex flex-col gap-4 p-5">
      <h2 className="text-lg font-bold">Entregar</h2>
      {tipo === "PSEINT" && (
        <>
          <EditorPseint codigo={codigo} onCambio={setCodigo} />
          <label className="flex flex-col gap-1.5 text-sm text-foreground/75">
            O suba su archivo .psc
            <input type="file" name="file" accept=".psc" className="text-sm" />
          </label>
        </>
      )}
      {tipo === "TEXT" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
          Su respuesta
          <textarea name="textAnswer" rows={8} required className="campo font-normal" />
        </label>
      )}
      {tipo === "PHOTO" && (
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground/90">
          Tome o suba una foto clara, con buena luz y sin cortar el contenido
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            required
            onChange={(e) => {
              const f = e.target.files?.[0];
              setVista(f ? URL.createObjectURL(f) : null);
            }}
            className="text-sm"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {vista && <img src={vista} alt="Foto que va a entregar" className="max-h-80 max-w-full self-start rounded-xl object-contain" />}
        </label>
      )}
      {tipo === "FILE" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
          Archivo (máximo 20 MB)
          <input type="file" name="file" required className="text-sm" />
        </label>
      )}
      <Aviso>{error}</Aviso>
      <div className="flex items-center gap-3">
        <Boton type="submit" cargando={cargando}>Entregar</Boton>
        {avance !== null && <span role="status" className="text-sm text-foreground/70">{avance < 100 ? `Subiendo... ${avance}%` : "Calificando..."}</span>}
      </div>
    </form>
  );
}

// --- Docente ----------------------------------------------------------------------

function VistaDocente({ datos, courseId, recargar }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState("");
  const a = datos.activity;

  async function borrar() {
    if (!window.confirm(`¿Borrar "${a.title}" con todas sus entregas y notas? No se puede deshacer.`)) return;
    try {
      await api(`/activities/${a.id}`, { method: "DELETE" });
      router.push(`/curso/${courseId}`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secundario" onClick={() => setEditando((v) => !v)}>{editando ? "Cancelar edición" : "Editar actividad"}</button>
        <button type="button" className="accion-peligro" onClick={borrar}>Borrar actividad</button>
      </div>
      <Aviso>{error}</Aviso>
      {editando ? (
        <FormActividad courseId={courseId} actividad={a} onGuardada={() => { setEditando(false); recargar(); }} />
      ) : (
        <>
          <Instrucciones actividad={a} />
          {a.expectedAnswer && (
            <p className="tarjeta whitespace-pre-wrap p-5 text-sm"><strong>Respuesta esperada (solo usted la ve):</strong> {a.expectedAnswer}</p>
          )}
          {a.testCases?.length > 0 && <p className="text-sm text-foreground/70">{a.testCases.length} caso(s) de prueba de PSeInt.</p>}
        </>
      )}
      <Prorrogas datos={datos} recargar={recargar} />
      <Entregas datos={datos} recargar={recargar} />
    </>
  );
}

function Prorrogas({ datos, recargar }) {
  const [paraTodos, setParaTodos] = useState(true);
  const [error, setError] = useState("");
  const registrados = datos.students.filter((s) => s.userId);

  async function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const studentIds = paraTodos ? [] : f.getAll("studentIds").map(Number);
    if (!paraTodos && !studentIds.length) return setError("Elija al menos un estudiante.");
    setError("");
    try {
      await api(`/activities/${datos.activity.id}/extensions`, {
        method: "POST",
        body: {
          studentIds,
          newClosesAt: f.get("newClosesAt") ? new Date(f.get("newClosesAt")).toISOString() : null,
          extraAttempts: Number(f.get("extraAttempts") || 0),
        },
      });
      form.reset();
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function quitar(ext) {
    try {
      await api(`/extensions/${ext.id}`, { method: "DELETE" });
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <details className="desplegable">
      <summary>Prórrogas e intentos extra ({datos.extensions.length})</summary>
      <div className="mt-3 flex flex-col gap-4">
        {datos.extensions.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {datos.extensions.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2">
                <span>
                  <strong>{x.student ?? "Todo el curso"}</strong>
                  {x.newClosesAt && ` · cierra ${fecha(x.newClosesAt)}`}
                  {x.extraAttempts > 0 && ` · ${x.extraAttempts} intento(s) extra`}
                </span>
                <button type="button" className="accion-peligro" onClick={() => quitar(x)}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={enviar} className="tarjeta flex flex-col gap-4 p-5">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={paraTodos} onChange={() => setParaTodos(true)} /> Todo el curso</label>
            <label className="flex items-center gap-2"><input type="radio" checked={!paraTodos} onChange={() => setParaTodos(false)} /> Algunos estudiantes</label>
          </div>
          {!paraTodos && (
            <div className="grid max-h-60 gap-1.5 overflow-auto sm:grid-cols-2">
              {registrados.map((s) => (
                <label key={s.userId} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="studentIds" value={s.userId} /> {s.fullName}
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
              Nueva fecha de cierre
              <input type="datetime-local" name="newClosesAt" className="campo font-normal" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
              Intentos extra
              <input type="number" name="extraAttempts" min="0" max="5" defaultValue="0" className="campo w-24 font-normal" />
            </label>
            <button type="submit" className="btn-primario">Dar prórroga</button>
          </div>
          <Aviso>{error}</Aviso>
        </form>
      </div>
    </details>
  );
}

function Entregas({ datos, recargar }) {
  const [abierto, setAbierto] = useState(null);
  const a = datos.activity;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold tracking-tight">Entregas de los estudiantes</h2>
      <ul className="flex flex-col gap-2">
        {datos.students.map((s) => {
          const ultima = s.submissions.at(-1);
          const clave = s.cedula;
          return (
            <li key={clave} className="tarjeta overflow-hidden">
              <button
                type="button"
                onClick={() => setAbierto(abierto === clave ? null : clave)}
                disabled={!s.submissions.length}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-white/5 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span>
                  <span className="font-semibold">{s.fullName ?? "(sin nombre)"}</span>
                  <span className="ml-2 text-sm text-foreground/55">{s.cedula}{!s.userId && " · sin registrarse"}</span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  {ultima ? <Estado estado={ultima.status} /> : <span className="text-foreground/55">{new Date(s.closesAt) < new Date() ? "No entregó" : "Sin entrega"}</span>}
                  <strong className="w-10 text-right">{nota(s.nota)}</strong>
                </span>
              </button>
              {abierto === clave && (
                <div className="flex flex-col gap-4 border-t border-borde p-4">
                  {[...s.submissions].reverse().map((e) => (
                    <article key={e.id} className="flex flex-col gap-3">
                      <p className="text-sm font-semibold">Intento {e.attemptNumber} · {fecha(e.submittedAt)} <Estado estado={e.status} /></p>
                      <ContenidoEntrega entrega={e} />
                      <DetalleCalificacion entrega={e} paraDocente />
                      <Calificar entrega={e} maximo={a.maxGrade} onGuardada={recargar} />
                    </article>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {datos.students.length === 0 && <p className="text-sm text-foreground/65">El curso todavía no tiene estudiantes en la lista.</p>}
    </section>
  );
}
