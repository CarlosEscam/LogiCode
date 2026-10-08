"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { nota } from "./comun";

// El docente pone o ajusta la nota de una entrega y deja un comentario (RF-13).
export default function Calificar({ entrega, maximo = 5, onGuardada }) {
  const propuesta = entrega.finalGrade ?? entrega.autoGrade;
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(null);

  async function guardar(e) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    setError("");
    setCargando("guardar");
    try {
      const { submission } = await api(`/submissions/${entrega.id}`, {
        method: "PATCH",
        body: { finalGrade: datos.finalGrade, teacherComment: datos.teacherComment },
      });
      onGuardada?.(submission);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  async function recalificar() {
    setError("");
    setCargando("recalificar");
    try {
      const { submission } = await api(`/submissions/${entrega.id}/regrade`, { method: "POST" });
      onGuardada?.(submission);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3 rounded-xl border border-borde bg-hundido p-3">
      {entrega.autoGrade !== null && entrega.autoGrade !== undefined && (
        <p className="text-sm text-foreground/75">
          Nota propuesta por la plataforma: <strong>{nota(entrega.autoGrade)}</strong>
          {entrega.confidence !== null && entrega.confidence !== undefined && ` · confianza ${Math.round(entrega.confidence * 100)} %`}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground/90">
          Nota (0,0 a {nota(maximo)})
          <input
            name="finalGrade"
            inputMode="decimal"
            defaultValue={propuesta === null || propuesta === undefined ? "" : nota(propuesta)}
            required
            pattern="\d([.,]\d)?"
            className="campo w-28 font-normal"
          />
        </label>
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm font-medium text-foreground/90">
          Comentario para el estudiante (opcional)
          <input name="teacherComment" defaultValue={entrega.teacherComment ?? ""} className="campo font-normal" />
        </label>
        <button type="submit" disabled={cargando !== null} className="btn-primario">
          {cargando === "guardar" ? "Guardando..." : entrega.status === "GRADED" ? "Ajustar nota" : "Confirmar nota"}
        </button>
        <button type="button" disabled={cargando !== null} onClick={recalificar} className="btn-secundario" title="Útil si corrigió los casos de prueba o configuró la IA">
          {cargando === "recalificar" ? "Calificando..." : "Volver a calificar"}
        </button>
      </div>
      <Aviso>{error}</Aviso>
    </form>
  );
}
