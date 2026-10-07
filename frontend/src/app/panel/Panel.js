"use client";

import Link from "next/link";
import { useEffect } from "react";
import { actualizarUsuario, api, NOMBRE_ROL, useUsuario } from "@/lib/api";
import PanelAdmin from "./PanelAdmin";
import PanelDocente from "./PanelDocente";
import PanelEstudiante from "./PanelEstudiante";
import Avatar from "@/components/Avatar";

// Panel según el rol del usuario.
export default function Panel() {
  const usuario = useUsuario();
  const conSesion = Boolean(usuario);

  // Trae los datos del usuario al abrir el panel, por si cambió su foto desde otro equipo.
  useEffect(() => {
    if (!conSesion) return;
    api("/auth/me")
      .then(({ user }) => actualizarUsuario(user))
      .catch(() => {});
  }, [conSesion]);

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
        <Link href="/perfil" title="Cambiar foto de perfil" className="relative rounded-2xl ring-2 ring-transparent transition hover:ring-marca/60">
          <Avatar persona={usuario} tamano="lg" />
        </Link>
        <div className="relative flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hola, {usuario.fullName}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
            <span className="rounded-full border border-marca/40 bg-marca/15 px-2.5 py-0.5 text-xs font-semibold text-violet-200">
              {NOMBRE_ROL[usuario.role]}
            </span>
            cédula {usuario.cedula}
            <Link href="/perfil" className="text-violet-300 hover:text-violet-200 hover:underline">· Mi perfil</Link>
          </p>
        </div>
      </div>
      {usuario.role === "ADMIN" && <PanelAdmin />}
      {usuario.role === "TEACHER" && <PanelDocente />}
      {usuario.role === "STUDENT" && <PanelEstudiante />}
    </div>
  );
}
