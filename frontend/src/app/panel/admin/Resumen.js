"use client";

import { useState } from "react";
import { api, NOMBRE_ROL } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { Estado, fecha, useDatos } from "./comun";

function Cifra({ titulo, valor, detalle }) {
  return (
    <div className="tarjeta flex flex-col gap-1 p-4">
      <p className="text-sm text-foreground/65">{titulo}</p>
      <p className="text-3xl font-bold tracking-tight">{valor ?? "—"}</p>
      {detalle && <p className="text-xs text-foreground/60">{detalle}</p>}
    </div>
  );
}

// Docentes pendientes de aprobación (RF-02) y cifras de la plataforma.
export default function Resumen({ onIrA }) {
  const [version, setVersion] = useState(0);
  const pendientes = useDatos("/admin/teachers?status=PENDING", version);
  const { datos: s, error } = useDatos("/admin/stats", version);
  const [errorAccion, setErrorAccion] = useState("");

  async function decidir(id, accion) {
    setErrorAccion("");
    try {
      await api(`/admin/teachers/${id}/${accion}`, { method: "POST" });
      setVersion((v) => v + 1);
    } catch (e) {
      setErrorAccion(e.message);
    }
  }

  const docentes = pendientes.datos?.teachers;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">Docentes pendientes de aprobación</h2>
        <Aviso>{pendientes.error || errorAccion}</Aviso>
        {docentes?.length === 0 && <p className="tarjeta p-5 text-sm text-foreground/70">✅ No hay solicitudes pendientes.</p>}
        <ul className="flex flex-col gap-3">
          {docentes?.map((d) => (
            <li key={d.id} className="tarjeta-viva flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{d.fullName}</p>
                <p className="text-sm text-foreground/65">Cédula {d.cedula} · {d.email}</p>
              </div>
              <div className="flex gap-2 text-sm">
                <button type="button" onClick={() => decidir(d.id, "approve")} className="btn-primario py-1.5">
                  Aprobar
                </button>
                <button type="button" onClick={() => decidir(d.id, "disable")} className="btn-secundario py-1.5 hover:border-peligro/60 hover:text-peligro">
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">La plataforma en cifras</h2>
        <Aviso>{error}</Aviso>
        {s && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Cifra titulo="Estudiantes" valor={s.users.STUDENT.ACTIVE} detalle={s.users.STUDENT.DISABLED ? `${s.users.STUDENT.DISABLED} deshabilitados` : "con cuenta activa"} />
            <Cifra titulo="Docentes" valor={s.users.TEACHER.ACTIVE} detalle={`${s.users.TEACHER.PENDING} pendientes · ${s.users.TEACHER.DISABLED} deshabilitados`} />
            <Cifra titulo="Administradores" valor={s.users.ADMIN.ACTIVE} />
            <Cifra titulo="Cuentas nuevas" valor={s.newUsersLast7Days} detalle="en los últimos 7 días" />
            <Cifra titulo="Cursos" valor={s.courses} detalle={`${s.topics} temas en total`} />
            <Cifra titulo="Cédulas habilitadas" valor={s.roster.total} detalle={`${s.roster.registered} ya crearon su cuenta`} />
            <Cifra titulo="Material" valor={s.materials.total} detalle={`${s.materials.public} en la biblioteca pública`} />
            <Cifra titulo="Foro" valor={s.forum.threads} detalle={`temas · ${s.forum.posts} mensajes`} />
            <Cifra titulo="Quizzes publicados" valor={s.quizzes.published} detalle={`${s.quizzes.attemptsSubmitted} intentos enviados`} />
          </div>
        )}
      </section>

      {s?.recentUsers.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight">Últimas cuentas creadas</h2>
            <button type="button" className="accion text-enlace" onClick={() => onIrA("usuarios")}>
              Ver todos los usuarios →
            </button>
          </div>
          <ul className="tarjeta divide-y divide-borde">
            {s.recentUsers.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{u.fullName}</span>
                  <span className="text-foreground/60"> · {NOMBRE_ROL[u.role]} · {fecha(u.createdAt)}</span>
                </span>
                <Estado estado={u.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
