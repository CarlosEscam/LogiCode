// Textos y formatos comunes de los quizzes y el banco de preguntas.

export const TIPOS_PREGUNTA = [
  { valor: "MULTIPLE_CHOICE", nombre: "Selección múltiple", ayuda: "Varias opciones, una correcta." },
  { valor: "TRUE_FALSE", nombre: "Verdadero o falso", ayuda: "Una afirmación que es verdadera o falsa." },
  { valor: "SHORT_ANSWER", nombre: "Respuesta corta", ayuda: "Una palabra o frase; puede aceptar varias formas." },
  { valor: "OUTPUT", nombre: "¿Qué muestra?", ayuda: "Un algoritmo y la salida que produce." },
  { valor: "ORDER_STEPS", nombre: "Ordenar pasos", ayuda: "Pasos de un algoritmo que hay que poner en orden." },
];

export const NOMBRE_TIPO = Object.fromEntries(TIPOS_PREGUNTA.map((t) => [t.valor, t.nombre]));

export const ESTADO_QUIZ = {
  DRAFT: { nombre: "Borrador", clase: "bg-foreground/10 text-foreground/70" },
  UPCOMING: { nombre: "Próximamente", clase: "bg-marca/15 text-enlace" },
  OPEN: { nombre: "Abierto", clase: "bg-exito/15 text-exito" },
  CLOSED: { nombre: "Cerrado", clase: "bg-peligro/15 text-peligro" },
};

// Nota con coma decimal: 3,5
export function nota(valor) {
  if (valor === null || valor === undefined) return "—";
  return Number(valor).toFixed(1).replace(".", ",");
}

export function colorNota(valor) {
  if (valor === null || valor === undefined) return "text-foreground/60";
  return valor >= 3 ? "text-exito" : "text-peligro";
}

export function fechaHora(valor) {
  return new Date(valor).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

// Valor para un <input type="datetime-local"> en la hora del equipo.
export function paraInputFecha(valor) {
  const d = new Date(valor);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function duracion(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

export function reloj(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}
