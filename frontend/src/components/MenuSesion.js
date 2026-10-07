"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cerrarSesion, useUsuario } from "@/lib/api";
import Avatar from "@/components/Avatar";

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
      <Link href="/perfil" title="Mi perfil" aria-label="Mi perfil" className="mr-1 rounded-full ring-2 ring-transparent transition hover:ring-marca/60">
        <Avatar persona={usuario} tamano="sm" />
      </Link>
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
