"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useUsuario } from "@/lib/api";
import { JUEGOS } from "@/lib/juegos";
import { segundosATexto } from "@/lib/estudiante";
import { Encabezado } from "@/components/Formulario";

// Juegos didácticos (RF-18): para repasar sin nota. Con sesión se guarda el mejor puntaje.
export default function Juegos() {
  const usuario = useUsuario();
  const [mejores, setMejores] = useState(null);
  const conSesion = Boolean(usuario);

  useEffect(() => {
    if (!conSesion) return;
    let vivo = true;
    api("/me/games")
      .then((d) => vivo && setMejores(d.games))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [conSesion]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        {conSesion && <Link href="/panel" className="self-start text-sm text-foreground/60 transition hover:text-violet-300">← Mi panel</Link>}
        <Encabezado titulo="Juegos">Repase lo de clase jugando. No cuentan para la nota.</Encabezado>
      </div>
      <ul className="grid gap-5 md:grid-cols-3">
        {JUEGOS.map((j, i) => {
          const mejor = mejores?.[j.clave];
          return (
            <li key={j.clave} className="aparecer" style={{ animationDelay: `${i * 80}ms` }}>
              <Link href={j.ruta} className={`tono-${j.herramienta} tarjeta-viva group relative flex h-full flex-col gap-3 overflow-hidden p-6`}>
                <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-tono/20 blur-2xl" />
                <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-tono/30 bg-tono/15 text-3xl transition group-hover:scale-110" aria-hidden="true">{j.emoji}</span>
                <span className="relative text-xl font-bold">{j.nombre}</span>
                <span className="relative text-sm text-foreground/70">{j.descripcion}</span>
                <span className="relative mt-auto flex items-center justify-between pt-2 text-sm">
                  <span className="text-xs text-foreground/55">
                    {mejor?.score !== undefined
                      ? `Mejor: ${mejor.score} de ${mejor.maxScore} · ${segundosATexto(mejor.seconds)}`
                      : conSesion ? "Aún no ha jugado" : ""}
                  </span>
                  <span className="font-semibold text-tono">Jugar →</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
