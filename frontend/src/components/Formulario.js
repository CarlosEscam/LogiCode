// Piezas comunes de los formularios.

export function Campo({ etiqueta, ...props }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground/90">
      {etiqueta}
      <input {...props} className="campo font-normal" />
    </label>
  );
}

export function Boton({ children, cargando, ...props }) {
  return (
    <button {...props} disabled={cargando || props.disabled} className="btn-primario">
      {cargando ? "Un momento..." : children}
    </button>
  );
}

export function Aviso({ tipo = "error", children }) {
  if (!children) return null;
  const color =
    tipo === "error"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${color}`}>
      {children}
    </p>
  );
}

// Encabezado de página con título, subtítulo y un ícono opcional.
export function Encabezado({ titulo, children, icono }) {
  return (
    <div className="aparecer flex items-start gap-4">
      {icono}
      <div className="flex flex-col gap-1">
        <h1 className="titulo-pagina">{titulo}</h1>
        {children && <p className="text-foreground/70">{children}</p>}
      </div>
    </div>
  );
}
