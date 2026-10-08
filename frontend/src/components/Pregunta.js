import { EtiquetaHerramienta } from "@/components/Herramienta";
import { NOMBRE_TIPO } from "@/lib/quizzes";

// Piezas para mostrar preguntas del banco y de los quizzes.

export function BloqueCodigo({ children }) {
  return (
    <pre className="overflow-x-auto rounded-xl oscuro border border-borde bg-azul px-4 py-3 font-mono text-sm leading-relaxed text-sky-100">
      {children}
    </pre>
  );
}

export function Enunciado({ pregunta, numero, puntos }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {numero !== undefined && <span className="font-semibold uppercase tracking-wider text-foreground/70">Pregunta {numero}</span>}
        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-foreground/70">{NOMBRE_TIPO[pregunta.type] ?? pregunta.type}</span>
        <EtiquetaHerramienta herramienta={pregunta.tool} />
        {puntos !== undefined && <span className="text-foreground/60">{puntos === 1 ? "1 punto" : `${String(puntos).replace(".", ",")} puntos`}</span>}
      </div>
      <p className="whitespace-pre-wrap text-lg font-medium leading-snug">{pregunta.statement}</p>
      {pregunta.code && <BloqueCodigo>{pregunta.code}</BloqueCodigo>}
    </div>
  );
}

// Texto de la respuesta correcta, para el docente y la revisión.
export function textoCorrecta(pregunta) {
  switch (pregunta.type) {
    case "MULTIPLE_CHOICE":
      return pregunta.options?.[pregunta.correctAnswer];
    case "TRUE_FALSE":
      return pregunta.correctAnswer ? "Verdadero" : "Falso";
    case "SHORT_ANSWER":
    case "OUTPUT":
      return pregunta.correctAnswer?.join("  ·  ");
    case "ORDER_STEPS":
      return pregunta.options?.map((p, i) => `${i + 1}. ${p}`).join("\n");
    default:
      return "";
  }
}

export function textoRespuesta(pregunta, respuesta) {
  if (respuesta === null || respuesta === undefined || respuesta === "") return null;
  switch (pregunta.type) {
    case "MULTIPLE_CHOICE":
      return pregunta.options?.[respuesta];
    case "TRUE_FALSE":
      return respuesta ? "Verdadero" : "Falso";
    case "ORDER_STEPS":
      return respuesta.map((p, i) => `${i + 1}. ${p}`).join("\n");
    default:
      return String(respuesta);
  }
}

// Campo para responder, según el tipo de pregunta.
export function CampoRespuesta({ pregunta, valor, onCambio, deshabilitado }) {
  const opcion = (activa) =>
    `flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${activa ? "border-marca bg-marca/15 text-enlace shadow-md shadow-marca/20" : "border-borde bg-foreground/5 hover:border-marca/50 hover:bg-foreground/10"}`;

  if (pregunta.type === "MULTIPLE_CHOICE") {
    return (
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
        {pregunta.options.map((o, i) => (
          <button key={i} type="button" role="radio" aria-checked={valor === i} disabled={deshabilitado} onClick={() => onCambio(i)} className={opcion(valor === i)}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${valor === i ? "bg-cian-oscuro text-white" : "bg-foreground/10 text-foreground/70"}`}>
              {String.fromCharCode(65 + i)}
            </span>
            <span className="whitespace-pre-wrap">{o}</span>
          </button>
        ))}
      </div>
    );
  }
  if (pregunta.type === "TRUE_FALSE") {
    return (
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {[[true, "Verdadero"], [false, "Falso"]].map(([v, texto]) => (
          <button key={texto} type="button" role="radio" aria-checked={valor === v} disabled={deshabilitado} onClick={() => onCambio(v)} className={`${opcion(valor === v)} justify-center font-semibold`}>
            {texto}
          </button>
        ))}
      </div>
    );
  }
  if (pregunta.type === "SHORT_ANSWER") {
    return (
      <input
        value={valor ?? ""}
        onChange={(e) => onCambio(e.target.value)}
        disabled={deshabilitado}
        maxLength={500}
        placeholder="Escriba su respuesta"
        className="campo w-full"
      />
    );
  }
  if (pregunta.type === "OUTPUT") {
    return (
      <label className="flex flex-col gap-1.5 text-sm text-foreground/70">
        Escriba lo que muestra el algoritmo, una línea por cada Escribir.
        <textarea
          value={valor ?? ""}
          onChange={(e) => onCambio(e.target.value)}
          disabled={deshabilitado}
          rows={4}
          spellCheck={false}
          className="campo w-full font-mono text-sm text-foreground"
        />
      </label>
    );
  }
  if (pregunta.type === "ORDER_STEPS") {
    const pasos = valor ?? pregunta.options;
    const mover = (i, delta) => {
      const j = i + delta;
      if (j < 0 || j >= pasos.length) return;
      const nuevo = [...pasos];
      [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
      onCambio(nuevo);
    };
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-foreground/60">Use las flechas para poner los pasos en orden.</p>
        <ol className="flex flex-col gap-2">
          {pasos.map((p, i) => (
            <li key={p} className="flex items-center gap-3 rounded-xl border border-borde bg-foreground/5 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-sm font-bold text-foreground/70">{i + 1}</span>
              <span className="flex-1">{p}</span>
              <button type="button" disabled={deshabilitado || i === 0} onClick={() => mover(i, -1)} className="accion" aria-label={`Subir "${p}"`}>↑</button>
              <button type="button" disabled={deshabilitado || i === pasos.length - 1} onClick={() => mover(i, 1)} className="accion" aria-label={`Bajar "${p}"`}>↓</button>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return null;
}

// Pregunta ya calificada: lo que respondió el estudiante y la respuesta correcta.
export function Revision({ item, numero }) {
  const respuesta = textoRespuesta(item, item.answer);
  const parcial = item.score > 0 && item.score < 1;
  const color = item.isCorrect ? "border-exito/40" : parcial ? "border-acento/40" : "border-peligro/40";
  return (
    <li className={`tarjeta flex flex-col gap-4 border-l-4 p-5 ${color}`}>
      <Enunciado pregunta={item} numero={numero} puntos={item.points} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Respuesta</p>
          <p className={`whitespace-pre-wrap ${respuesta ? "" : "italic text-foreground/60"}`}>{respuesta ?? "Sin responder"}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Correcta</p>
          <p className="whitespace-pre-wrap text-exito">{textoCorrecta(item)}</p>
        </div>
      </div>
      <p className={`text-sm font-semibold ${item.isCorrect ? "text-exito" : parcial ? "text-acento" : "text-peligro"}`}>
        {item.isCorrect ? "✓ Correcta" : parcial ? `Parcial: ${Math.round(item.score * 100)} %` : "✗ Incorrecta"}
      </p>
      {item.explanation && <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground/80">{item.explanation}</p>}
    </li>
  );
}
