// Banco del juego "Adivina la salida". Cada algoritmo corre igual en PSeInt y en el
// intérprete de LogiCode; "salida" es exactamente lo que muestra (una línea por Escribir).
// opciones trae distractores con los errores típicos de primer semestre.

export const ALGORITMOS = [
  {
    tema: "Variables",
    codigo: `Algoritmo Intercambio
	a <- 4
	b <- 9
	a <- b
	b <- a
	Escribir a, " ", b
FinAlgoritmo`,
    salida: "9 9",
    opciones: ["9 4", "4 9", "9 9", "4 4"],
    explicacion: "Al hacer a <- b, el 4 se pierde. Después b <- a copia el 9 otra vez. Para intercambiar se necesita una variable auxiliar.",
  },
  {
    tema: "Operadores",
    codigo: `Algoritmo Operaciones
	x <- 7
	z <- 2
	Escribir x MOD z
	Escribir trunc(x / z)
FinAlgoritmo`,
    salida: "1\n3",
    opciones: ["1\n3", "3\n1", "1\n3.5", "0\n3"],
    explicacion: "MOD da el residuo de 7 entre 2 (1) y trunc quita los decimales de 3.5 (3).",
  },
  {
    tema: "Operadores",
    codigo: `Algoritmo Prioridad
	r <- 2 + 3 * 4
	Escribir r
FinAlgoritmo`,
    salida: "14",
    opciones: ["20", "14", "24", "9"],
    explicacion: "La multiplicación va antes que la suma: 3 * 4 = 12 y luego 2 + 12 = 14.",
  },
  {
    tema: "Condicionales",
    codigo: `Algoritmo Mayor
	a <- 15
	b <- 8
	Si a > b Entonces
		Escribir "Gana a"
	SiNo
		Escribir "Gana b"
	FinSi
FinAlgoritmo`,
    salida: "Gana a",
    opciones: ["Gana a", "Gana b", "Gana a\nGana b", "No muestra nada"],
    explicacion: "15 > 8 es verdadero, así que solo se ejecuta la rama Entonces.",
  },
  {
    tema: "Condicionales",
    codigo: `Algoritmo Notas
	nota <- 3
	Si nota >= 3 Entonces
		Escribir "Aprobó"
	FinSi
	Si nota > 3 Entonces
		Escribir "Con buena nota"
	FinSi
FinAlgoritmo`,
    salida: "Aprobó",
    opciones: ["Aprobó", "Aprobó\nCon buena nota", "Con buena nota", "No muestra nada"],
    explicacion: "3 >= 3 es verdadero, pero 3 > 3 es falso: el segundo mensaje no sale.",
  },
  {
    tema: "Condicionales",
    codigo: `Algoritmo Logico
	edad <- 16
	permiso <- Verdadero
	Si edad >= 18 O permiso Entonces
		Escribir "Entra"
	SiNo
		Escribir "No entra"
	FinSi
FinAlgoritmo`,
    salida: "Entra",
    opciones: ["Entra", "No entra", "Entra\nNo entra", "Error"],
    explicacion: "Con O basta que una condición sea verdadera: tiene permiso, entonces entra.",
  },
  {
    tema: "Segun",
    codigo: `Algoritmo Dias
	dia <- 3
	Segun dia Hacer
		1: Escribir "Lunes"
		2: Escribir "Martes"
		3: Escribir "Miércoles"
		De Otro Modo: Escribir "Otro día"
	FinSegun
FinAlgoritmo`,
    salida: "Miércoles",
    opciones: ["Miércoles", "Martes", "Otro día", "Miércoles\nOtro día"],
    explicacion: "Segun salta directo al caso 3 y solo ejecuta ese.",
  },
  {
    tema: "Ciclo Para",
    codigo: `Algoritmo Cuenta
	Para i <- 1 Hasta 4 Hacer
		Escribir i
	FinPara
FinAlgoritmo`,
    salida: "1\n2\n3\n4",
    opciones: ["1\n2\n3\n4", "1\n2\n3", "0\n1\n2\n3", "4"],
    explicacion: "El ciclo Para incluye los dos extremos: va de 1 hasta 4.",
  },
  {
    tema: "Ciclo Para",
    codigo: `Algoritmo Suma
	s <- 0
	Para i <- 1 Hasta 5 Hacer
		s <- s + i
	FinPara
	Escribir s
FinAlgoritmo`,
    salida: "15",
    opciones: ["15", "5", "10", "1\n3\n6\n10\n15"],
    explicacion: "Acumula 1+2+3+4+5 = 15 y escribe una sola vez, al final del ciclo.",
  },
  {
    tema: "Ciclo Para",
    codigo: `Algoritmo Pasos
	Para i <- 10 Hasta 1 Con Paso -3 Hacer
		Escribir i
	FinPara
FinAlgoritmo`,
    salida: "10\n7\n4\n1",
    opciones: ["10\n7\n4\n1", "10\n7\n4", "1\n4\n7\n10", "10\n9\n8\n7"],
    explicacion: "Baja de 3 en 3: 10, 7, 4 y 1. El 1 está dentro del rango, así que se escribe.",
  },
  {
    tema: "Ciclo Mientras",
    codigo: `Algoritmo Mitades
	n <- 20
	Mientras n > 2 Hacer
		n <- n / 2
	FinMientras
	Escribir n
FinAlgoritmo`,
    salida: "1.25",
    opciones: ["2.5", "2", "5", "1.25"],
    explicacion: "20 → 10 → 5 → 2.5 → 1.25. Ojo: 2.5 todavía es mayor que 2, así que da una vuelta más.",
  },
  {
    tema: "Ciclo Mientras",
    codigo: `Algoritmo Contador
	c <- 0
	Mientras c < 3 Hacer
		c <- c + 1
		Escribir "Vuelta ", c
	FinMientras
FinAlgoritmo`,
    salida: "Vuelta 1\nVuelta 2\nVuelta 3",
    opciones: ["Vuelta 1\nVuelta 2\nVuelta 3", "Vuelta 0\nVuelta 1\nVuelta 2", "Vuelta 1\nVuelta 2", "Vuelta 3"],
    explicacion: "Primero suma y después escribe: por eso empieza en 1. Cuando c llega a 3 el ciclo para.",
  },
  {
    tema: "Ciclo Repetir",
    codigo: `Algoritmo AlMenosUnaVez
	x <- 10
	Repetir
		Escribir x
		x <- x + 1
	Hasta Que x > 5
FinAlgoritmo`,
    salida: "10",
    opciones: ["10", "No muestra nada", "10\n11", "6"],
    explicacion: "Repetir revisa la condición al final, así que el cuerpo corre al menos una vez.",
  },
  {
    tema: "Ciclos anidados",
    codigo: `Algoritmo Tabla
	Para i <- 1 Hasta 2 Hacer
		Para j <- 1 Hasta 3 Hacer
			Escribir Sin Saltar "*"
		FinPara
		Escribir ""
	FinPara
FinAlgoritmo`,
    salida: "***\n***",
    opciones: ["***\n***", "**\n**\n**", "******", "*\n*\n*\n*\n*\n*"],
    explicacion: "Por cada una de las 2 filas escribe 3 asteriscos seguidos y luego salta de línea.",
  },
  {
    tema: "Arreglos",
    codigo: `Algoritmo Arreglo
	Dimension v[4]
	Para i <- 1 Hasta 4 Hacer
		v[i] <- i * i
	FinPara
	Escribir v[3]
FinAlgoritmo`,
    salida: "9",
    opciones: ["9", "16", "3", "6"],
    explicacion: "Cada casilla guarda su posición al cuadrado: v[3] = 3 * 3 = 9.",
  },
  {
    tema: "Cadenas",
    codigo: `Algoritmo Texto
	nombre <- "LogiCode"
	Escribir Longitud(nombre)
	Escribir Mayusculas(Subcadena(nombre, 1, 4))
FinAlgoritmo`,
    salida: "8\nLOGI",
    opciones: ["8\nLOGI", "8\nLOGIC", "7\nLOGI", "8\nLogi"],
    explicacion: "LogiCode tiene 8 letras. Subcadena desde la 1 hasta la 4 da \"Logi\", y en mayúsculas \"LOGI\".",
  },
];
