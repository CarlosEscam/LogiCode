"use client";

import { useState } from "react";
import { api, HERRAMIENTAS } from "@/lib/api";
import { TIPOS_PREGUNTA } from "@/lib/quizzes";
import { Aviso, Boton } from "@/components/Formulario";

function inicial(pregunta) {
  if (pregunta) {
    return {
      type: pregunta.type,
      tool: pregunta.tool,
      topicId: pregunta.topicId ?? "",
      statement: pregunta.statement,
      code: pregunta.code ?? "",
      explanation: pregunta.explanation ?? "",
      options: pregunta.type === "MULTIPLE_CHOICE" || pregunta.type === "ORDER_STEPS" ? pregunta.options : ["", "", ""],
      correcta: pregunta.type === "MULTIPLE_CHOICE" ? pregunta.correctAnswer : 0,
      verdadera: pregunta.type === "TRUE_FALSE" ? pregunta.correctAnswer : true,
      aceptadas: Array.isArray(pregunta.correctAnswer) ? pregunta.correctAnswer : [""],
    };
  }
  return {
    type: "MULTIPLE_CHOICE",
    tool: "PSEINT",
    topicId: "",
    statement: "",
    code: "",
    explanation: "",
    options: ["", "", ""],
    correcta: 0,
    verdadera: true,
    aceptadas: [""],
  };
}

// Crea o edita una pregunta del banco. Los campos cambian según el tipo.
export default function FormPregunta({ courseId, temas = [], pregunta, onGuardada, onCancelar }) {
  const [f, setF] = useState(() => inicial(pregunta));
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const cambiar = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));

  function cambiarTipo(type) {
    setF((x) => ({
      ...x,
      type,
      options: type === "ORDER_STEPS" && x.options.length < 3 ? [...x.options, ""] : x.options,
    }));
  }

  function cambiarLista(campo, i, valor) {
    setF((x) => ({ ...x, [campo]: x[campo].map((o, j) => (j === i ? valor : o)) }));
  }
  function agregar(campo) {
    setF((x) => ({ ...x, [campo]: [...x[campo], ""] }));
  }
  function quitar(campo, i) {
    setF((x) => ({
      ...x,
      [campo]: x[campo].filter((_, j) => j !== i),
      // Si se quita la opción correcta, queda marcada la primera.
      correcta: campo !== "options" ? x.correcta : i === x.correcta ? 0 : i < x.correcta ? x.correcta - 1 : x.correcta,
    }));
  }
  function mover(i, delta) {
    setF((x) => {
      const o = [...x.options];
      const j = i + delta;
      if (j < 0 || j >= o.length) return x;
      [o[i], o[j]] = [o[j], o[i]];
      return { ...x, options: o };
    });
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    const body = {
      type: f.type,
      tool: f.tool,
      topicId: f.topicId || null,
      statement: f.statement,
      explanation: f.explanation,
    };
    if (f.type === "MULTIPLE_CHOICE") {
      body.options = f.options;
      // El índice correcto se cuenta sin las opciones vacías.
      const llenas = f.options.map((o, i) => [o.trim(), i]).filter(([o]) => o);
      body.correctAnswer = llenas.findIndex(([, i]) => i === f.correcta);
    }
    if (f.type === "TRUE_FALSE") body.correctAnswer = f.verdadera;
    if (f.type === "SHORT_ANSWER" || f.type === "OUTPUT") body.correctAnswer = f.aceptadas;
    if (f.type === "OUTPUT") body.code = f.code;
    if (f.type === "ORDER_STEPS") body.options = f.options;

    setCargando(true);
    try {
      const r = pregunta
        ? await api(`/questions/${pregunta.id}`, { method: "PATCH", body })
        : await api(`/courses/${courseId}/questions`, { method: "POST", body });
      if (!pregunta) setF((x) => ({ ...inicial(), type: x.type, tool: x.tool, topicId: x.topicId }));
      onGuardada?.(r.question, r.regraded);
    } catch (err) {
      setError(err.message);
    }
    setCargando(false);
  }

  const etiqueta = "flex flex-col gap-1.5 text-sm font-medium text-foreground/90";

  return (
    <form onSubmit={enviar} className="tarjeta flex flex-col gap-4 p-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground/90">Tipo de pregunta</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_PREGUNTA.map((t) => (
            <button
              key={t.valor}
              type="button"
              title={t.ayuda}
              onClick={() => cambiarTipo(t.valor)}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${f.type === t.valor ? "border-marca bg-marca/15 font-semibold text-enlace" : "border-borde bg-foreground/5 text-foreground/75 hover:border-marca/50"}`}
            >
              {t.nombre}
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground/60">{TIPOS_PREGUNTA.find((t) => t.valor === f.type)?.ayuda}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={etiqueta}>
          Herramienta
          <select value={f.tool} onChange={(e) => cambiar("tool", e.target.value)} className="campo font-normal">
            {HERRAMIENTAS.map((h) => <option key={h.valor} value={h.valor}>{h.nombre}</option>)}
          </select>
        </label>
        <label className={etiqueta}>
          Tema (opcional)
          <select value={f.topicId} onChange={(e) => cambiar("topicId", e.target.value)} className="campo font-normal">
            <option value="">Sin tema</option>
            {temas.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
      </div>

      <label className={etiqueta}>
        {f.type === "TRUE_FALSE" ? "Afirmación" : "Enunciado"}
        <textarea value={f.statement} onChange={(e) => cambiar("statement", e.target.value)} rows={2} required className="campo font-normal" />
      </label>

      {f.type === "OUTPUT" && (
        <label className={etiqueta}>
          Algoritmo (PSeInt, pseudocódigo o código)
          <textarea
            value={f.code}
            onChange={(e) => cambiar("code", e.target.value)}
            rows={6}
            required
            spellCheck={false}
            placeholder={"Algoritmo ejemplo\n  Para i <- 1 Hasta 3 Hacer\n    Escribir i\n  FinPara\nFinAlgoritmo"}
            className="campo font-mono text-sm font-normal"
          />
        </label>
      )}

      {f.type === "MULTIPLE_CHOICE" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-foreground/90">Opciones: marque la correcta</legend>
          {f.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correcta" checked={f.correcta === i} onChange={() => cambiar("correcta", i)} className="accent-marca" aria-label={`Opción ${i + 1} es la correcta`} />
              <input value={o} onChange={(e) => cambiarLista("options", i, e.target.value)} placeholder={`Opción ${i + 1}`} className="campo flex-1" />
              {f.options.length > 2 && <button type="button" onClick={() => quitar("options", i)} className="accion-peligro">Quitar</button>}
            </div>
          ))}
          {f.options.length < 6 && <button type="button" onClick={() => agregar("options")} className="accion self-start">+ Otra opción</button>}
        </fieldset>
      )}

      {f.type === "TRUE_FALSE" && (
        <fieldset className="flex gap-5 text-sm">
          <legend className="mb-2 text-sm font-medium text-foreground/90">La afirmación es</legend>
          {[[true, "Verdadera"], [false, "Falsa"]].map(([valor, texto]) => (
            <label key={texto} className="flex items-center gap-2">
              <input type="radio" name="verdadera" checked={f.verdadera === valor} onChange={() => cambiar("verdadera", valor)} className="accent-marca" />
              {texto}
            </label>
          ))}
        </fieldset>
      )}

      {(f.type === "SHORT_ANSWER" || f.type === "OUTPUT") && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground/90">
            {f.type === "OUTPUT" ? "Salida esperada" : "Respuestas aceptadas"}
          </legend>
          <p className="text-xs text-foreground/60">
            No importan mayúsculas, tildes ni espacios de más. Puede agregar otras formas válidas de responder.
          </p>
          {f.aceptadas.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              {f.type === "OUTPUT" ? (
                <textarea value={a} onChange={(e) => cambiarLista("aceptadas", i, e.target.value)} rows={3} spellCheck={false} placeholder={"1\n2\n3"} className="campo flex-1 font-mono text-sm" />
              ) : (
                <input value={a} onChange={(e) => cambiarLista("aceptadas", i, e.target.value)} placeholder="Respuesta" className="campo flex-1" />
              )}
              {f.aceptadas.length > 1 && <button type="button" onClick={() => quitar("aceptadas", i)} className="accion-peligro">Quitar</button>}
            </div>
          ))}
          {f.aceptadas.length < 10 && <button type="button" onClick={() => agregar("aceptadas")} className="accion self-start">+ Otra respuesta válida</button>}
        </fieldset>
      )}

      {f.type === "ORDER_STEPS" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground/90">Pasos en el orden correcto</legend>
          <p className="text-xs text-foreground/60">Al estudiante le aparecen revueltos. Cada paso en su lugar suma.</p>
          {f.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-right text-sm text-foreground/60">{i + 1}.</span>
              <input value={o} onChange={(e) => cambiarLista("options", i, e.target.value)} placeholder={`Paso ${i + 1}`} className="campo flex-1" />
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="accion" aria-label="Subir paso">↑</button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === f.options.length - 1} className="accion" aria-label="Bajar paso">↓</button>
              {f.options.length > 3 && <button type="button" onClick={() => quitar("options", i)} className="accion-peligro">Quitar</button>}
            </div>
          ))}
          {f.options.length < 10 && <button type="button" onClick={() => agregar("options")} className="accion self-start">+ Otro paso</button>}
        </fieldset>
      )}

      <label className={etiqueta}>
        Explicación (opcional, el estudiante la ve cuando cierra el quiz)
        <textarea value={f.explanation} onChange={(e) => cambiar("explanation", e.target.value)} rows={2} className="campo font-normal" />
      </label>

      <Aviso>{error}</Aviso>
      <div className="flex gap-2">
        <Boton type="submit" cargando={cargando}>{pregunta ? "Guardar cambios" : "Guardar en el banco"}</Boton>
        {onCancelar && <button type="button" onClick={onCancelar} className="btn-secundario">Cancelar</button>}
      </div>
    </form>
  );
}
