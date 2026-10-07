const herramientas = ["PSeInt", "DFD", "Scratch", "Arduino"];

// Página de inicio del visitante (RF-19). Misión y visión son texto provisional.
export default function Inicio() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Pensamiento Computacional</h1>
        <p className="max-w-2xl text-lg opacity-80">
          Material de estudio, actividades y juegos para aprender a resolver
          problemas con algoritmos en primer semestre.
        </p>
        <ul className="flex flex-wrap gap-2 pt-2">
          {herramientas.map((h) => (
            <li key={h} className="rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/20">
              {h}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Misión</h2>
          <p className="opacity-80">Pendiente de redactar.</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Visión</h2>
          <p className="opacity-80">Pendiente de redactar.</p>
        </div>
      </section>
    </div>
  );
}
