"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NOMBRE_ROL, useUsuario } from "@/lib/api";
import PanelAdmin from "./PanelAdmin";
import PanelDocente from "./PanelDocente";
import PanelEstudiante from "./PanelEstudiante";

// Panel según el rol del usuario. Sin sesión, lleva a ingresar.
export default function Panel() {
  const usuario = useUsuario();
  const router = useRouter();

  useEffect(() => {
    if (usuario === null) router.replace("/ingresar");
  }, [usuario, router]);

  if (!usuario) return null;

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
