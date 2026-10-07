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
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Docentes pendientes de aprobación</h2>
      <Aviso>{error}</Aviso>
      {docentes?.length === 0 && <p className="text-sm opacity-70">No hay solicitudes pendientes.</p>}
      <ul className="flex flex-col gap-2">
        {docentes?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/15 px-3 py-2 dark:border-white/20">
            <div>
              <p className="font-medium">{d.fullName}</p>
              <p className="text-sm opacity-70">Cédula {d.cedula} · {d.email}</p>
            </div>
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => decidir(d.id, "approve")} className="rounded-md bg-foreground px-3 py-1.5 text-background">
                Aprobar
              </button>
              <button type="button" onClick={() => decidir(d.id, "disable")} className="rounded-md border border-black/20 px-3 py-1.5 dark:border-white/25">
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
