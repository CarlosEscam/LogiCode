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
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Mis cursos</h2>
        <Aviso>{error}</Aviso>
        {cursos?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cursos.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setElegido(c.id)}
                className={`rounded-md border px-3 py-1.5 text-sm ${c.id === elegido ? "border-foreground font-semibold" : "border-black/20 dark:border-white/25"}`}
              >
                {c.name} ({c.period}) · {c._count.roster} cédulas
              </button>
            ))}
          </div>
        )}
        {cursos?.length === 0 && <p className="text-sm opacity-70">Cree su curso para empezar a cargar las cédulas.</p>}
        <details open={cursos?.length === 0} className="text-sm">
          <summary className="cursor-pointer">{cursos?.length ? "Crear otro curso" : "Crear curso"}</summary>
          <form onSubmit={crearCurso} className="mt-3 flex flex-wrap items-end gap-3">
            <Campo etiqueta="Nombre del curso" name="name" defaultValue="Pensamiento Computacional" required />
            <Campo etiqueta="Periodo" name="period" placeholder="2026-2" pattern="\d{4}-[12]" required />
            <Boton type="submit">Crear curso</Boton>
          </form>
        </details>
      </section>

      {elegido && (
        <Link href={`/curso/${elegido}`} className="self-start rounded-md bg-foreground px-3 py-2 text-background">
          Temas y material del curso
        </Link>
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
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Cédulas habilitadas</h2>
      <form onSubmit={cargar} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Pegue una cédula por línea. Puede copiar las columnas Cédula y Nombre directamente desde Excel.
          <textarea
            name="text"
            rows={6}
            required
            placeholder={"1094123456\tAna Pérez\n1094555666\tLuis Gómez"}
            className="rounded-md border border-black/20 bg-transparent px-3 py-2 font-mono text-sm dark:border-white/25"
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
          <p className="text-sm opacity-70">
            {lista.length} cédulas en la lista, {registrados} ya crearon su cuenta.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/15 dark:border-white/20">
                <tr>
                  <th className="py-2 pr-3">Cédula</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Cuenta</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className="border-b border-black/5 dark:border-white/10">
                    <td className="py-2 pr-3 font-mono">{r.cedula}</td>
                    <td className="py-2 pr-3">{r.fullName ?? "—"}</td>
                    <td className="py-2 pr-3">{r.registered ? "Registrada" : "Sin registrar"}</td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => quitar(r)} className="text-red-600 hover:underline dark:text-red-400">
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
