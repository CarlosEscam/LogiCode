"use client";

import { useState } from "react";
import { ALGORITMOS } from "@/lib/juegos/adivinaSalida.mjs";
import { CabeceraJuego, CodigoPseint, FinDelJuego, Marcador, revolver, useCronometro } from "@/components/juegos/comun";

const RONDA = 8;

function nuevaRonda() {
  return revolver(ALGORITMOS).slice(0, RONDA).map((a) => ({ ...a, opciones: revolver(a.opciones) }));
}

// Adivina la salida: se lee un algoritmo de PSeInt y se elige lo que muestra.
export default function AdivinaSalida() {
  const [ronda, setRonda] = useState(null);
  const [inicio, setInicio] = useState(0);
  const [indice, setIndice] = useState(0);
  const [elegida, setElegida] = useState(null);
  const [aciertos, setAciertos] = useState(0);
  const terminado = ronda !== null && indice >= ronda.length;
  const segundos = useCronometro(inicio, ronda !== null && !terminado);

  function empezar() {
    setRonda(nuevaRonda());
    setInicio(Date.now());
    setIndice(0);
    setElegida(null);
    setAciertos(0);
  }

  if (!ronda) {
    return (
      <div className="flex flex-col gap-6">
        <CabeceraJuego clave="ADIVINA_SALIDA" />
        <div className="tarjeta flex flex-col items-start gap-4 p-6">
          <p className="text-foreground/80">
            Verá {RONDA} algoritmos cortos. Recórralos paso a paso en su cabeza (o en papel) y elija lo que
            muestran en pantalla. Cada salto de línea es un <code className="rounded bg-foreground/10 px-1">Escribir</code> distinto.
          </p>
          <button type="button" className="btn-primario px-6 py-2.5" onClick={empezar}>Empezar</button>
        </div>
      </div>
    );
  }

  if (terminado) {
    return (
      <div className="flex flex-col gap-6">
        <CabeceraJuego clave="ADIVINA_SALIDA" />
        <FinDelJuego clave="ADIVINA_SALIDA" score={aciertos} maxScore={ronda.length} segundos={segundos} onOtraVez={empezar} />
      </div>
    );
  }

  const actual = ronda[indice];
  const respondida = elegida !== null;

  function elegir(opcion) {
    if (respondida) return;
    setElegida(opcion);
    if (opcion === actual.salida) setAciertos((a) => a + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <CabeceraJuego clave="ADIVINA_SALIDA" />
      <Marcador actual={indice + (respondida ? 1 : 0)} total={ronda.length} aciertos={aciertos} segundos={segundos} />
      <div className="tono-PSEINT tarjeta flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">¿Qué muestra este algoritmo?</h2>
          <span className="chip">{actual.tema}</span>
        </div>
        <CodigoPseint codigo={actual.codigo} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {actual.opciones.map((op) => {
            let estilo = "border-borde hover:border-tono/60 hover:bg-foreground/5";
            if (respondida && op === actual.salida) estilo = "border-exito/70 bg-exito/15";
            else if (respondida && op === elegida) estilo = "border-peligro/70 bg-peligro/15";
            else if (respondida) estilo = "border-borde opacity-60";
            return (
              <li key={op}>
                <button
                  type="button"
                  disabled={respondida}
                  onClick={() => elegir(op)}
                  className={`flex h-full w-full items-start gap-2 rounded-xl border px-4 py-3 text-left transition ${estilo}`}
                >
                  <pre className="flex-1 whitespace-pre-wrap font-mono text-sm">{op}</pre>
                  {respondida && op === actual.salida && <span aria-label="Correcta">✅</span>}
                  {respondida && op === elegida && op !== actual.salida && <span aria-label="Incorrecta">❌</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {respondida && (
          <div className="aparecer flex flex-col gap-3 rounded-xl border border-borde bg-foreground/[0.03] p-4">
            <p className={`font-semibold ${elegida === actual.salida ? "text-exito" : "text-peligro"}`}>
              {elegida === actual.salida ? "¡Correcto!" : "No era esa."}
            </p>
            <p className="text-sm text-foreground/80">{actual.explicacion}</p>
            <div>
              <button type="button" className="btn-primario" autoFocus onClick={() => { setIndice((i) => i + 1); setElegida(null); }}>
                {indice + 1 < ronda.length ? "Siguiente" : "Ver resultado"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
