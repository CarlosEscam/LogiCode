// Piezas comunes de los formularios.

export function Campo({ etiqueta, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {etiqueta}
      <input
        {...props}
        className="rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/25"
      />
    </label>
  );
}

export function Boton({ children, cargando, ...props }) {
  return (
    <button
      {...props}
      disabled={cargando || props.disabled}
      className="rounded-md bg-foreground px-3 py-2 text-background disabled:opacity-60"
    >
      {cargando ? "Un momento..." : children}
    </button>
  );
}

export function Aviso({ tipo = "error", children }) {
  if (!children) return null;
  const color =
    tipo === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
      : "border-green-600/40 bg-green-600/10 text-green-800 dark:text-green-300";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${color}`}>
      {children}
    </p>
  );
}
