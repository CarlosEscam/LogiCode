"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useUsuario } from "@/lib/api";
import FormActividad from "@/components/actividades/FormActividad";

// El docente crea una tarea, taller o evaluación del curso (RF-10).
export default function NuevaActividad() {
  const { id } = useParams();
  const router = useRouter();
  const usuario = useUsuario();

  if (usuario === undefined) return null;
  if (usuario === null) {
    return (
      <p className="tarjeta p-6">
        <Link href="/ingresar" className="font-semibold text-enlace underline">Ingrese</Link> para crear actividades.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="aparecer flex flex-col gap-2">
        <Link href={`/curso/${id}`} className="self-start text-sm text-foreground/60 transition hover:text-enlace">← Volver al curso</Link>
        <h1 className="titulo-pagina">Nueva actividad</h1>
        <p className="text-sm text-foreground/65">
          Los estudiantes la ven desde la fecha en que abre y pueden entregar hasta que cierra. Después solo entregan quienes tengan prórroga.
        </p>
      </div>
      <FormActividad courseId={id} onGuardada={(a) => router.push(`/curso/${id}/actividad/${a.id}`)} />
    </div>
  );
}
