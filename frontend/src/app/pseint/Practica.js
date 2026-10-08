"use client";

import { useState } from "react";
import Link from "next/link";
import { useUsuario } from "@/lib/api";
import EditorPseint, { PLANTILLA_PSEINT } from "@/components/actividades/EditorPseint";

// Editor de PSeInt para practicar sin entregar nada (RF-28).
export default function Practica() {
  const usuario = useUsuario();
  const [codigo, setCodigo] = useState(PLANTILLA_PSEINT);

  return (
    <div className="flex flex-col gap-6">
      <div className="aparecer flex flex-col gap-2">
        <h1 className="titulo-pagina">Editor de PSeInt</h1>
        <p className="text-sm text-foreground/65">
          Escriba su algoritmo y pruébelo aquí mismo, sin instalar nada. Es el mismo intérprete con el que se califican las actividades.
        </p>
      </div>
      {usuario === null ? (
        <p className="tarjeta p-6">
          <Link href="/ingresar" className="font-semibold text-enlace underline">Ingrese</Link> para usar el editor.
        </p>
      ) : (
        <div className="tarjeta p-5">
          <EditorPseint codigo={codigo} onCambio={setCodigo} />
        </div>
      )}
    </div>
  );
}
