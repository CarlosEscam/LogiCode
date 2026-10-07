"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, guardarBlob, pedirArchivo, useUsuario } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import { NOMBRE_TIPO, nota } from "@/components/actividades/comun";

const COLOR_ESTADO = {
  calificada: "",
  en_revision: "text-amber-300",
  no_entrego: "text-rose-300",
  pendiente: "text-foreground/40",
};

// Planilla de notas del curso con la definitiva y la descarga en Excel (RF-14).
export default function Notas() {
  const { id } = useParams();
  const usuario = useUsuario();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/courses/${id}/gradebook`)
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id, usuario]);

  async function descargar() {
    setError("");
    setDescargando(true);
    try {
      const blob = await pedirArchivo(`/courses/${id}/gradebook.xlsx`);
      const { course } = datos;
      guardarBlob(blob, `notas-${course.name}-${course.period}.xlsx`.replace(/[^\w.-]+/g, "-"));
    } catch (e) {
      setError(e.message);
    } finally {
      setDescargando(false);
    }
  }

  if (usuario === null) {
    return (
      <p className="tarjeta p-6">
        <Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para ver las notas.
      </p>
    );
  }
  if (!datos) return <Aviso>{error}</Aviso>;

  const { course, actividades, estudiantes } = datos;
  const ponderada = actividades.length > 0 && actividades.every((a) => a.weight !== null);
  const sumaPesos = actividades.reduce((s, a) => s + (a.weight ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="aparecer flex flex-col gap-2">
        <Link href={`/curso/${id}`} className="self-start text-sm text-foreground/60 transition hover:text-violet-300">← {course.name}</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="titulo-pagina">Notas</h1>
          <button type="button" onClick={descargar} disabled={descargando || !estudiantes.length} className="btn-primario">
            {descargando ? "Preparando..." : "Descargar en Excel"}
          </button>
        </div>
        <p className="text-sm text-foreground/65">
          {ponderada
            ? `La definitiva pondera cada actividad por su porcentaje (suman ${sumaPesos} %) sobre lo ya calificado.`
            : "La definitiva es el promedio de las actividades ya calificadas. Si pone porcentaje a todas, se pondera."}{" "}
          De cada actividad cuenta el mejor intento. Si cerró sin entrega, cuenta 0,0.
        </p>
      </div>
      <Aviso>{error}</Aviso>

      {actividades.length === 0 ? (
        <p className="tarjeta p-6 text-foreground/75">Todavía no hay actividades en este curso.</p>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-borde bg-white/5 text-xs text-foreground/60">
              <tr>
                <th className="sticky left-0 bg-superficie px-4 py-3 uppercase tracking-wide">Estudiante</th>
                {actividades.map((a) => (
                  <th key={a.id} className="min-w-[8rem] px-3 py-3 font-medium">
                    <Link href={`/curso/${id}/actividad/${a.id}`} className="hover:text-violet-300 hover:underline">
                      <span className="block uppercase tracking-wide">{NOMBRE_TIPO[a.type]}{a.weight !== null && ` · ${a.weight} %`}</span>
                      <span className="block normal-case text-foreground/85">{a.title}</span>
                    </Link>
                  </th>
                ))}
                <th className="px-4 py-3 text-right uppercase tracking-wide">Definitiva</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((e) => (
                <tr key={e.cedula} className="border-b border-borde/60 transition last:border-0 hover:bg-white/5">
                  <td className="sticky left-0 bg-superficie px-4 py-2.5">
                    <span className="block font-medium">{e.fullName ?? "(sin nombre)"}</span>
                    <span className="block font-mono text-xs text-foreground/50">{e.cedula}{!e.registrado && " · sin registrarse"}</span>
                  </td>
                  {actividades.map((a) => {
                    const n = e.notas[a.id];
                    return (
                      <td key={a.id} className={`px-3 py-2.5 ${COLOR_ESTADO[n.estado]}`}>
                        {n.estado === "en_revision" ? "En revisión" : n.estado === "pendiente" ? "—" : nota(n.nota)}
                        {n.estado === "calificada" && n.revisionPendiente && <span title="Tiene otro intento por revisar" className="ml-1 text-amber-300">•</span>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right text-base font-bold">{nota(e.definitiva)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {estudiantes.length === 0 && <p className="text-sm text-foreground/65">El curso todavía no tiene estudiantes en la lista.</p>}
      <p className="flex flex-wrap gap-4 text-xs text-foreground/60">
        <span><span className="text-amber-300">En revisión</span>: falta su nota</span>
        <span><span className="text-rose-300">0,0</span>: cerró sin entrega</span>
        <span>—: todavía puede entregar</span>
      </p>
    </div>
  );
}
