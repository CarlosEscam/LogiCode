"use client";

import { useState } from "react";
import Link from "next/link";
import { api, NOMBRE_ROL, useUsuario } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { Estado, fecha, NOMBRE_ESTADO, useDatos } from "./comun";

// Búsqueda de cuentas y su administración: datos, rol, estado y contraseña.
export default function Usuarios() {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState({ q: "", role: "", status: "", page: 1 });
  const [abierto, setAbierto] = useState(null);
  const [version, setVersion] = useState(0);

  const params = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v !== ""));
  const { datos, error } = useDatos(`/admin/users?${params}`, version);

  const cambiar = (campo, valor) => setFiltro((f) => ({ ...f, [campo]: valor, page: 1 }));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Usuarios</h2>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          cambiar("q", busqueda.trim());
        }}
      >
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cédula, nombre o correo"
          aria-label="Buscar usuario"
          className="campo min-w-0 flex-1 basis-60"
        />
        <select aria-label="Rol" value={filtro.role} onChange={(e) => cambiar("role", e.target.value)} className="campo">
          <option value="">Todos los roles</option>
          {Object.entries(NOMBRE_ROL).map(([valor, nombre]) => (
            <option key={valor} value={valor}>{nombre}</option>
          ))}
        </select>
        <select aria-label="Estado" value={filtro.status} onChange={(e) => cambiar("status", e.target.value)} className="campo">
          <option value="">Todos los estados</option>
          {Object.entries(NOMBRE_ESTADO).map(([valor, nombre]) => (
            <option key={valor} value={valor}>{nombre}</option>
          ))}
        </select>
        <button type="submit" className="btn-secundario">Buscar</button>
      </form>

      <Aviso>{error}</Aviso>
      {datos && (
        <p className="text-sm text-foreground/65">
          {datos.total === 1 ? "1 cuenta" : `${datos.total} cuentas`}
          {filtro.q && <> que coinciden con “{filtro.q}”</>}
        </p>
      )}
      {datos?.users.length === 0 && <p className="tarjeta p-5 text-sm text-foreground/70">No hay cuentas con esos filtros.</p>}

      <ul className="flex flex-col gap-2">
        {datos?.users.map((u) => (
          <li key={u.id} className="tarjeta overflow-hidden">
            <button
              type="button"
              onClick={() => setAbierto(abierto === u.id ? null : u.id)}
              aria-expanded={abierto === u.id}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-foreground/5"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{u.fullName}</span>
                <span className="text-sm text-foreground/60">
                  {NOMBRE_ROL[u.role]} · cédula {u.cedula} · {u.email}
                </span>
              </span>
              <Estado estado={u.status} />
            </button>
            {abierto === u.id && <Detalle id={u.id} onCambio={() => setVersion((v) => v + 1)} />}
          </li>
        ))}
      </ul>

      {datos?.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" className="btn-secundario py-1.5" disabled={filtro.page <= 1} onClick={() => setFiltro((f) => ({ ...f, page: f.page - 1 }))}>
            ← Anterior
          </button>
          <span className="text-foreground/65">Página {datos.page} de {datos.pages}</span>
          <button type="button" className="btn-secundario py-1.5" disabled={filtro.page >= datos.pages} onClick={() => setFiltro((f) => ({ ...f, page: f.page + 1 }))}>
            Siguiente →
          </button>
        </div>
      )}
    </section>
  );
}

function Detalle({ id, onCambio }) {
  const yo = useUsuario();
  const [version, setVersion] = useState(0);
  const { datos, error, setError } = useDatos(`/admin/users/${id}`, version);
  const [aviso, setAviso] = useState("");
  const [temporal, setTemporal] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function guardar(cambios, mensaje) {
    setError("");
    setAviso("");
    setOcupado(true);
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", body: cambios });
      setAviso(mensaje);
      setVersion((v) => v + 1);
      onCambio();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function restablecer(mode) {
    if (mode === "temporary" && !window.confirm("La contraseña actual dejará de servir. ¿Crear una contraseña temporal?")) return;
    setError("");
    setAviso("");
    setTemporal("");
    setOcupado(true);
    try {
      const r = await api(`/admin/users/${id}/reset-password`, { method: "POST", body: { mode } });
      if (r.temporaryPassword) setTemporal(r.temporaryPassword);
      else setAviso(r.mensaje);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  if (!datos) return <div className="border-t border-borde p-4"><Aviso>{error}</Aviso></div>;
  const { user, coursesTaught, coursesEnrolled, activity } = datos;
  const soyYo = yo?.id === user.id;

  return (
    <div className="flex flex-col gap-5 border-t border-borde bg-hundido p-4">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          guardar({ fullName: f.get("fullName"), email: f.get("email") }, "Datos guardados.");
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nombre completo
          <input name="fullName" defaultValue={user.fullName} required className="campo font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Correo
          <input name="email" type="email" defaultValue={user.email} required className="campo font-normal" />
        </label>
        <button type="submit" disabled={ocupado} className="btn-secundario">Guardar datos</button>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Rol
          <select
            value={user.role}
            disabled={soyYo || ocupado}
            onChange={(e) => {
              const rol = e.target.value;
              if (window.confirm(`¿Cambiar el rol de ${user.fullName} a ${NOMBRE_ROL[rol]}?`)) guardar({ role: rol }, "Rol actualizado.");
            }}
            className="campo font-normal"
          >
            {Object.entries(NOMBRE_ROL).map(([valor, nombre]) => (
              <option key={valor} value={valor}>{nombre}</option>
            ))}
          </select>
        </label>
        {!soyYo && user.status !== "ACTIVE" && (
          <button type="button" disabled={ocupado} className="btn-primario" onClick={() => guardar({ status: "ACTIVE" }, "Cuenta activada.")}>
            {user.status === "PENDING" ? "Aprobar cuenta" : "Activar cuenta"}
          </button>
        )}
        {!soyYo && user.status === "ACTIVE" && (
          <button
            type="button"
            disabled={ocupado}
            className="btn-secundario hover:border-peligro/60 hover:text-peligro"
            onClick={() => window.confirm(`¿Deshabilitar la cuenta de ${user.fullName}? No podrá ingresar hasta que la active de nuevo.`) && guardar({ status: "DISABLED" }, "Cuenta deshabilitada.")}
          >
            Deshabilitar cuenta
          </button>
        )}
        {soyYo && <p className="text-sm text-foreground/60">Es su propia cuenta: no puede cambiarle el rol ni deshabilitarla.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Contraseña</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ocupado} className="btn-secundario" onClick={() => restablecer("link")}>
            Enviar enlace al correo
          </button>
          <button type="button" disabled={ocupado} className="btn-secundario" onClick={() => restablecer("temporary")}>
            Crear contraseña temporal
          </button>
        </div>
        {temporal && (
          <div className="rounded-xl border border-acento/40 bg-acento/10 p-3 text-sm text-acento">
            Contraseña temporal: <code className="select-all rounded bg-foreground/10 px-2 py-0.5 font-mono text-base font-semibold text-foreground">{temporal}</code>
            <p className="mt-1 text-acento/80">Entréguela a la persona; no se volverá a mostrar. Con ella ingresa y luego puede cambiarla con “¿Olvidó su contraseña?”.</p>
          </div>
        )}
      </div>

      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{aviso}</Aviso>

      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="font-medium">Cursos que dicta</p>
          {coursesTaught.length === 0 ? <p className="text-foreground/60">Ninguno</p> : coursesTaught.map((c) => (
            <Link key={c.id} href={`/curso/${c.id}`} className="block text-enlace hover:underline">{c.name} ({c.period})</Link>
          ))}
        </div>
        <div>
          <p className="font-medium">Inscrito en</p>
          {coursesEnrolled.length === 0 ? <p className="text-foreground/60">Ningún curso</p> : coursesEnrolled.map((c) => (
            <p key={c.id}>{c.name} ({c.period})</p>
          ))}
        </div>
        <div>
          <p className="font-medium">Actividad</p>
          <p className="text-foreground/70">
            {activity.forumThreads} temas y {activity.forumPosts} mensajes en el foro · {activity.materials} materiales subidos
          </p>
          <p className="text-foreground/60">Cuenta creada el {fecha(user.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}
