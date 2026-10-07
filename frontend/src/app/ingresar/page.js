export const metadata = { title: "Ingresar · LogiCode" };

// Ingreso con cédula y contraseña (RF-03). El formulario se conecta a la API en la fase 2.
export default function Ingresar() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Ingresar</h1>
      <form className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Cédula
          <input name="cedula" inputMode="numeric" autoComplete="username" className="rounded-md border border-black/20 px-3 py-2 dark:border-white/25 bg-transparent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input name="password" type="password" autoComplete="current-password" className="rounded-md border border-black/20 px-3 py-2 dark:border-white/25 bg-transparent" />
        </label>
        <button type="button" disabled className="rounded-md bg-foreground px-3 py-2 text-background opacity-60">
          Ingresar (disponible en la fase 2)
        </button>
      </form>
    </div>
  );
}
