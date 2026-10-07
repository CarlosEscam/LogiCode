"use client";

import Link from "next/link";
import { NOMBRE_ROL, useUsuario } from "@/lib/api";
import PanelAdmin from "./PanelAdmin";
import PanelDocente from "./PanelDocente";
import PanelEstudiante from "./PanelEstudiante";

// Panel según el rol del usuario.
export default function Panel() {
  const usuario = useUsuario();

  // Sin sesión se muestra un enlace en vez de redirigir: al salir desde el panel,
  // una redirección aquí competía con la del botón Salir.
  if (usuario === undefined) return null;
  if (usuario === null) {
    return (
      <p>
        <Link href="/ingresar" className="underline">Ingrese</Link> para ver su panel.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {usuario.fullName}</h1>
        <p className="text-sm opacity-70">{NOMBRE_ROL[usuario.role]} · cédula {usuario.cedula}</p>
      </div>
      {usuario.role === "ADMIN" && <PanelAdmin />}
      {usuario.role === "TEACHER" && <PanelDocente />}
      {usuario.role === "STUDENT" && <PanelEstudiante />}
    </div>
  );
}
