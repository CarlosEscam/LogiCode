"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, guardarSesion } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";

export default function FormIngresar() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    setError("");
    setCargando(true);
    try {
      guardarSesion(await api("/auth/login", { method: "POST", body: datos }));
      router.push("/panel");
    } catch (err) {
      setError(err.message);
    } finally {
      // Next.js conserva esta página al navegar; si no se apaga aquí, al volver
      // (por ejemplo después de salir) el botón seguiría en "Un momento...".
      setCargando(false);
    }
  }

  return (
    <form method="post" onSubmit={enviar} className="flex flex-col gap-3">
      <Campo etiqueta="Cédula" name="cedula" inputMode="numeric" autoComplete="username" required />
      <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" required />
      <Aviso>{error}</Aviso>
      <Boton type="submit" cargando={cargando}>Ingresar</Boton>
      <div className="flex justify-between text-sm">
        <Link href="/registro" className="text-enlace hover:text-enlace hover:underline">Crear cuenta</Link>
        <Link href="/recuperar" className="text-enlace hover:text-enlace hover:underline">Olvidé mi contraseña</Link>
      </div>
    </form>
  );
}
