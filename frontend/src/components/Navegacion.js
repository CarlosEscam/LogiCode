"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", texto: "Inicio" },
  { href: "/biblioteca", texto: "Biblioteca" },
  { href: "/foro", texto: "Foro" },
];

// Enlaces principales; resalta la sección en la que está el usuario.
// La ruta se lee dentro de Suspense para no frenar el prerenderizado de las páginas dinámicas.
export default function Navegacion() {
  return (
    <Suspense fallback={<Enlaces ruta={null} />}>
      <ConRuta />
    </Suspense>
  );
}

function ConRuta() {
  return <Enlaces ruta={usePathname()} />;
}

function Enlaces({ ruta }) {
  return (
    <ul className="flex items-center gap-1">
      {enlaces.map((e) => {
        const activo = ruta !== null && (e.href === "/" ? ruta === "/" : ruta.startsWith(e.href));
        return (
          <li key={e.href}>
            <Link
              href={e.href}
              aria-current={activo ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${activo ? "bg-white/10 text-foreground" : "text-foreground/70 hover:bg-white/5 hover:text-foreground"}`}
            >
              {e.texto}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
