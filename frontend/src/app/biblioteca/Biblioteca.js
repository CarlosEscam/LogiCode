"use client";

import { useEffect, useState } from "react";
import { api, HERRAMIENTAS, useUsuario } from "@/lib/api";
import { Aviso, Encabezado } from "@/components/Formulario";
import { CuadroHerramienta, Icono } from "@/components/Herramienta";
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
    <div className="flex flex-col gap-6">
      <Encabezado titulo="Biblioteca" icono={<CuadroHerramienta herramienta="GENERAL" grande />}>
        Material público de Pensamiento Computacional, abierto para cualquier visitante.
      </Encabezado>

      <div className="flex flex-wrap gap-2 text-sm">
        {[{ valor: "", nombre: "Todo" }, ...HERRAMIENTAS].map((h) => (
          <button
            key={h.valor}
            type="button"
            onClick={() => setHerramienta(h.valor)}
            aria-pressed={herramienta === h.valor}
            className={`${h.valor ? `tono-${h.valor}` : ""} inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-medium transition ${
              herramienta === h.valor
                ? "border-tono bg-tono/20 text-tono shadow-md shadow-tono/20"
                : "border-borde bg-white/5 text-foreground/75 hover:border-tono/60 hover:text-tono"
            }`}
          >
            {h.valor && <Icono herramienta={h.valor} className="h-4 w-4" />}
            {h.nombre}
          </button>
        ))}
      </div>

      <Aviso>{error}</Aviso>
      {materiales?.length === 0 && (
        <div className="tarjeta flex flex-col items-center gap-2 border-dashed px-6 py-12 text-center">
          <span className="text-4xl" aria-hidden="true">📭</span>
          <p className="text-foreground/70">Todavía no hay material en esta sección.</p>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {materiales?.map((m) => (
          <Material
            key={m.id}
            material={m}
            onBorrar={usuario && (usuario.role === "ADMIN" || usuario.id === m.uploadedById) ? () => borrar(m) : undefined}
          />
        ))}
      </ul>

      {puedeSubir && (
        <details className="desplegable">
          <summary>Subir material a la biblioteca</summary>
          <div className="mt-3">
            <FormMaterial herramienta={herramienta || "GENERAL"} onCreado={() => setVersion((v) => v + 1)} />
          </div>
        </details>
      )}
    </div>
  );
}
