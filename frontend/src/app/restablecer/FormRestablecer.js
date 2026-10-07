"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";

export default function FormRestablecer({ token }) {
  const [error, setError] = useState(token ? "" : "El enlace está incompleto. Solicite uno nuevo.");
  const [listo, setListo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const { password, confirmar } = Object.fromEntries(new FormData(e.currentTarget));
    setError("");
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      setListo((await api("/auth/reset-password", { method: "POST", body: { token, password } })).mensaje);
    } catch (err) {
      setError(err.message);
    }
    setCargando(false);
  }

  if (listo) {
    return (
      <div className="flex flex-col gap-3">
        <Aviso tipo="ok">{listo}</Aviso>
        <Link href="/ingresar" className="text-sm hover:underline">Ir a ingresar</Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <Campo etiqueta="Contraseña nueva (mínimo 8 caracteres)" name="password" type="password" minLength={8} autoComplete="new-password" required />
      <Campo etiqueta="Repetir contraseña" name="confirmar" type="password" minLength={8} autoComplete="new-password" required />
      <Aviso>{error}</Aviso>
      <Boton type="submit" cargando={cargando} disabled={!token}>Guardar contraseña</Boton>
      <Link href="/recuperar" className="text-sm hover:underline">Pedir otro enlace</Link>
    </form>
  );
}
