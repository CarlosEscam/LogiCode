"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";

export default function FormRecuperar() {
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    setError("");
    setCargando(true);
    try {
      setListo((await api("/auth/forgot-password", { method: "POST", body: datos })).mensaje);
    } catch (err) {
      setError(err.message);
    }
    setCargando(false);
  }

  if (listo) return <Aviso tipo="ok">{listo}</Aviso>;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <Campo etiqueta="Cédula o correo" name="cedulaOrEmail" autoComplete="username" required />
      <Aviso>{error}</Aviso>
      <Boton type="submit" cargando={cargando}>Enviar enlace</Boton>
    </form>
  );
}
