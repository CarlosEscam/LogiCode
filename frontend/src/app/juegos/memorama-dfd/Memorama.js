"use client";

import { useEffect, useState } from "react";
import { CabeceraJuego, FinDelJuego, Marcador, revolver, useCronometro } from "@/components/juegos/comun";

// Símbolos de los diagramas de flujo, con el nombre que usan DFD y PSeInt.
const SIMBOLOS = [
  {
    clave: "terminal",
    nombre: "Inicio / Fin",
    ayuda: "Donde empieza y termina el algoritmo",
    dibujo: <rect x="8" y="24" width="64" height="32" rx="16" />,
  },
  {
    clave: "proceso",
    nombre: "Asignación",
    ayuda: "Un cálculo o una variable que cambia",
    dibujo: <rect x="10" y="22" width="60" height="36" rx="2" />,
  },
  {
    clave: "entrada",
    nombre: "Lectura (Leer)",
    ayuda: "El usuario escribe un dato",
    dibujo: <path d="M22 22h50l-14 36H8z" />,
  },
  {
    clave: "salida",
    nombre: "Salida (Escribir)",
    ayuda: "Muestra un resultado en pantalla",
    dibujo: <path d="M10 22h60v30c-10 8-20-6-30 0s-20 8-30 0z" />,
  },
  {
    clave: "decision",
    nombre: "Decisión (Si)",
    ayuda: "Una pregunta con dos caminos: sí o no",
    dibujo: <path d="M40 12 72 40 40 68 8 40z" />,
  },
  {
    clave: "para",
    nombre: "Ciclo Para",
    ayuda: "Repite un número fijo de veces",
    dibujo: <path d="M20 22h40l12 18-12 18H20L8 40z" />,
  },
  {
    clave: "conector",
    nombre: "Conector",
    ayuda: "Une partes del diagrama que están lejos",
    dibujo: <circle cx="40" cy="40" r="16" />,
  },
  {
    clave: "subprograma",
    nombre: "Subprograma",
    ayuda: "Llama a otro algoritmo (función)",
    dibujo: (
      <>
        <rect x="8" y="22" width="64" height="36" rx="2" />
        <path d="M18 22v36M62 22v36" />
      </>
    ),
  },
];

const PAREJAS = SIMBOLOS.length;

function nuevoTablero() {
  return revolver(SIMBOLOS.flatMap((s) => [
    { id: `${s.clave}-s`, clave: s.clave, tipo: "simbolo" },
    { id: `${s.clave}-n`, clave: s.clave, tipo: "nombre" },
  ]));
}

// Puntaje sobre 100: perfecto con 8 intentos; cada intento de más resta 5.
const puntaje = (intentos) => Math.max(10, 100 - 5 * Math.max(0, intentos - PAREJAS));

// Memorama: cada símbolo del diagrama de flujo con su nombre.
export default function Memorama() {
  const [tablero, setTablero] = useState(null);
  const [inicio, setInicio] = useState(0);
  const [abiertas, setAbiertas] = useState([]);
  const [encontradas, setEncontradas] = useState(new Set());
  const [intentos, setIntentos] = useState(0);
  const terminado = encontradas.size === PAREJAS;
  const segundos = useCronometro(inicio, tablero !== null && !terminado);

  // Dos cartas abiertas que no son pareja se voltean solas después de un momento.
  useEffect(() => {
    if (abiertas.length !== 2) return;
    const t = setTimeout(() => setAbiertas([]), 1000);
    return () => clearTimeout(t);
  }, [abiertas]);

  function empezar() {
    setTablero(nuevoTablero());
    setInicio(Date.now());
    setAbiertas([]);
    setEncontradas(new Set());
    setIntentos(0);
  }

  function voltear(carta) {
    if (abiertas.length === 2 || abiertas.includes(carta.id) || encontradas.has(carta.clave)) return;
    if (abiertas.length === 0) {
      setAbiertas([carta.id]);
      return;
    }
    setIntentos((n) => n + 1);
    const primera = tablero.find((c) => c.id === abiertas[0]);
    if (primera.clave === carta.clave) {
      setEncontradas((e) => new Set(e).add(carta.clave));
      setAbiertas([]);
    } else {
      setAbiertas([abiertas[0], carta.id]);
    }
  }

  if (!tablero) {
    return (
      <div className="flex flex-col gap-6">
        <CabeceraJuego clave="MEMORAMA_DFD" />
        <div className="tarjeta flex flex-col gap-5 p-6">
          <p className="text-foreground/80">
            Hay {PAREJAS * 2} cartas boca abajo: {PAREJAS} con un símbolo y {PAREJAS} con su nombre. Voltee dos a la vez y
            encuentre las parejas con la menor cantidad de intentos. Antes de empezar, repase los símbolos:
          </p>
          <ul className="tono-DFD grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SIMBOLOS.map((s) => (
              <li key={s.clave} className="flex flex-col items-center gap-1 rounded-xl border border-borde bg-white/[0.03] p-3 text-center">
                <Simbolo s={s} className="h-12 w-16" />
                <span className="text-sm font-semibold">{s.nombre}</span>
                <span className="text-xs text-foreground/60">{s.ayuda}</span>
              </li>
            ))}
          </ul>
          <div>
            <button type="button" className="btn-primario px-6 py-2.5" onClick={empezar}>Empezar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CabeceraJuego clave="MEMORAMA_DFD" />
      {terminado ? (
        <FinDelJuego clave="MEMORAMA_DFD" score={puntaje(intentos)} maxScore={100} segundos={segundos} onOtraVez={empezar}>
          <p className="text-sm text-foreground/70">Lo logró en {intentos} intentos (lo mínimo posible son {PAREJAS}).</p>
        </FinDelJuego>
      ) : (
        <>
          <Marcador actual={encontradas.size} total={PAREJAS} aciertos={intentos} etiqueta="Intentos" segundos={segundos} />
          <ul className="tono-DFD mx-auto grid w-full max-w-2xl grid-cols-4 gap-2 sm:gap-3">
            {tablero.map((carta) => {
              const visible = abiertas.includes(carta.id) || encontradas.has(carta.clave);
              const lista = encontradas.has(carta.clave);
              const s = SIMBOLOS.find((x) => x.clave === carta.clave);
              return (
                <li key={carta.id} className="aspect-square" style={{ perspective: "600px" }}>
                  <button
                    type="button"
                    onClick={() => voltear(carta)}
                    aria-label={visible ? (carta.tipo === "simbolo" ? `Símbolo de ${s.nombre}` : s.nombre) : "Carta boca abajo"}
                    className="relative h-full w-full transition-transform duration-500"
                    style={{ transformStyle: "preserve-3d", transform: visible ? "rotateY(180deg)" : "none" }}
                  >
                    <span
                      className="absolute inset-0 flex items-center justify-center rounded-xl border border-tono/30 bg-gradient-to-br from-tono/25 to-marca/20 text-2xl font-bold text-tono/80 shadow-lg hover:brightness-125"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      ?
                    </span>
                    <span
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl border p-1 text-center ${lista ? "border-emerald-400/60 bg-emerald-500/15" : "border-tono/60 bg-superficie-2"}`}
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                      {carta.tipo === "simbolo" ? (
                        <Simbolo s={s} className="h-3/5 w-4/5" />
                      ) : (
                        <span className="text-xs font-semibold leading-tight sm:text-sm">{s.nombre}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Simbolo({ s, className }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" aria-hidden="true" className={`${className} text-tono`}>
      {s.dibujo}
    </svg>
  );
}
