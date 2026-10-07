"use client";

import { useState } from "react";
import { PROBLEMAS } from "@/lib/juegos/ordenarPasos";
import { NOMBRE_HERRAMIENTA } from "@/lib/api";
import { CabeceraJuego, FinDelJuego, Marcador, revolver, useCronometro } from "@/components/juegos/comun";

const RONDA = 5;

// Revuelve los pasos sin dejarlos ya en orden.
function desordenar(pasos) {
  const lista = pasos.map((texto, i) => ({ id: i, texto }));
  let r = revolver(lista);
  while (r.every((p, i) => p.texto === pasos[i])) r = revolver(lista);
  return r;
}

function nuevaRonda() {
  return revolver(PROBLEMAS).slice(0, RONDA);
}

// Ordena los pasos: se ponen en orden los pasos de un algoritmo.
// Cuenta cada paso que quedó en su lugar al comprobar (ordenar pasos da puntaje parcial, como en los quizzes).
export default function OrdenarPasos() {
  const [ronda, setRonda] = useState(null);
  const [inicio, setInicio] = useState(0);
  const [indice, setIndice] = useState(0);
  const [orden, setOrden] = useState([]);
  const [revisado, setRevisado] = useState(false);
  const [puntos, setPuntos] = useState(0);
  const [arrastrando, setArrastrando] = useState(null);
  const terminado = ronda !== null && indice >= ronda.length;
  const segundos = useCronometro(inicio, ronda !== null && !terminado);
  const maximo = ronda ? ronda.reduce((s, p) => s + p.pasos.length, 0) : 0;

  function empezar() {
    const r = nuevaRonda();
    setRonda(r);
    setInicio(Date.now());
    setIndice(0);
    setOrden(desordenar(r[0].pasos));
    setRevisado(false);
    setPuntos(0);
  }

  function mover(desde, hasta) {
    if (revisado || hasta < 0 || hasta >= orden.length || desde === hasta) return;
    setOrden((o) => {
      const copia = [...o];
      const [paso] = copia.splice(desde, 1);
      copia.splice(hasta, 0, paso);
      return copia;
    });
  }

  if (!ronda) {
    return (
      <div className="flex flex-col gap-6">
        <CabeceraJuego clave="ORDENAR_PASOS" />
        <div className="tarjeta flex flex-col items-start gap-4 p-6">
          <p className="text-foreground/80">
            Verá {RONDA} problemas con sus pasos revueltos. Arrástrelos o use las flechas ▲ ▼ para ponerlos en orden
            y pulse Comprobar. Cada paso que quede en su lugar suma un punto.
          </p>
          <button type="button" className="btn-primario px-6 py-2.5" onClick={empezar}>Empezar</button>
        </div>
      </div>
    );
  }

  if (terminado) {
    return (
      <div className="flex flex-col gap-6">
        <CabeceraJuego clave="ORDENAR_PASOS" />
        <FinDelJuego clave="ORDENAR_PASOS" score={puntos} maxScore={maximo} segundos={segundos} onOtraVez={empezar} />
      </div>
    );
  }

  const problema = ronda[indice];
  const bien = orden.filter((p, i) => p.texto === problema.pasos[i]).length;

  function comprobar() {
    setRevisado(true);
    setPuntos((p) => p + bien);
  }

  function siguiente() {
    const i = indice + 1;
    setIndice(i);
    setRevisado(false);
    if (i < ronda.length) setOrden(desordenar(ronda[i].pasos));
  }

  return (
    <div className="flex flex-col gap-6">
      <CabeceraJuego clave="ORDENAR_PASOS" />
      <Marcador actual={indice + (revisado ? 1 : 0)} total={ronda.length} aciertos={puntos} etiqueta="Puntos" segundos={segundos} />
      <div className={`tono-${problema.herramienta} tarjeta flex flex-col gap-4 p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{problema.titulo}</h2>
          <span className="chip">{NOMBRE_HERRAMIENTA[problema.herramienta]}</span>
        </div>
        <ol className="flex flex-col gap-2">
          {orden.map((paso, i) => {
            const correcto = paso.texto === problema.pasos[i];
            let estilo = "border-borde bg-white/[0.03]";
            if (revisado) estilo = correcto ? "border-emerald-400/60 bg-emerald-500/10" : "border-rose-400/60 bg-rose-500/10";
            else if (arrastrando === i) estilo = "border-tono bg-tono/10 opacity-60";
            return (
              <li
                key={paso.id}
                draggable={!revisado}
                onDragStart={() => setArrastrando(i)}
                onDragEnd={() => setArrastrando(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (arrastrando !== null && arrastrando !== i) {
                    mover(arrastrando, i);
                    setArrastrando(i);
                  }
                }}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${estilo} ${revisado ? "" : "cursor-grab active:cursor-grabbing"}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tono/15 text-sm font-bold text-tono">{i + 1}</span>
                <span className="flex-1 font-mono text-sm">{paso.texto}</span>
                {revisado ? (
                  <span aria-label={correcto ? "En su lugar" : "Fuera de lugar"}>{correcto ? "✅" : "❌"}</span>
                ) : (
                  <span className="flex gap-1">
                    <button type="button" className="accion px-2" disabled={i === 0} onClick={() => mover(i, i - 1)} aria-label={`Subir "${paso.texto}"`}>▲</button>
                    <button type="button" className="accion px-2" disabled={i === orden.length - 1} onClick={() => mover(i, i + 1)} aria-label={`Bajar "${paso.texto}"`}>▼</button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {revisado ? (
          <div className="aparecer flex flex-col gap-3 rounded-xl border border-borde bg-white/[0.03] p-4">
            <p className={`font-semibold ${bien === orden.length ? "text-emerald-300" : "text-amber-300"}`}>
              {bien === orden.length ? "¡Todo en orden!" : `${bien} de ${orden.length} pasos en su lugar.`}
            </p>
            {bien < orden.length && (
              <div className="text-sm">
                <p className="mb-1 text-foreground/70">El orden correcto es:</p>
                <ol className="list-decimal pl-6 font-mono text-foreground/85">
                  {problema.pasos.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              </div>
            )}
            <div>
              <button type="button" className="btn-primario" autoFocus onClick={siguiente}>
                {indice + 1 < ronda.length ? "Siguiente" : "Ver resultado"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button type="button" className="btn-primario" onClick={comprobar}>Comprobar</button>
          </div>
        )}
      </div>
    </div>
  );
}
