import { NOMBRE_HERRAMIENTA } from "@/lib/api";

// Ícono, color y descripción de cada herramienta de la materia.
// El color sale de la clase tono-<HERRAMIENTA> definida en globals.css.

const TRAZOS = {
  // Código
  PSEINT: (
    <>
      <path d="M8 8 4 12l4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m13.5 5-3 14" />
    </>
  ),
  // Diagrama de flujo: inicio, decisión y proceso
  DFD: (
    <>
      <rect x="8" y="2.5" width="8" height="4" rx="2" />
      <path d="M12 6.5v2" />
      <path d="m12 8.5 4.5 4-4.5 4-4.5-4z" />
      <path d="M12 16.5v2" />
      <rect x="8" y="18.5" width="8" height="3" rx="0.5" />
    </>
  ),
  // Bloque de rompecabezas
  SCRATCH: (
    <path d="M5 8h3.5a2 2 0 1 1 4 0H16a1 1 0 0 1 1 1v2.5a2 2 0 1 1 0 4V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
  ),
  // Microcontrolador
  ARDUINO: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  // Libro abierto
  GENERAL: (
    <>
      <path d="M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z" />
      <path d="M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z" />
    </>
  ),
};

export const DESCRIPCION_HERRAMIENTA = {
  PSEINT: "Pseudocódigo en español para escribir tus primeros algoritmos.",
  DFD: "Diagramas de flujo para ver paso a paso el camino de un algoritmo.",
  SCRATCH: "Programación con bloques para crear animaciones y juegos.",
  ARDUINO: "Lleva tus algoritmos al mundo físico con luces y sensores.",
  GENERAL: "Material de la materia que sirve para todas las herramientas.",
};

export function Icono({ herramienta, className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {TRAZOS[herramienta] ?? TRAZOS.GENERAL}
    </svg>
  );
}

// Cuadro de color con el ícono, para encabezar tarjetas.
export function CuadroHerramienta({ herramienta, grande = false }) {
  return (
    <span
      className={`tono-${herramienta} inline-flex shrink-0 items-center justify-center rounded-xl border border-tono/30 bg-tono/15 text-tono ${grande ? "h-12 w-12" : "h-10 w-10"}`}
    >
      <Icono herramienta={herramienta} className={grande ? "h-6 w-6" : "h-5 w-5"} />
    </span>
  );
}

// Etiqueta pequeña con el nombre de la herramienta.
export function EtiquetaHerramienta({ herramienta }) {
  return (
    <span className={`tono-${herramienta} chip`}>
      <Icono herramienta={herramienta} className="h-3.5 w-3.5" />
      {NOMBRE_HERRAMIENTA[herramienta] ?? herramienta}
    </span>
  );
}
