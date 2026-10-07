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
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <Campo etiqueta="Cédula" name="cedula" inputMode="numeric" autoComplete="username" required />
      <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" required />
      <Aviso>{error}</Aviso>
      <Boton type="submit" cargando={cargando}>Ingresar</Boton>
      <div className="flex justify-between text-sm">
        <Link href="/registro" className="hover:underline">Crear cuenta</Link>
        <Link href="/recuperar" className="hover:underline">Olvidé mi contraseña</Link>
      </div>
    </form>
  );
}
