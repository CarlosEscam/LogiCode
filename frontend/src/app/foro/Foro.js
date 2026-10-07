"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, HERRAMIENTAS, NOMBRE_HERRAMIENTA, useUsuario } from "@/lib/api";
import { Aviso, Boton, Campo } from "@/components/Formulario";
import { fechaForo, NombreAutor } from "./comun";

// Lista de temas del foro, filtrada por categoría (herramienta) y búsqueda.
// Cualquiera la ve; con sesión aparece el formulario para abrir un tema.
export default function Foro() {
  const usuario = useUsuario();
  const router = useRouter();
  const params = useSearchParams();
  const categoria = params.get("categoria") ?? "";
  const q = params.get("q") ?? "";
  const pagina = Number(params.get("pagina")) || 1;

  const [resumen, setResumen] = useState(null);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    const consulta = new URLSearchParams();
    if (categoria) consulta.set("category", categoria);
    if (q) consulta.set("q", q);
    consulta.set("page", String(pagina));
    Promise.all([api("/forum"), api(`/forum/threads?${consulta}`)])
      .then(([r, l]) => {
        if (!vivo) return;
        setResumen(r.categories);
        setLista(l);
        setError("");
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [categoria, q, pagina, usuario]);

  // Cambia los filtros en la dirección, para que se puedan compartir y el botón Atrás funcione.
  function ir(cambios) {
    const nuevos = new URLSearchParams(params);
    for (const [k, valor] of Object.entries({ pagina: "", ...cambios })) {
      if (valor) nuevos.set(k, valor);
      else nuevos.delete(k);
    }
    const texto = nuevos.toString();
    router.push(texto ? `/foro?${texto}` : "/foro");
  }

  const contar = (c) => resumen?.find((r) => r.category === c);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Foro</h1>
        <p className="opacity-80">
          Preguntas y respuestas sobre PSeInt, DFD, Scratch y Arduino.
          {usuario === null && (
            <>
              {" "}Cualquiera puede leer; para escribir, <Link href="/ingresar" className="underline">ingrese</Link>.
            </>
          )}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {HERRAMIENTAS.map((h) => {
          const datos = contar(h.valor);
          const activa = categoria === h.valor;
          return (
            <li key={h.valor}>
              <button
                type="button"
                onClick={() => ir({ categoria: activa ? "" : h.valor })}
                className={`flex w-full flex-col rounded-lg border p-3 text-left ${activa ? "border-foreground" : "border-black/10 dark:border-white/15"}`}
              >
                <span className="font-semibold">{h.nombre}</span>
                <span className="text-xs opacity-70">
                  {datos ? `${datos.threads} ${datos.threads === 1 ? "tema" : "temas"} · ${datos.posts} ${datos.posts === 1 ? "mensaje" : "mensajes"}` : " "}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ir({ q: new FormData(e.currentTarget).get("q").trim() });
        }}
      >
        <input
          key={q}
          name="q"
          defaultValue={q}
          placeholder="Buscar en el foro"
          aria-label="Buscar en el foro"
          className="flex-1 rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25"
        />
        <Boton type="submit">Buscar</Boton>
      </form>

      {(categoria || q) && (
        <p className="text-sm opacity-80">
          {categoria && <>Categoría: {NOMBRE_HERRAMIENTA[categoria]}. </>}
          {q && <>Búsqueda: “{q}”. </>}
          <button type="button" className="underline" onClick={() => router.push("/foro")}>Ver todo</button>
        </p>
      )}

      <Aviso>{error}</Aviso>
      {lista?.threads.length === 0 && (
        <p className="opacity-70">{q ? "No se encontraron temas con esa búsqueda." : "Todavía no hay temas aquí. ¡Abra el primero!"}</p>
      )}

      {lista?.threads.length > 0 && (
      <ul className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
        {lista?.threads.map((t) => (
          <li key={t.id}>
            <Link href={`/foro/tema/${t.id}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5">
              <span className="flex flex-col">
                <span className="font-medium">
                  {t.isPinned && <span className="mr-2 text-xs text-amber-700 dark:text-amber-300">Fijado</span>}
                  {t.isClosed && <span className="mr-2 text-xs opacity-60">Cerrado</span>}
                  {t.title}
                </span>
                <span className="text-xs opacity-70">
                  {NOMBRE_HERRAMIENTA[t.category]} · <NombreAutor autor={t.author} /> · {fechaForo(t.createdAt)}
                </span>
              </span>
              <span className="text-xs opacity-70">
                {t.replies} {t.replies === 1 ? "respuesta" : "respuestas"} · última actividad {fechaForo(t.lastPostAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      )}

      {lista && lista.pages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <button type="button" disabled={lista.page <= 1} className="hover:underline disabled:opacity-30" onClick={() => ir({ pagina: String(lista.page - 1) })}>
            ← Anteriores
          </button>
          <span>Página {lista.page} de {lista.pages}</span>
          <button type="button" disabled={lista.page >= lista.pages} className="hover:underline disabled:opacity-30" onClick={() => ir({ pagina: String(lista.page + 1) })}>
            Siguientes →
          </button>
        </div>
      )}

      {usuario && <NuevoTema categoria={categoria || "GENERAL"} onCreado={(id) => router.push(`/foro/tema/${id}`)} />}
    </div>
  );
}

function NuevoTema({ categoria, onCreado }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const { thread } = await api("/forum/threads", { method: "POST", body: Object.fromEntries(new FormData(e.currentTarget)) });
      onCreado(thread.id);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/15">
      <h2 className="text-xl font-semibold">Abrir un tema</h2>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <Campo etiqueta="Título" name="title" required minLength={5} maxLength={200} placeholder="Por ejemplo: ¿Cómo uso el ciclo Para en PSeInt?" />
          <label className="flex flex-col gap-1 text-sm">
            Categoría
            <select key={categoria} name="category" defaultValue={categoria} className="rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/25">
              {HERRAMIENTAS.map((h) => (
                <option key={h.valor} value={h.valor}>{h.nombre}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Mensaje
          <textarea name="body" required rows={5} maxLength={10000} className="rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/25" />
        </label>
        <Aviso>{error}</Aviso>
        <div>
          <Boton type="submit" cargando={enviando}>Publicar tema</Boton>
        </div>
      </form>
    </section>
  );
}
