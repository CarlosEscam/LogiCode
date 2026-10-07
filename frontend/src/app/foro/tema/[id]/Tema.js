"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, HERRAMIENTAS, NOMBRE_HERRAMIENTA, useUsuario } from "@/lib/api";
import { Aviso, Boton } from "@/components/Formulario";
import { EtiquetaHerramienta } from "@/components/Herramienta";
import { fechaForo, NombreAutor } from "../../comun";

const areaTexto = "campo";

// Un tema del foro con sus mensajes. El autor corrige lo suyo;
// docentes y administradores fijan, cierran, cambian de categoría y borran.
export default function Tema() {
  const { id } = useParams();
  const usuario = useUsuario();
  const router = useRouter();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (usuario === undefined) return;
    let vivo = true;
    api(`/forum/threads/${id}`)
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        setError("");
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id, usuario, version]);

  async function accion(promesa) {
    setError("");
    try {
      await promesa;
      recargar();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function borrarTema() {
    if (!window.confirm(`¿Borrar el tema "${datos.thread.title}" con todos sus mensajes?`)) return;
    try {
      await api(`/forum/threads/${id}`, { method: "DELETE" });
      router.push("/foro");
    } catch (e) {
      setError(e.message);
    }
  }

  const volver = (
    <Link href={datos ? `/foro?categoria=${datos.thread.category}` : "/foro"} className="self-start text-sm text-foreground/60 transition hover:text-violet-300">
      ← Foro{datos && ` · ${NOMBRE_HERRAMIENTA[datos.thread.category]}`}
    </Link>
  );

  if (!datos) {
    return (
      <div className="flex flex-col gap-3">
        {volver}
        <Aviso>{error}</Aviso>
      </div>
    );
  }

  const { thread, posts, canReply, canModerate, canEditTitle, canDelete } = datos;
  const cambiarTema = (cambios) => accion(api(`/forum/threads/${id}`, { method: "PATCH", body: cambios }));

  return (
    <div className="flex flex-col gap-6">
      <div className="aparecer flex flex-col gap-2">
        {volver}
        <Titulo thread={thread} puedeEditar={canEditTitle} onGuardar={(title) => cambiarTema({ title })} />
        <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-foreground/65">
          <EtiquetaHerramienta herramienta={thread.category} />
          {thread.isPinned && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">📌 Fijado</span>}
          {thread.isClosed && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Cerrado</span>}
          Abierto por <NombreAutor autor={thread.author} /> · {fechaForo(thread.createdAt)}
        </p>
      </div>

      {(canModerate || canDelete) && (
        <div className="tarjeta flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
          {canModerate && (
            <>
              <span className="font-semibold text-violet-300">Moderación:</span>
              <button type="button" className="accion" onClick={() => cambiarTema({ isPinned: !thread.isPinned })}>
                {thread.isPinned ? "Desfijar" : "Fijar arriba"}
              </button>
              <button type="button" className="accion" onClick={() => cambiarTema({ isClosed: !thread.isClosed })}>
                {thread.isClosed ? "Reabrir" : "Cerrar tema"}
              </button>
              <label className="flex items-center gap-1">
                Mover a
                <select
                  value={thread.category}
                  onChange={(e) => cambiarTema({ category: e.target.value })}
                  className="campo px-2 py-1"
                >
                  {HERRAMIENTAS.map((h) => (
                    <option key={h.valor} value={h.valor}>{h.nombre}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {canDelete && (
            <button type="button" className="accion-peligro" onClick={borrarTema}>
              Borrar tema
            </button>
          )}
        </div>
      )}

      <Aviso>{error}</Aviso>

      <ol className="flex flex-col gap-3">
        {posts.map((p, i) => (
          <Mensaje key={p.id} post={p} primero={i === 0} accion={accion} />
        ))}
      </ol>

      {canReply ? (
        <Responder threadId={thread.id} cerrado={thread.isClosed} accion={accion} />
      ) : thread.isClosed ? (
        <p className="tarjeta p-4 text-sm text-foreground/70">Este tema está cerrado y ya no recibe respuestas.</p>
      ) : (
        usuario === null && (
          <p className="tarjeta p-4 text-sm">
            <Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para responder.
          </p>
        )
      )}
    </div>
  );
}

function Titulo({ thread, puedeEditar, onGuardar }) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <h1 className="titulo-pagina">
        {thread.title}
        {puedeEditar && (
          <button type="button" className="accion ml-3 align-middle text-sm font-normal tracking-normal" onClick={() => setEditando(true)}>
            Editar título
          </button>
        )}
      </h1>
    );
  }
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onGuardar(new FormData(e.currentTarget).get("title"))) setEditando(false);
      }}
    >
      <input name="title" defaultValue={thread.title} required minLength={5} maxLength={200} aria-label="Título del tema" className={`flex-1 ${areaTexto}`} />
      <Boton type="submit">Guardar</Boton>
      <button type="button" className="accion" onClick={() => setEditando(false)}>Cancelar</button>
    </form>
  );
}

function Mensaje({ post, primero, accion }) {
  const [editando, setEditando] = useState(false);

  return (
    <li className={`tarjeta flex flex-col gap-3 p-5 ${primero ? "border-marca/40 bg-gradient-to-br from-marca/10 to-superficie/80" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="font-medium"><NombreAutor autor={post.author} /></span>
          <span className="text-foreground/55"> · {fechaForo(post.createdAt)}{post.editedAt && " · editado"}</span>
        </span>
        {!editando && (post.canEdit || post.canDelete) && (
          <span className="flex gap-1">
            {post.canEdit && (
              <button type="button" className="accion" onClick={() => setEditando(true)}>Editar</button>
            )}
            {post.canDelete && (
              <button
                type="button"
                className="accion-peligro"
                onClick={() => window.confirm("¿Borrar este mensaje?") && accion(api(`/forum/posts/${post.id}`, { method: "DELETE" }))}
              >
                Borrar
              </button>
            )}
          </span>
        )}
      </div>

      {post.deleted ? (
        <div className="text-sm italic opacity-60">
          Mensaje eliminado.
          {post.body && <p className="mt-1 whitespace-pre-wrap not-italic line-through">{post.body}</p>}
        </div>
      ) : editando ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = new FormData(e.currentTarget).get("body");
            if (await accion(api(`/forum/posts/${post.id}`, { method: "PATCH", body: { body } }))) setEditando(false);
          }}
        >
          <textarea name="body" defaultValue={post.body} required rows={4} maxLength={10000} aria-label="Mensaje" className={areaTexto} />
          <div className="flex gap-3">
            <Boton type="submit">Guardar</Boton>
            <button type="button" className="accion" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap break-words leading-relaxed text-foreground/90">{post.body}</p>
      )}
    </li>
  );
}

function Responder({ threadId, cerrado, accion }) {
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setEnviando(true);
    const body = new FormData(form).get("body");
    if (await accion(api(`/forum/threads/${threadId}/posts`, { method: "POST", body: { body } }))) form.reset();
    setEnviando(false);
  }

  return (
    <form onSubmit={enviar} className="tarjeta flex flex-col gap-3 p-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
        {cerrado ? "Responder (el tema está cerrado; solo moderadores pueden escribir)" : "Su respuesta"}
        <textarea name="body" required rows={4} maxLength={10000} className={areaTexto} />
      </label>
      <div>
        <Boton type="submit" cargando={enviando}>Responder</Boton>
      </div>
    </form>
  );
}
