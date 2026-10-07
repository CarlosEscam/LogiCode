// Juegos didácticos de la plataforma (RF-18). La clave es la que guarda la API.
export const JUEGOS = [
  {
    clave: "ADIVINA_SALIDA",
    ruta: "/juegos/adivina-la-salida",
    nombre: "Adivina la salida",
    descripcion: "Lee un algoritmo de PSeInt y elige qué muestra en pantalla.",
    herramienta: "PSEINT",
    emoji: "🔮",
  },
  {
    clave: "MEMORAMA_DFD",
    ruta: "/juegos/memorama-dfd",
    nombre: "Memorama de símbolos",
    descripcion: "Encuentra las parejas: cada símbolo del diagrama de flujo con su nombre.",
    herramienta: "DFD",
    emoji: "🧠",
  },
  {
    clave: "ORDENAR_PASOS",
    ruta: "/juegos/ordena-los-pasos",
    nombre: "Ordena los pasos",
    descripcion: "Pon en orden los pasos de un algoritmo para que funcione.",
    herramienta: "ARDUINO",
    emoji: "🧩",
  },
];
