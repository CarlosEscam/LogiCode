"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { CuadroHerramienta, EtiquetaHerramienta } from "@/components/Herramienta";
import { fechaForo } from "@/app/foro/comun";

// Lo último de la biblioteca y del foro, para que el visitante vea movimiento al entrar.
export default function Recientes() {
  const [materiales, setMateriales] = useState(null);
  const [temas, setTemas] = useState(null);

  useEffect(() => {
    let vivo = true;
    api("/library?limit=4")
      .then((d) => vivo && setMateriales(d.materials))
      .catch(() => vivo && setMateriales([]));
    api("/forum/threads")
      .then((d) => vivo && setTemas(d.threads.slice(0, 4)))
      .catch(() => vivo && setTemas([]));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Columna titulo="Lo nuevo en la biblioteca" href="/biblioteca" enlace="Ver toda la biblioteca" vacio="Todavía no hay material público." lista={materiales}>
        {(m) => (
          <Link href="/biblioteca" className={`tono-${m.tool} group flex items-start gap-3 px-5 py-3.5 transition hover:bg-foreground/5`}>
            <CuadroHerramienta herramienta={m.tool} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-medium leading-snug transition group-hover:text-tono">{m.title}</span>
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-foreground/60">
                <EtiquetaHerramienta herramienta={m.tool} />
                {m.topic && <span>{m.topic.title}</span>}
              </span>
            </span>
          </Link>
        )}
      </Columna>
      <Columna titulo="Conversaciones en el foro" href="/foro" enlace="Ir al foro" vacio="Todavía no hay temas en el foro." lista={temas}>
        {(t) => (
          <Link href={`/foro/tema/${t.id}`} className="group flex flex-col gap-1 px-5 py-3.5 transition hover:bg-foreground/5">
            <span className="font-medium leading-snug transition group-hover:text-enlace">
              {t.isPinned && <span className="mr-2 rounded-full bg-acento/15 px-2 py-0.5 text-xs font-semibold text-acento">📌 Fijado</span>}
              {t.title}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 text-xs text-foreground/60">
              <EtiquetaHerramienta herramienta={t.category} />
              {t.replies} {t.replies === 1 ? "respuesta" : "respuestas"} · {fechaForo(t.lastPostAt)}
            </span>
          </Link>
        )}
      </Columna>
    </section>
  );
}

function Columna({ titulo, href, enlace, vacio, lista, children }) {
  return (
    <div className="tarjeta flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-borde px-5 py-4">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <Link href={href} className="text-sm font-medium text-enlace hover:underline">
          {enlace} →
        </Link>
      </div>
      {lista === null && <p className="px-5 py-6 text-sm text-foreground/60">Cargando...</p>}
      {lista?.length === 0 && <p className="px-5 py-6 text-sm text-foreground/60">{vacio}</p>}
      {lista?.length > 0 && (
        <ul className="divide-y divide-borde">
          {lista.map((x) => (
            <li key={x.id}>{children(x)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
