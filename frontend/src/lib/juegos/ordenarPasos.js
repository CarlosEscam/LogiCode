// Banco del juego "Ordena los pasos". Los pasos van en el orden correcto; el juego los revuelve.
// Solo hay algoritmos donde el orden es único (si dos pasos se pueden cambiar, no se incluyen ambos).

export const PROBLEMAS = [
  {
    titulo: "Calcular el promedio de tres notas",
    herramienta: "PSEINT",
    pasos: [
      "Leer las tres notas",
      "Sumar las tres notas",
      "Dividir la suma entre 3",
      "Escribir el promedio",
    ],
  },
  {
    titulo: "Intercambiar el valor de dos variables a y b",
    herramienta: "PSEINT",
    pasos: [
      "aux <- a",
      "a <- b",
      "b <- aux",
      "Escribir a y b",
    ],
  },
  {
    titulo: "Saber si un número es par o impar",
    herramienta: "PSEINT",
    pasos: [
      "Leer el número n",
      "Calcular el residuo: n MOD 2",
      "Si el residuo es 0, escribir \"Par\"",
      "Si no, escribir \"Impar\"",
    ],
  },
  {
    titulo: "Sumar los números del 1 al N (suma ya empieza en 0)",
    herramienta: "PSEINT",
    pasos: [
      "Leer N",
      "Para i desde 1 hasta N",
      "suma <- suma + i",
      "FinPara",
      "Escribir suma",
    ],
  },
  {
    titulo: "Pedir una contraseña hasta que sea correcta",
    herramienta: "PSEINT",
    pasos: [
      "Repetir",
      "Escribir \"Ingrese la contraseña\"",
      "Leer clave",
      "Hasta Que clave sea igual a la correcta",
      "Escribir \"Bienvenido\"",
    ],
  },
  {
    titulo: "Diagrama de flujo para el mayor de dos números",
    herramienta: "DFD",
    pasos: [
      "Inicio",
      "Leer a, b",
      "Decisión: ¿a > b?",
      "Sí: mostrar a / No: mostrar b",
      "Fin",
    ],
  },
  {
    titulo: "Calcular el área de un círculo",
    herramienta: "DFD",
    pasos: [
      "Inicio",
      "Leer el radio r",
      "area <- 3.1416 * r * r",
      "Mostrar area",
      "Fin",
    ],
  },
  {
    titulo: "Mover un personaje en Scratch al presionar la flecha",
    herramienta: "SCRATCH",
    pasos: [
      "Al hacer clic en la bandera verde",
      "Ir a la posición x: 0, y: 0",
      "Por siempre",
      "Si la tecla flecha derecha está presionada",
      "Mover 10 pasos",
    ],
  },
  {
    titulo: "Hacer parpadear un LED con Arduino",
    herramienta: "ARDUINO",
    pasos: [
      "En setup: configurar el pin 13 como salida",
      "En loop: encender el LED (HIGH)",
      "Esperar 1 segundo",
      "Apagar el LED (LOW)",
      "Esperar 1 segundo",
    ],
  },
  {
    titulo: "Buscar el mayor de una lista de 10 números",
    herramienta: "PSEINT",
    pasos: [
      "Leer el primer número y guardarlo en mayor",
      "Para i desde 2 hasta 10",
      "Leer el número x",
      "Si x > mayor, entonces mayor <- x",
      "FinPara",
      "Escribir mayor",
    ],
  },
];
