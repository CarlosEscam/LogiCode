"use client";

import { useEffect, useState } from "react";
import { api, HERRAMIENTAS, useUsuario } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import Material from "@/components/Material";
import FormMaterial from "@/components/FormMaterial";

// Material público para visitantes, filtrado por herramienta.
// Docentes y administradores pueden subir directo aquí.
export default function Biblioteca() {
  const usuario = useUsuario();
  const [herramienta, setHerramienta] = useState("");
  const [materiales, setMateriales] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    api(`/library${herramienta ? `?tool=${herramienta}` : ""}`)
      .then((d) => vivo && setMateriales(d.materials))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [herramienta, version]);

  const puedeSubir = usuario && ["TEACHER", "ADMIN"].includes(usuario.role);

  async function borrar(m) {
    if (!window.confirm(`¿Borrar "${m.title}" de la biblioteca?`)) return;
    try {
      await api(`/materials/${m.id}`, { method: "DELETE" });
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Biblioteca</h1>
        <p className="opacity-80">Material público de Pensamiento Computacional, abierto para cualquier visitante.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[{ valor: "", nombre: "Todo" }, ...HERRAMIENTAS].map((h) => (
          <button
            key={h.valor}
            type="button"
            onClick={() => setHerramienta(h.valor)}
            className={`rounded-full border px-3 py-1 ${herramienta === h.valor ? "border-foreground bg-foreground text-background" : "border-black/15 dark:border-white/20"}`}
          >
            {h.nombre}
          </button>
        ))}
      </div>

      <Aviso>{error}</Aviso>
      {materiales?.length === 0 && <p className="opacity-70">Todavía no hay material en esta sección.</p>}
      <ul className="flex flex-col gap-2">
        {materiales?.map((m) => (
          <Material
            key={m.id}
            material={m}
            onBorrar={usuario && (usuario.role === "ADMIN" || usuario.id === m.uploadedById) ? () => borrar(m) : undefined}
          />
        ))}
      </ul>

      {puedeSubir && (
        <details className="text-sm">
          <summary className="cursor-pointer">Subir material a la biblioteca</summary>
          <div className="mt-2">
            <FormMaterial herramienta={herramienta || "GENERAL"} onCreado={() => setVersion((v) => v + 1)} />
          </div>
        </details>
      )}
    </div>
  );
}
