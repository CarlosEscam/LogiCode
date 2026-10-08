"use client";

import { useState } from "react";
import Link from "next/link";
import { actualizarUsuario, api, NOMBRE_ROL, useUsuario } from "@/lib/api";
import { Aviso, Boton, Campo, Encabezado } from "@/components/Formulario";
import EditorFoto from "@/components/EditorFoto";

// Perfil del usuario: foto, datos, correo y contraseña. Sirve para todos los roles.
export default function Perfil() {
  const usuario = useUsuario();

  if (usuario === undefined) return null;
  if (usuario === null) {
    return (
      <p className="tarjeta p-6">
        <Link href="/ingresar" className="font-semibold text-enlace underline">Ingrese</Link> para ver su perfil.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/panel" className="self-start text-sm text-foreground/60 transition hover:text-enlace">← Mi panel</Link>
        <Encabezado titulo="Mi perfil">Su foto, su correo y su contraseña.</Encabezado>
      </div>

      <section className="tarjeta flex flex-col gap-4 p-6">
        <h2 className="text-lg font-bold tracking-tight">Foto de perfil</h2>
        <EditorFoto usuario={usuario} />
      </section>

      <section className="tarjeta flex flex-col gap-4 p-6">
        <h2 className="text-lg font-bold tracking-tight">Mis datos</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Dato titulo="Nombre">{usuario.fullName}</Dato>
          <Dato titulo="Cédula">{usuario.cedula}</Dato>
          <Dato titulo="Rol">{NOMBRE_ROL[usuario.role]}</Dato>
        </dl>
        {usuario.role === "STUDENT" && (
          <p className="text-xs text-foreground/60">Si su nombre o su cédula están mal, pídale a su docente que los corrija en la lista del curso.</p>
        )}
        <FormCorreo usuario={usuario} />
      </section>

      <section className="tarjeta flex flex-col gap-4 p-6">
        <h2 className="text-lg font-bold tracking-tight">Cambiar contraseña</h2>
        <FormContrasena />
      </section>
    </div>
  );
}

function Dato({ titulo, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{titulo}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function FormCorreo({ usuario }) {
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    setCargando(true);
    try {
      const { user } = await api("/me", { method: "PATCH", body: { email: new FormData(e.currentTarget).get("email") } });
      actualizarUsuario(user);
      setAviso("Correo actualizado. Ahí le llegará el enlace si olvida su contraseña.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 sm:max-w-md">
      <Campo etiqueta="Correo para recuperar la contraseña" name="email" type="email" defaultValue={usuario.email} required autoComplete="email" />
      <Aviso tipo="ok">{aviso}</Aviso>
      <Aviso>{error}</Aviso>
      <div>
        <Boton type="submit" cargando={cargando}>Guardar correo</Boton>
      </div>
    </form>
  );
}

function FormContrasena() {
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form));
    setError("");
    setAviso("");
    if (datos.newPassword !== datos.repetir) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      await api("/me/password", { method: "POST", body: { currentPassword: datos.currentPassword, newPassword: datos.newPassword } });
      form.reset();
      setAviso("Contraseña cambiada. Úsela la próxima vez que ingrese.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 sm:max-w-md">
      <Campo etiqueta="Contraseña actual" name="currentPassword" type="password" required autoComplete="current-password" />
      <Campo etiqueta="Contraseña nueva (mínimo 8 caracteres)" name="newPassword" type="password" minLength={8} maxLength={72} required autoComplete="new-password" />
      <Campo etiqueta="Repita la contraseña nueva" name="repetir" type="password" minLength={8} maxLength={72} required autoComplete="new-password" />
      <Aviso tipo="ok">{aviso}</Aviso>
      <Aviso>{error}</Aviso>
      <div>
        <Boton type="submit" cargando={cargando}>Cambiar contraseña</Boton>
      </div>
    </form>
  );
}
