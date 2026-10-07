"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cerrarSesion, useUsuario } from "@/lib/api";

// Parte derecha del encabezado: "Ingresar" o el nombre del usuario con su panel.
export default function MenuSesion() {
  const usuario = useUsuario();
  const router = useRouter();

  if (usuario === undefined) return null;
  if (!usuario) {
    return (
      <Link href="/ingresar" className="btn-primario py-1.5">
        Ingresar
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Link href="/panel" className="btn-primario py-1.5">
        Mi panel
      </Link>
      <button
        type="button"
        className="accion"
        onClick={() => {
          cerrarSesion();
          router.push("/");
        }}
      >
        Salir
      </button>
    </div>
  );
}
