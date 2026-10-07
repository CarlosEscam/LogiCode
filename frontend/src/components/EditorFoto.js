"use client";

import { useEffect, useRef, useState } from "react";
import { actualizarUsuario, api } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import Avatar from "@/components/Avatar";

const VISOR = 240; // tamaño del recuadro en pantalla
const SALIDA = 320; // tamaño de la foto que se guarda
const MAX_ZOOM = 4;

// Encuadre de la imagen en el visor: x, y = esquina superior izquierda; escala en px por px.
function encuadreInicial(img) {
  const escala = Math.max(VISOR / img.naturalWidth, VISOR / img.naturalHeight);
  return {
    escalaBase: escala,
    zoom: 1,
    x: (VISOR - img.naturalWidth * escala) / 2,
    y: (VISOR - img.naturalHeight * escala) / 2,
  };
}

// La imagen siempre cubre todo el recuadro: no se puede arrastrar más allá del borde.
function ajustar(img, e) {
  const ancho = img.naturalWidth * e.escalaBase * e.zoom;
  const alto = img.naturalHeight * e.escalaBase * e.zoom;
  return {
    ...e,
    x: Math.min(0, Math.max(VISOR - ancho, e.x)),
    y: Math.min(0, Math.max(VISOR - alto, e.y)),
  };
}

// Foto de perfil: elegir o tomar una foto, encuadrarla (mover y acercar) y guardarla, o quitarla.
// La web recorta y reduce la foto antes de enviarla, así pesa poco.
export default function EditorFoto({ usuario }) {
  const [imagen, setImagen] = useState(null); // { img, url }
  const [encuadre, setEncuadre] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const arrastre = useRef(null);
  const elegir = useRef(null);
  const camara = useRef(null);

  useEffect(() => () => imagen && URL.revokeObjectURL(imagen.url), [imagen]);

  function abrir(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    setAviso("");
    if (!archivo.type.startsWith("image/")) {
      setError("Elija una imagen (JPG, PNG o WebP).");
      return;
    }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      setImagen({ img, url });
      setEncuadre(encuadreInicial(img));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("No se pudo abrir esa imagen. Pruebe con una foto JPG o PNG.");
    };
    img.src = url;
  }

  function mover(dx, dy) {
    setEncuadre((e) => ajustar(imagen.img, { ...e, x: e.x + dx, y: e.y + dy }));
  }

  // Al acercar o alejar, el centro del recuadro se queda en el mismo punto de la foto.
  function acercar(zoom) {
    setEncuadre((e) => {
      const factor = zoom / e.zoom;
      const c = VISOR / 2;
      return ajustar(imagen.img, { ...e, zoom, x: c - (c - e.x) * factor, y: c - (c - e.y) * factor });
    });
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      const lienzo = document.createElement("canvas");
      lienzo.width = SALIDA;
      lienzo.height = SALIDA;
      const ctx = lienzo.getContext("2d");
      const escala = encuadre.escalaBase * encuadre.zoom;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, SALIDA, SALIDA);
      ctx.drawImage(imagen.img, -encuadre.x / escala, -encuadre.y / escala, VISOR / escala, VISOR / escala, 0, 0, SALIDA, SALIDA);
      const blob = await new Promise((r) => lienzo.toBlob(r, "image/jpeg", 0.88));
      const datos = new FormData();
      datos.append("avatar", blob, "foto.jpg");
      const { user } = await api("/me/avatar", { method: "PUT", body: datos });
      actualizarUsuario(user);
      setImagen(null);
      setEncuadre(null);
      setAviso("Foto actualizada.");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    if (!window.confirm("¿Quitar su foto de perfil?")) return;
    setError("");
    try {
      const { user } = await api("/me/avatar", { method: "DELETE" });
      actualizarUsuario(user);
      setAviso("Foto quitada.");
    } catch (e) {
      setError(e.message);
    }
  }

  const entradas = (
    <>
      <input ref={elegir} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={abrir} />
      <input ref={camara} type="file" accept="image/*" capture="user" className="hidden" onChange={abrir} />
    </>
  );

  if (imagen && encuadre) {
    const escala = encuadre.escalaBase * encuadre.zoom;
    return (
      <div className="flex flex-col items-center gap-4">
        {entradas}
        <p className="text-sm text-foreground/70">Arrastre la foto para encuadrarla y use la barra para acercarla.</p>
        <div
          role="img"
          aria-label="Vista previa de la foto. Use las flechas del teclado para moverla."
          tabIndex={0}
          className="relative cursor-grab touch-none select-none overflow-hidden rounded-3xl border border-borde bg-black/40 outline-none focus-visible:ring-2 focus-visible:ring-marca active:cursor-grabbing"
          style={{ width: VISOR, height: VISOR }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            arrastre.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (!arrastre.current) return;
            mover(e.clientX - arrastre.current.x, e.clientY - arrastre.current.y);
            arrastre.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => (arrastre.current = null)}
          onPointerCancel={() => (arrastre.current = null)}
          onKeyDown={(e) => {
            const pasos = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
            if (pasos[e.key]) {
              e.preventDefault();
              mover(...pasos[e.key]);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen local que aún no se ha subido */}
          <img
            src={imagen.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{ left: encuadre.x, top: encuadre.y, width: imagen.img.naturalWidth * escala, height: imagen.img.naturalHeight * escala }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(11_15_30/0.55)]" />
        </div>
        <label className="flex w-full max-w-60 items-center gap-3 text-sm text-foreground/70">
          <span aria-hidden="true">−</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={encuadre.zoom}
            onChange={(e) => acercar(Number(e.target.value))}
            aria-label="Acercar la foto"
            className="flex-1 accent-violet-500"
          />
          <span aria-hidden="true">+</span>
        </label>
        <Aviso>{error}</Aviso>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primario" disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando..." : "Guardar foto"}
          </button>
          <button type="button" className="btn-secundario" disabled={guardando} onClick={() => elegir.current.click()}>
            Elegir otra
          </button>
          <button type="button" className="accion" disabled={guardando} onClick={() => { setImagen(null); setEncuadre(null); }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      {entradas}
      <Avatar persona={usuario} tamano="xl" />
      <div className="flex flex-col items-center gap-3 sm:items-start">
        <p className="text-sm text-foreground/70">
          {usuario.avatarUrl ? "Su foto se ve en su panel y en el foro." : "Agregue una foto para que sus compañeros y su docente lo reconozcan en el foro."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primario" onClick={() => elegir.current.click()}>
            {usuario.avatarUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          <button type="button" className="btn-secundario sm:hidden" onClick={() => camara.current.click()}>
            Tomar foto
          </button>
          {usuario.avatarUrl && (
            <button type="button" className="accion-peligro" onClick={quitar}>
              Quitar foto
            </button>
          )}
        </div>
        <Aviso tipo="ok">{aviso}</Aviso>
        <Aviso>{error}</Aviso>
      </div>
    </div>
  );
}
