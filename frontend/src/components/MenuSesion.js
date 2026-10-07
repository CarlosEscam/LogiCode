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
      <Link href="/ingresar" className="rounded-md bg-foreground px-3 py-1.5 text-background">
        Ingresar
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Link href="/panel" className="rounded-md bg-foreground px-3 py-1.5 text-background">
        Mi panel
      </Link>
      <button
        type="button"
        className="hover:underline"
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
