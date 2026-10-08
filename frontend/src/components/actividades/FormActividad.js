"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";
import { NOMBRE_TIPO, paraInputFecha } from "./comun";

const AYUDA_ENTREGA = {
  PSEINT: "El estudiante escribe el algoritmo en el editor de la página (o sube su .psc) y se califica con los casos de prueba.",
  PHOTO: "El estudiante toma o sube una foto (por ejemplo, un algoritmo o un diagrama de flujo a mano). La IA la lee y la compara con la respuesta esperada.",
  TEXT: "El estudiante escribe su respuesta. Si coincide con la respuesta esperada saca la nota completa; si no, la revisa la IA.",
  FILE: "El estudiante sube un archivo. Los .psc se corren con los casos de prueba, los .sb3 se revisan por bloques y el resto lo califica usted.",
};

const ahoraMas = (dias) => paraInputFecha(new Date(Date.now() + dias * 86400000).toISOString());
const casoVacio = () => ({ input: "", expectedOutput: "", weight: 1 });

// Crear o editar una actividad (RF-10 a RF-12). Sin "actividad" crea una nueva.
export default function FormActividad({ courseId, actividad, onGuardada }) {
  const [tipoEntrega, setTipoEntrega] = useState(actividad?.submissionType ?? "PSEINT");
  const [casos, setCasos] = useState(actividad?.testCases?.length ? actividad.testCases : [casoVacio()]);
  const [revisiones, setRevisiones] = useState(actividad?.scratchChecks ?? []);
  const [opciones, setOpciones] = useState({ temas: [], scratch: [] });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([api(`/courses/${courseId}/topics`), api("/activities/scratch-checks")])
      .then(([t, s]) => vivo && setOpciones({ temas: t.topics, scratch: s.checks }))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [courseId]);

  const usaCasos = tipoEntrega !== "TEXT";

  function cambiarCaso(i, campo, valor) {
    setCasos((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
  }

  async function enviar(e) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    const cuerpo = {
      type: datos.type,
      title: datos.title,
      instructions: datos.instructions,
      topicId: datos.topicId || null,
      submissionType: tipoEntrega,
      opensAt: new Date(datos.opensAt).toISOString(),
      closesAt: new Date(datos.closesAt).toISOString(),
      weight: datos.weight === "" ? null : datos.weight,
      maxAttempts: Number(datos.maxAttempts),
      expectedAnswer: datos.expectedAnswer,
      rubric: datos.rubric,
      testCases: usaCasos ? casos.filter((c) => c.expectedOutput.trim()) : [],
      scratchChecks: tipoEntrega === "FILE" ? revisiones : [],
    };
    setError("");
    setCargando(true);
    try {
      const { activity } = actividad
        ? await api(`/activities/${actividad.id}`, { method: "PATCH", body: cuerpo })
        : await api(`/courses/${courseId}/activities`, { method: "POST", body: cuerpo });
      onGuardada?.(activity);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="tarjeta flex flex-col gap-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
          Tipo de actividad
          <select name="type" defaultValue={actividad?.type ?? "TASK"} className="campo font-normal">
            {Object.entries(NOMBRE_TIPO).map(([valor, nombre]) => (
              <option key={valor} value={valor}>{nombre}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
          Tema (opcional)
          <select name="topicId" defaultValue={actividad?.topicId ?? ""} className="campo font-normal">
            <option value="">Sin tema</option>
            {opciones.temas.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </label>
      </div>
      <Campo etiqueta="Título" name="title" defaultValue={actividad?.title} required maxLength={200} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
        Instrucciones para el estudiante
        <textarea name="instructions" defaultValue={actividad?.instructions ?? ""} rows={4} className="campo font-normal" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-foreground/90">Tipo de entrega</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["PSEINT", "Código PSeInt"],
            ["PHOTO", "Foto"],
            ["TEXT", "Texto"],
            ["FILE", "Archivo"],
          ].map(([valor, nombre]) => (
            <label key={valor} className={`cursor-pointer rounded-xl border px-3 py-1.5 text-sm transition ${tipoEntrega === valor ? "border-marca bg-marca/15 font-semibold" : "border-borde bg-foreground/5 hover:border-marca/50"}`}>
              <input type="radio" name="submissionType" value={valor} checked={tipoEntrega === valor} onChange={() => setTipoEntrega(valor)} className="sr-only" />
              {nombre}
            </label>
          ))}
        </div>
        <p className="text-sm text-foreground/65">{AYUDA_ENTREGA[tipoEntrega]}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Abre" name="opensAt" type="datetime-local" defaultValue={actividad ? paraInputFecha(actividad.opensAt) : ahoraMas(0)} required />
        <Campo etiqueta="Cierra (después no se reciben entregas)" name="closesAt" type="datetime-local" defaultValue={actividad ? paraInputFecha(actividad.closesAt) : ahoraMas(7)} required />
        <Campo etiqueta="Porcentaje en la definitiva (opcional)" name="weight" type="number" min="0" max="100" step="0.5" defaultValue={actividad?.weight ?? ""} placeholder="Por ejemplo, 20" />
        <Campo etiqueta="Intentos permitidos" name="maxAttempts" type="number" min="1" max="10" defaultValue={actividad?.maxAttempts ?? 1} required />
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
        Respuesta esperada {tipoEntrega === "PSEINT" ? "(opcional, si no hay casos de prueba)" : ""}
        <textarea
          name="expectedAnswer"
          defaultValue={actividad?.expectedAnswer ?? ""}
          rows={3}
          placeholder={tipoEntrega === "PHOTO" ? "Qué debe verse en la foto. Ej.: el diagrama lee A y B y muestra el mayor." : ""}
          className="campo font-normal"
        />
        <span className="font-normal text-foreground/60">El estudiante no la ve.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
        Rúbrica (opcional)
        <textarea name="rubric" defaultValue={actividad?.rubric ?? ""} rows={2} placeholder="Ej.: 2 puntos por leer los datos, 2 por la condición y 1 por mostrar el resultado." className="campo font-normal" />
      </label>

      {usaCasos && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-foreground/90">
            Casos de prueba de PSeInt {tipoEntrega !== "PSEINT" && "(si la entrega es un algoritmo)"}
          </legend>
          <p className="text-sm text-foreground/65">
            Cada dato de entrada va en su propia línea. La salida del estudiante debe contener las líneas esperadas en orden; no importan
            mayúsculas, tildes ni espacios. Si escribe solo números, se comparan los números de la línea.
          </p>
          {casos.map((c, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-borde bg-hundido p-3 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
              <label className="flex flex-col gap-1 text-xs font-medium text-foreground/80">
                Entrada del caso {i + 1}
                <textarea value={c.input} onChange={(e) => cambiarCaso(i, "input", e.target.value)} rows={2} className="campo font-mono font-normal" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-foreground/80">
                Salida esperada
                <textarea value={c.expectedOutput} onChange={(e) => cambiarCaso(i, "expectedOutput", e.target.value)} rows={2} className="campo font-mono font-normal" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-foreground/80">
                Peso
                <input type="number" min="0.5" step="0.5" value={c.weight} onChange={(e) => cambiarCaso(i, "weight", e.target.value)} className="campo font-normal" />
              </label>
              <button type="button" className="accion-peligro" onClick={() => setCasos((cs) => cs.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </div>
          ))}
          <button type="button" className="btn-secundario self-start" onClick={() => setCasos((cs) => [...cs, casoVacio()])}>
            + Agregar caso
          </button>
        </fieldset>
      )}

      {tipoEntrega === "FILE" && opciones.scratch.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground/90">Si es un proyecto de Scratch (.sb3), debe...</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {opciones.scratch.map((r) => (
              <label key={r.clave} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={revisiones.includes(r.clave)}
                  onChange={(e) => setRevisiones((rs) => (e.target.checked ? [...rs, r.clave] : rs.filter((x) => x !== r.clave)))}
                />
                {r.nombre}
              </label>
            ))}
          </div>
          <p className="text-sm text-foreground/65">La plataforma propone la nota según lo que cumpla y usted la confirma.</p>
        </fieldset>
      )}

      <Aviso>{error}</Aviso>
      <div>
        <Boton type="submit" cargando={cargando}>{actividad ? "Guardar cambios" : "Crear actividad"}</Boton>
      </div>
    </form>
  );
}
