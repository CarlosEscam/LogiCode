// Textos y enlaces comunes del apartado del estudiante.

export const NOMBRE_ACTIVIDAD = { TASK: "Tarea", WORKSHOP: "Taller", EVALUATION: "Evaluación", QUIZ: "Quiz" };

export const ESTADO_ACTIVIDAD = {
  PENDIENTE: { nombre: "Por entregar", clase: "bg-amber-500/15 text-amber-300" },
  EN_REVISION: { nombre: "Entregada, en revisión", clase: "bg-sky-500/15 text-sky-300" },
  CALIFICADA: { nombre: "Calificada", clase: "bg-emerald-500/15 text-emerald-300" },
  NO_ENTREGO: { nombre: "No entregada", clase: "bg-rose-500/15 text-rose-300" },
};

export const ESTADO_QUIZ_ESTUDIANTE = {
  PROXIMO: { nombre: "Próximamente", clase: "bg-sky-500/15 text-sky-300" },
  PENDIENTE: { nombre: "Por presentar", clase: "bg-amber-500/15 text-amber-300" },
  EN_CURSO: { nombre: "En curso", clase: "bg-violet-500/15 text-violet-300" },
  PRESENTADO: { nombre: "Presentado", clase: "bg-emerald-500/15 text-emerald-300" },
  NO_PRESENTADO: { nombre: "No presentado", clase: "bg-rose-500/15 text-rose-300" },
};

// Página de una actividad para entregarla y ver su nota.
export function rutaActividad(courseId, activityId) {
  return `/curso/${courseId}/actividades/${activityId}`;
}

// Enlace de un pendiente: la actividad, el quiz o el intento que quedó abierto.
export function rutaPendiente(p) {
  if (p.kind === "QUIZ") return p.attemptId ? `/quiz/${p.attemptId}` : `/curso/${p.course.id}/quizzes/${p.id}`;
  return rutaActividad(p.course.id, p.id);
}

// "vence en 3 días", "vence en 5 horas", "venció"... urgente = menos de un día.
export function plazo(fecha, ahora = Date.now()) {
  const ms = new Date(fecha).getTime() - ahora;
  if (ms <= 0) return { texto: "venció", urgente: true };
  const horas = ms / 3_600_000;
  if (horas < 1) return { texto: `vence en ${Math.max(1, Math.round(ms / 60_000))} min`, urgente: true };
  if (horas < 24) return { texto: `vence en ${Math.round(horas)} h`, urgente: true };
  const dias = Math.round(horas / 24);
  return { texto: dias === 1 ? "vence mañana" : `vence en ${dias} días`, urgente: false };
}

export function fechaCorta(valor) {
  return new Date(valor).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function segundosATexto(s) {
  if (s === null || s === undefined) return "";
  const m = Math.floor(s / 60);
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}
