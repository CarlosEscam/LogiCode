"use client";

import { useState } from "react";
import Resumen from "./admin/Resumen";
import Usuarios from "./admin/Usuarios";
import Cursos from "./admin/Cursos";
import BibliotecaAdmin from "./admin/BibliotecaAdmin";
import Copias from "./admin/Copias";

const SECCIONES = [
  { id: "resumen", nombre: "Resumen" },
  { id: "usuarios", nombre: "Usuarios" },
  { id: "cursos", nombre: "Cursos" },
  { id: "biblioteca", nombre: "Biblioteca" },
  { id: "copias", nombre: "Copias de seguridad" },
];

// Panel del administrador: aprobación de docentes (RF-02), cuentas, cursos, biblioteca y copias (RNF-07).
export default function PanelAdmin() {
  const [seccion, setSeccion] = useState("resumen");

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Secciones del administrador" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeccion(s.id)}
            aria-current={seccion === s.id ? "page" : undefined}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition ${
              seccion === s.id
                ? "border-marca bg-marca/15 text-violet-100 shadow-md shadow-marca/20"
                : "border-borde bg-white/5 text-foreground/75 hover:border-marca/50 hover:text-foreground"
            }`}
          >
            {s.nombre}
          </button>
        ))}
      </nav>
      {seccion === "resumen" && <Resumen onIrA={setSeccion} />}
      {seccion === "usuarios" && <Usuarios />}
      {seccion === "cursos" && <Cursos />}
      {seccion === "biblioteca" && <BibliotecaAdmin />}
      {seccion === "copias" && <Copias />}
    </div>
  );
}
