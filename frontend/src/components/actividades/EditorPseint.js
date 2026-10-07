"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export const PLANTILLA_PSEINT = `Algoritmo MiAlgoritmo
	Definir numero Como Entero
	Escribir "Ingrese un número:"
	Leer numero
	Escribir "El doble es ", numero * 2
FinAlgoritmo
`;

// Editor de PSeInt en el navegador (RF-28): se escribe el algoritmo, se prueba con una
// entrada y se ve lo que escribe. La ejecución la hace la API con el mismo intérprete que califica.
export default function EditorPseint({ codigo, onCambio, name }) {
  const [entrada, setEntrada] = useState("");
  const [resultado, setResultado] = useState(null);
  const [corriendo, setCorriendo] = useState(false);

  // Tab escribe una tabulación en vez de saltar al siguiente campo.
  function teclas(e) {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const t = e.currentTarget;
    const { selectionStart: a, selectionEnd: b } = t;
    const nuevo = codigo.slice(0, a) + "\t" + codigo.slice(b);
    onCambio(nuevo);
    requestAnimationFrame(() => t.setSelectionRange(a + 1, a + 1));
  }

  async function ejecutar() {
    setCorriendo(true);
    try {
      setResultado(await api("/pseint/run", { method: "POST", body: { codigo, entrada } }));
    } catch (e) {
      setResultado({ salida: "", error: { mensaje: e.message } });
    } finally {
      setCorriendo(false);
    }
  }

  const lineas = codigo.split("\n").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex overflow-hidden rounded-xl border border-borde bg-black/40 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/30">
        <pre aria-hidden="true" className="select-none border-r border-borde px-2 py-3 text-right font-mono text-sm leading-6 text-foreground/35">
          {Array.from({ length: lineas }, (_, i) => i + 1).join("\n")}
        </pre>
        <textarea
          name={name}
          value={codigo}
          onChange={(e) => onCambio(e.target.value)}
          onKeyDown={teclas}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={Math.max(12, lineas + 1)}
          aria-label="Algoritmo de PSeInt"
          className="min-w-0 flex-1 resize-y bg-transparent px-3 py-3 font-mono text-sm leading-6 text-foreground focus:outline-none"
          style={{ tabSize: 4 }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
          Entrada para probar (un dato por línea)
          <textarea value={entrada} onChange={(e) => setEntrada(e.target.value)} rows={4} className="campo font-mono font-normal" />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
          Salida
          <pre className={`min-h-[6.5rem] overflow-auto whitespace-pre-wrap rounded-xl border p-3 font-mono font-normal ${resultado?.error ? "border-rose-500/40 bg-rose-500/5" : "border-borde bg-black/25"}`}>
            {resultado ? resultado.salida || (resultado.error ? "" : "(el algoritmo no escribió nada)") : "Pulse Ejecutar para probar el algoritmo."}
            {resultado?.error && <span className="block text-rose-300">{resultado.error.mensaje}</span>}
          </pre>
        </div>
      </div>
      <div>
        <button type="button" onClick={ejecutar} disabled={corriendo || !codigo.trim()} className="btn-secundario">
          {corriendo ? "Ejecutando..." : "▶ Ejecutar"}
        </button>
      </div>
    </div>
  );
}
