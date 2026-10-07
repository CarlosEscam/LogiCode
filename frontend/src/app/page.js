import Link from "next/link";
import { CuadroHerramienta, DESCRIPCION_HERRAMIENTA } from "@/components/Herramienta";

const herramientas = [
  ["PSEINT", "PSeInt"],
  ["DFD", "DFD"],
  ["SCRATCH", "Scratch"],
  ["ARDUINO", "Arduino"],
];

const secciones = [
  { titulo: "Biblioteca", texto: "Guías, ejemplos y videos abiertos para cualquier visitante.", href: "/biblioteca", emoji: "📚" },
  { titulo: "Foro", texto: "Pregunta, responde y aprende con tus compañeros.", href: "/foro", emoji: "💬" },
  { titulo: "Tu curso", texto: "Temas, material de clase, actividades y juegos.", href: "/panel", emoji: "🎯" },
];

// Página de inicio del visitante (RF-19). Misión y visión son texto provisional.
export default function Inicio() {
  return (
    <div className="flex flex-col gap-16">
      <section className="aparecer relative overflow-hidden rounded-3xl border border-borde bg-superficie/60 px-6 py-14 sm:px-12 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(148_163_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(148_163_255/0.07)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-marca/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-marca-2/20 blur-3xl" />

        <div className="relative flex max-w-3xl flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-marca/40 bg-marca/10 px-3 py-1 text-xs font-semibold text-violet-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-marca-2" />
            Primer semestre · Universidad de Pamplona
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Aprende a pensar como <span className="texto-gradiente">programador</span>
          </h1>
          <p className="max-w-2xl text-lg text-foreground/75">
            Material de estudio, actividades y juegos para aprender a resolver
            problemas con algoritmos en primer semestre.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/biblioteca" className="btn-primario px-5 py-2.5 text-base">
              Explorar la biblioteca
            </Link>
            <Link href="/registro" className="btn-secundario px-5 py-2.5 text-base">
              Crear cuenta
            </Link>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Las herramientas del curso</h2>
          <p className="text-foreground/65">Cuatro formas de llevar una idea a un algoritmo.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {herramientas.map(([valor, nombre], i) => (
            <li key={valor} className="aparecer" style={{ animationDelay: `${i * 70}ms` }}>
              <div className={`tono-${valor} tarjeta-viva relative flex h-full flex-col gap-4 overflow-hidden p-5`}>
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-tono" />
                <CuadroHerramienta herramienta={valor} grande />
                <div>
                  <h3 className="text-lg font-semibold text-tono">{nombre}</h3>
                  <p className="text-sm text-foreground/70">{DESCRIPCION_HERRAMIENTA[valor]}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {secciones.map((s) => (
          <Link key={s.href} href={s.href} className="tarjeta-viva group flex flex-col gap-2 p-5">
            <span className="text-3xl" aria-hidden="true">{s.emoji}</span>
            <h3 className="text-lg font-semibold">
              {s.titulo} <span className="inline-block text-marca-2 transition group-hover:translate-x-1">→</span>
            </h3>
            <p className="text-sm text-foreground/70">{s.texto}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="tarjeta p-6">
          <h2 className="text-xl font-semibold text-violet-300">Misión</h2>
          <p className="mt-1 text-foreground/70">Pendiente de redactar.</p>
        </div>
        <div className="tarjeta p-6">
          <h2 className="text-xl font-semibold text-cyan-300">Visión</h2>
          <p className="mt-1 text-foreground/70">Pendiente de redactar.</p>
        </div>
      </section>
    </div>
  );
}
