"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, guardarSesion } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";

export default function FormRegistro() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    setError("");
    if (datos.password !== datos.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      const res = await api("/auth/register", { method: "POST", body: datos });
      if (res.token) {
        guardarSesion(res);
        router.push("/panel");
      } else {
        setListo(res.mensaje);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  if (listo) {
    return (
      <div className="flex flex-col gap-3">
        <Aviso tipo="ok">{listo}</Aviso>
        <Link href="/" className="text-sm text-violet-300 hover:text-violet-200 hover:underline">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={enviar} className="flex flex-col gap-3">
      <fieldset className="flex gap-4 text-sm accent-violet-500">
        <legend className="mb-1.5 font-medium">Soy</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="STUDENT" defaultChecked /> Estudiante
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="TEACHER" /> Docente
        </label>
      </fieldset>
      <Campo etiqueta="Cédula" name="cedula" inputMode="numeric" autoComplete="username" required />
      <Campo etiqueta="Nombre completo" name="fullName" autoComplete="name" required />
      <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required />
      <Campo etiqueta="Contraseña (mínimo 8 caracteres)" name="password" type="password" minLength={8} autoComplete="new-password" required />
      <Campo etiqueta="Repetir contraseña" name="confirmar" type="password" minLength={8} autoComplete="new-password" required />
      <Aviso>{error}</Aviso>
      <Boton type="submit" cargando={cargando}>Crear cuenta</Boton>
      <Link href="/ingresar" className="text-sm text-violet-300 hover:text-violet-200 hover:underline">Ya tengo cuenta</Link>
    </form>
  );
}
