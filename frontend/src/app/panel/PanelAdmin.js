"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Aviso } from "@/components/Formulario";

// Aprobación de docentes (RF-02).
export default function PanelAdmin() {
  const [docentes, setDocentes] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    api("/admin/teachers?status=PENDING")
      .then((d) => vivo && setDocentes(d.teachers))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [version]);

  async function decidir(id, accion) {
    setError("");
    try {
      await api(`/admin/teachers/${id}/${accion}`, { method: "POST" });
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Docentes pendientes de aprobación</h2>
      <Aviso>{error}</Aviso>
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
              <button type="button" onClick={() => decidir(d.id, "disable")} className="btn-secundario py-1.5 hover:border-rose-400/60 hover:text-rose-300">
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
