"use client";

import { useEffect, useState } from "react";
import { api, HERRAMIENTAS, useUsuario } from "@/lib/api";
import { Aviso, Encabezado } from "@/components/Formulario";
import { CuadroHerramienta, Icono } from "@/components/Herramienta";
import Material from "@/components/Material";
import FormMaterial from "@/components/FormMaterial";

// Agrupa el material por tema, en el orden del curso; lo que no tiene tema va al final.
function porTema(materiales) {
  const grupos = new Map();
  for (const m of materiales) {
    const clave = m.topic?.id ?? "otros";
    if (!grupos.has(clave)) grupos.set(clave, { tema: m.topic, materiales: [] });
    grupos.get(clave).materiales.push(m);
  }
  return [...grupos.values()].sort((a, b) => (a.tema?.position ?? Infinity) - (b.tema?.position ?? Infinity));
}

// Material público para visitantes, organizado por tema y filtrado por herramienta (RF-20).
// Docentes y administradores pueden subir directo aquí.
export default function Biblioteca() {
  const usuario = useUsuario();
  const [herramienta, setHerramienta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [materiales, setMateriales] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  // La búsqueda espera a que se deje de escribir para no pedir una lista por cada tecla.
  useEffect(() => {
    let vivo = true;
    const params = new URLSearchParams();
    if (herramienta) params.set("tool", herramienta);
    if (busqueda.trim()) params.set("q", busqueda.trim());
    const espera = setTimeout(() => {
      api(`/library?${params}`)
        .then((d) => {
          if (!vivo) return;
          setMateriales(d.materials);
          setError("");
        })
        .catch((e) => vivo && setError(e.message));
    }, busqueda ? 300 : 0);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [herramienta, busqueda, version]);

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

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por título, descripción o tema..."
        aria-label="Buscar en la biblioteca"
        className="campo"
      />

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
          <p className="text-foreground/70">
            {busqueda.trim() ? "No se encontró material con esa búsqueda." : "Todavía no hay material en esta sección."}
          </p>
        </div>
      )}
      {materiales &&
        porTema(materiales).map(({ tema, materiales: lista }) => (
          <section key={tema?.id ?? "otros"} className="flex flex-col gap-3">
            <h2 className={`${tema ? `tono-${tema.tool}` : ""} flex items-center gap-2 text-lg font-semibold`}>
              {tema && <Icono herramienta={tema.tool} className="h-5 w-5 text-tono" />}
              {tema ? tema.title : "Material general"}
              <span className="text-sm font-normal text-foreground/55">({lista.length})</span>
            </h2>
            <ul className="flex flex-col gap-3">
              {lista.map((m) => (
                <Material
                  key={m.id}
                  material={m}
                  onBorrar={usuario && (usuario.role === "ADMIN" || usuario.id === m.uploadedById) ? () => borrar(m) : undefined}
                />
              ))}
            </ul>
          </section>
        ))}

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
