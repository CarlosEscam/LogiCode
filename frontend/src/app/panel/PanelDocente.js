"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";

// El docente crea su curso y carga la lista de cédulas habilitadas (RF-05).
export default function PanelDocente() {
  const [cursos, setCursos] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    api("/courses")
      .then((d) => {
        if (!vivo) return;
        setCursos(d.courses);
        setElegido((actual) => actual ?? d.courses[0]?.id ?? null);
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [version]);

  async function crearCurso(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    try {
      const { course } = await api("/courses", { method: "POST", body: Object.fromEntries(new FormData(form)) });
      form.reset();
      setElegido(course.id);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">Mis cursos</h2>
        <Aviso>{error}</Aviso>
        {cursos?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cursos.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setElegido(c.id)}
                className={`rounded-xl border px-4 py-2 text-sm transition ${c.id === elegido ? "border-marca bg-marca/15 font-semibold text-violet-100 shadow-md shadow-marca/20" : "border-borde bg-white/5 text-foreground/75 hover:border-marca/50"}`}
              >
                {c.name} ({c.period}) · {c._count.roster} cédulas
              </button>
            ))}
          </div>
        )}
        {cursos?.length === 0 && <p className="text-sm text-foreground/65">Cree su curso para empezar a cargar las cédulas.</p>}
        <details open={cursos?.length === 0} className="desplegable">
          <summary>{cursos?.length ? "Crear otro curso" : "Crear curso"}</summary>
          <form onSubmit={crearCurso} className="tarjeta mt-3 flex flex-wrap items-end gap-3 p-5">
            <Campo etiqueta="Nombre del curso" name="name" defaultValue="Pensamiento Computacional" required />
            <Campo etiqueta="Periodo" name="period" placeholder="2026-2" pattern="\d{4}-[12]" required />
            <Boton type="submit">Crear curso</Boton>
          </form>
        </details>
      </section>

      {elegido && (
        <div className="flex flex-wrap gap-3">
          <Link href={`/curso/${elegido}`} className="btn-primario px-5 py-2.5">
            Temas y material del curso →
          </Link>
          <Link href={`/curso/${elegido}/quizzes`} className="btn-secundario px-5 py-2.5">
            Quizzes y banco de preguntas →
          </Link>
        </div>
      )}

      {elegido && <ListaCedulas cursoId={elegido} onCambio={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

function ListaCedulas({ cursoId, onCambio }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState("");
  const [cargando, setCargando] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    api(`/courses/${cursoId}/roster`)
      .then((d) => vivo && setLista(d.roster))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [cursoId, version]);

  function actualizar() {
    setVersion((v) => v + 1);
    onCambio();
  }

  async function cargar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setResultado("");
    setCargando(true);
    try {
      const r = await api(`/courses/${cursoId}/roster`, { method: "POST", body: { text: form.text.value } });
      let texto = `Se agregaron ${r.added} cédulas.`;
      if (r.alreadyListed) texto += ` ${r.alreadyListed} ya estaban en la lista.`;
      if (r.invalid.length) texto += ` No se pudieron leer: ${r.invalid.join(" | ")}`;
      setResultado(texto);
      form.reset();
      actualizar();
    } catch (err) {
      setError(err.message);
    }
    setCargando(false);
  }

  async function quitar(entrada) {
    if (!window.confirm(`¿Quitar la cédula ${entrada.cedula} de la lista?`)) return;
    try {
      await api(`/courses/${cursoId}/roster/${entrada.id}`, { method: "DELETE" });
      actualizar();
    } catch (err) {
      setError(err.message);
    }
  }

  const registrados = lista?.filter((r) => r.registered).length ?? 0;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Cédulas habilitadas</h2>
      <form onSubmit={cargar} className="tarjeta flex flex-col gap-3 p-5">
        <label className="flex flex-col gap-1.5 text-sm text-foreground/80">
          Pegue una cédula por línea. Puede copiar las columnas Cédula y Nombre directamente desde Excel.
          <textarea
            name="text"
            rows={6}
            required
            placeholder={"1094123456\tAna Pérez\n1094555666\tLuis Gómez"}
            className="campo font-mono text-sm"
          />
        </label>
        <div>
          <Boton type="submit" cargando={cargando}>Cargar cédulas</Boton>
        </div>
      </form>
      <Aviso tipo="ok">{resultado}</Aviso>
      <Aviso>{error}</Aviso>

      {lista && (
        <>
          <p className="text-sm text-foreground/65">
            {lista.length} cédulas en la lista, {registrados} ya crearon su cuenta.
          </p>
          <div className="tarjeta overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borde bg-white/5 text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Cuenta</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className="border-b border-borde/60 transition last:border-0 hover:bg-white/5">
                    <td className="px-4 py-2.5 font-mono">{r.cedula}</td>
                    <td className="px-4 py-2.5">{r.fullName ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.registered ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-foreground/60"}`}>
                        {r.registered ? "Registrada" : "Sin registrar"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => quitar(r)} className="accion-peligro">
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
