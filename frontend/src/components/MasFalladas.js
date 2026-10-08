import { NOMBRE_TIPO } from "@/lib/quizzes";
import { EtiquetaHerramienta } from "@/components/Herramienta";

// Panel de preguntas más falladas (RF-26): porcentaje de estudiantes que la fallaron.
export default function MasFalladas({ preguntas, vacio = "Todavía no hay respuestas para analizar." }) {
  if (!preguntas) return null;
  if (preguntas.length === 0) return <p className="tarjeta p-5 text-sm text-foreground/65">{vacio}</p>;
  return (
    <ol className="flex flex-col gap-2">
      {preguntas.map((p) => {
        const color = p.failRate >= 60 ? "bg-peligro" : p.failRate >= 30 ? "bg-naranja" : "bg-menta";
        return (
          <li key={p.questionId} className="tarjeta flex flex-col gap-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1">{p.statement}</p>
              <span className="shrink-0 text-right">
                <span className="text-lg font-bold">{p.failRate} %</span>
                <span className="block text-xs text-foreground/60">fallaron {p.failed} de {p.answered}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${p.failRate}%` }} />
            </div>
            <p className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
              {NOMBRE_TIPO[p.type]} <EtiquetaHerramienta herramienta={p.tool} /> {p.topic && <span>· Tema: {p.topic}</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
