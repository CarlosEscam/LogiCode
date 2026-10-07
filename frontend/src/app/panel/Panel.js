"use client";

import Link from "next/link";
import { NOMBRE_ROL, useUsuario } from "@/lib/api";
import PanelAdmin from "./PanelAdmin";
import PanelDocente from "./PanelDocente";
import PanelEstudiante from "./PanelEstudiante";

function iniciales(nombre) {
  return String(nombre ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

// Panel según el rol del usuario.
export default function Panel() {
  const usuario = useUsuario();

  // Sin sesión se muestra un enlace en vez de redirigir: al salir desde el panel,
  // una redirección aquí competía con la del botón Salir.
  if (usuario === undefined) return null;
  if (usuario === null) {
    return (
      <p className="tarjeta p-6">
        <Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para ver su panel.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="aparecer relative flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl border border-borde bg-gradient-to-br from-marca/25 via-superficie to-marca-2/10 p-6 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-marca/25 blur-3xl" />
        <span className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-marca to-marca-2 text-xl font-bold text-white shadow-lg shadow-marca/30">
          {iniciales(usuario.fullName)}
        </span>
        <div className="relative flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hola, {usuario.fullName}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
            <span className="rounded-full border border-marca/40 bg-marca/15 px-2.5 py-0.5 text-xs font-semibold text-violet-200">
              {NOMBRE_ROL[usuario.role]}
            </span>
            cédula {usuario.cedula}
          </p>
        </div>
      </div>
      {usuario.role === "ADMIN" && <PanelAdmin />}
      {usuario.role === "TEACHER" && <PanelDocente />}
      {usuario.role === "STUDENT" && <PanelEstudiante />}
    </div>
  );
}
