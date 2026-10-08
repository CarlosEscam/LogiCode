"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, useUsuario } from "@/lib/api";
import { JUEGOS } from "@/lib/juegos";
import { segundosATexto } from "@/lib/estudiante";

// Piezas que comparten los juegos: encabezado, reloj, barra de avance y pantalla final.

export function datosJuego(clave) {
  return JUEGOS.find((j) => j.clave === clave);
}

// Revuelve una copia de la lista (Fisher-Yates).
export function revolver(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Segundos desde inicio (un Date.now() que fija quien empieza la partida).
// Mientras corriendo es verdadero el reloj avanza; al terminar queda quieto.
export function useCronometro(inicio, corriendo) {
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    if (!corriendo) return;
    const t = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(t);
  }, [corriendo]);
  return inicio ? Math.max(0, Math.floor((ahora - inicio) / 1000)) : 0;
}

export function CabeceraJuego({ clave, children }) {
  const juego = datosJuego(clave);
  return (
    <div className={`tono-${juego.herramienta} aparecer flex flex-col gap-2`}>
      <Link href="/juegos" className="self-start text-sm text-foreground/60 transition hover:text-enlace">← Juegos</Link>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-tono/30 bg-tono/15 text-2xl" aria-hidden="true">{juego.emoji}</span>
        <div>
          <h1 className="titulo-pagina">{juego.nombre}</h1>
          <p className="text-foreground/70">{children ?? juego.descripcion}</p>
        </div>
      </div>
    </div>
  );
}

export function Marcador({ actual, total, aciertos, segundos, etiqueta = "Aciertos" }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground/70">
        <span>{total ? `${Math.min(actual, total)} de ${total}` : ""}</span>
        <span className="flex gap-4">
          <span>{etiqueta}: <span className="font-bold text-foreground">{aciertos}</span></span>
          <span aria-label="Tiempo">⏱ {segundosATexto(segundos)}</span>
        </span>
      </div>
      {total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-gradient-to-r from-marca to-marca-2 transition-all" style={{ width: `${(Math.min(actual, total) / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

function mensajeFinal(ratio) {
  if (ratio === 1) return { emoji: "🏆", texto: "¡Perfecto!" };
  if (ratio >= 0.7) return { emoji: "🎉", texto: "¡Muy bien!" };
  if (ratio >= 0.4) return { emoji: "💪", texto: "Va por buen camino" };
  return { emoji: "📚", texto: "Siga practicando" };
}

// Pantalla final: guarda la partida (si hay sesión) y muestra el mejor puntaje.
export function FinDelJuego({ clave, score, maxScore, segundos, onOtraVez, children }) {
  const usuario = useUsuario();
  const [mejor, setMejor] = useState(null);
  const guardada = useRef(false);
  const conSesion = Boolean(usuario);

  useEffect(() => {
    if (!conSesion || guardada.current) return;
    guardada.current = true;
    api("/me/games", { method: "POST", body: { game: clave, score, maxScore, seconds: segundos } })
      .then((d) => setMejor(d.games[clave]))
      .catch(() => {});
  }, [conSesion, clave, score, maxScore, segundos]);

  const { emoji, texto } = mensajeFinal(score / maxScore);
  const esRecord = mejor && mejor.score === score && mejor.seconds === segundos && mejor.jugadas > 1;

  return (
    <div className="tarjeta aparecer flex flex-col items-center gap-4 p-8 text-center">
      <span className="text-5xl" aria-hidden="true">{emoji}</span>
      <h2 className="text-2xl font-bold">{texto}</h2>
      <p className="text-lg">
        <span className="text-4xl font-bold texto-gradiente">{score}</span>
        <span className="text-foreground/60"> de {maxScore}</span>
        <span className="block text-sm text-foreground/60">en {segundosATexto(segundos)}</span>
      </p>
      {esRecord && <p className="rounded-full bg-acento/15 px-3 py-1 text-sm font-semibold text-acento">¡Nuevo récord personal!</p>}
      {mejor && !esRecord && mejor.score !== undefined && (
        <p className="text-sm text-foreground/60">Su mejor partida: {mejor.score} de {mejor.maxScore} en {segundosATexto(mejor.seconds)}</p>
      )}
      {usuario === null && (
        <p className="text-sm text-foreground/60">
          <Link href="/ingresar" className="text-enlace underline">Ingrese</Link> para guardar sus puntajes.
        </p>
      )}
      {children}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primario" onClick={onOtraVez}>Jugar otra vez</button>
        <Link href="/juegos" className="btn-secundario">Otros juegos</Link>
      </div>
    </div>
  );
}

// Algoritmo de PSeInt con las palabras clave resaltadas.
const CLAVES = /\b(Algoritmo|FinAlgoritmo|Proceso|FinProceso|Definir|Como|Entero|Real|Caracter|Logico|Leer|Escribir|Sin|Saltar|Si|Entonces|SiNo|FinSi|Segun|Hacer|De|Otro|Modo|FinSegun|Mientras|FinMientras|Para|Hasta|Con|Paso|FinPara|Repetir|Que|Dimension|Verdadero|Falso|MOD|Y|O|NO)\b/g;

export function CodigoPseint({ codigo }) {
  return (
    <pre className="overflow-x-auto rounded-xl oscuro border border-borde bg-azul p-4 font-mono text-sm leading-6" style={{ tabSize: 4 }}>
      {codigo.split("\n").map((linea, i) => (
        <span key={i} className="block">
          <span className="mr-4 inline-block w-5 select-none text-right text-foreground/30">{i + 1}</span>
          {resaltar(linea)}
        </span>
      ))}
    </pre>
  );
}

function resaltar(linea) {
  // Primero se separan los textos entre comillas para no resaltar palabras dentro de ellos.
  return linea.split(/("[^"]*")/).map((parte, i) => {
    if (parte.startsWith('"')) return <span key={i} className="text-acento">{parte}</span>;
    const piezas = [];
    let ultimo = 0;
    for (const m of parte.matchAll(CLAVES)) {
      piezas.push(parte.slice(ultimo, m.index));
      piezas.push(<span key={`${i}-${m.index}`} className="font-semibold text-enlace">{m[0]}</span>);
      ultimo = m.index + m[0].length;
    }
    piezas.push(parte.slice(ultimo));
    return <span key={i}>{piezas}</span>;
  });
}
