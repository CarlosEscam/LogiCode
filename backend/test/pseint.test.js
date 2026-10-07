import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, probarCasos, salidaCumple } from '../src/lib/pseint/index.js';

const correr = (codigo, entrada) => ejecutar(codigo, entrada);

test('pseint: lee, calcula y escribe', () => {
  const r = correr(
    `Algoritmo Suma
       Definir a, b Como Entero
       Escribir "Ingrese dos números:"
       Leer a
       Leer b
       Escribir "La suma es ", a + b
       Escribir "El promedio es ", (a + b) / 2
     FinAlgoritmo`,
    '4\n7',
  );
  assert.equal(r.error, null);
  assert.equal(r.salida, 'Ingrese dos números:\nLa suma es 11\nEl promedio es 5.5');
});

test('pseint: condicionales, ciclos y Según, con palabras sin tildes ni mayúsculas', () => {
  const r = correr(
    `proceso ciclos
       definir i, total como entero;
       total <- 0;
       para i <- 1 hasta 10 con paso 3 hacer
         total <- total + i;
       fin para
       escribir total;
       si total mod 2 = 0 entonces
         escribir "par";
       sino
         escribir "impar";
       finsi
       i = 3
       mientras i > 0 hacer
         escribir sin saltar i, " "
         i <- i - 1
       finmientras
       escribir ""
       repetir
         i <- i + 1
       hasta que i >= 2
       según i hacer
         1: escribir "uno"
         2, 3: escribir "dos o tres"
         de otro modo: escribir "otro"
       finsegún
       para i <- 3 hasta 1 hacer
         escribir sin saltar i
       finpara
       escribir ""
       escribir no (1 > 2) y verdadero, " ", 2 ^ 3, " ", -2 ^ 2, " ", 7 % 3, " ", 1 / 3
     finproceso`,
  );
  assert.equal(r.error, null);
  assert.deepEqual(r.salida.split('\n'), ['22', 'par', '3 2 1 ', 'dos o tres', '321', 'VERDADERO 8 -4 1 0.3333333333']);
});

test('pseint: arreglos, funciones, subprocesos y por referencia', () => {
  const r = correr(
    `Funcion mayor <- Maximo(v, n)
       Definir i Como Entero
       mayor <- v[1]
       Para i <- 2 Hasta n Hacer
         Si v[i] > mayor Entonces
           mayor <- v[i]
         FinSi
       FinPara
     FinFuncion

     SubProceso Duplicar(x Por Referencia)
       x <- x * 2
     FinSubProceso

     Algoritmo Arreglos
       Dimension notas[4], m[2, 2]
       Definir k Como Entero
       Para k <- 1 Hasta 4 Hacer
         Leer notas[k]
       FinPara
       Escribir "Máximo: ", Maximo(notas, 4)
       k <- 5
       Duplicar(k)
       Escribir k
       m[2, 1] <- 9
       Escribir m[2, 1] + 1
       Escribir Longitud("hola"), Mayusculas(" mundo"), " ", Subcadena("algoritmo", 1, 4), " ", trunc(7 / 2), " ", redon(2.5), " ", rc(16)
     FinAlgoritmo`,
    '3.5\n4.8\n2\n4.1',
  );
  assert.equal(r.error, null);
  assert.deepEqual(r.salida.split('\n'), ['Máximo: 4.8', '10', '10', '4 MUNDO algo 3 3 4']);
});

test('pseint: errores con número de línea', () => {
  const sinFin = correr('Algoritmo x\n  Si 1 > 0 Entonces\n    Escribir "hola"\nFinAlgoritmo');
  assert.equal(sinFin.error.tipo, 'sintaxis');
  assert.match(sinFin.error.mensaje, /FinSi/);

  const division = correr('Algoritmo x\n  Escribir "antes"\n  Escribir 5 / 0\nFinAlgoritmo');
  assert.equal(division.error.tipo, 'ejecucion');
  assert.equal(division.error.linea, 3);
  assert.equal(division.salida, 'antes');

  const sinValor = correr('Algoritmo x\n  Escribir total\nFinAlgoritmo');
  assert.match(sinValor.error.mensaje, /"total" no tiene valor/);

  const infinito = correr('Algoritmo x\n  i <- 0\n  Mientras Verdadero Hacer\n    i <- i + 1\n  FinMientras\nFinAlgoritmo');
  assert.match(infinito.error.mensaje, /no terminó a tiempo/);

  const faltaDato = correr('Algoritmo x\n  Leer a\n  Leer b\nFinAlgoritmo', '1');
  assert.match(faltaDato.error.mensaje, /pidió un dato más/);

  const malDato = correr('Algoritmo x\n  Definir n Como Entero\n  Leer n\nFinAlgoritmo', 'hola');
  assert.match(malDato.error.mensaje, /se esperaba un número/);
});

test('pseint: un Mientras dentro de un Repetir no cierra el Repetir', () => {
  const r = correr(`Algoritmo x
    i <- 0
    Repetir
      j <- 0
      Mientras j < 2 Hacer
        j <- j + 1
      FinMientras
      i <- i + j
    Mientras Que i < 6
    Escribir i
  FinAlgoritmo`);
  assert.equal(r.error, null);
  assert.equal(r.salida, '6');
});

test('pseint: comparación de salidas', () => {
  assert.ok(salidaCumple('Ingrese un número:\nLa suma es: 15', '15'));
  assert.ok(!salidaCumple('La suma es 150', '15'));
  assert.ok(salidaCumple('ES PAR', 'es   par'));
  assert.ok(!salidaCumple('No es par', 'Es par'));
  assert.ok(salidaCumple('Número mayor', 'Numero mayor'));
  assert.ok(salidaCumple('Total: 2.50', 'total: 2.5'));
  assert.ok(salidaCumple('a\nb\nc', 'a\nc'));
  assert.ok(!salidaCumple('c\na', 'a\nc'));
});

test('pseint: casos de prueba con peso y algoritmos que no se pueden leer', () => {
  const codigo = `Algoritmo ParImpar
    Leer n
    Si n MOD 2 = 0 Entonces
      Escribir "Es par"
    SiNo
      Escribir "Es impar"
    FinSi
  FinAlgoritmo`;
  const casos = [
    { input: '4', expectedOutput: 'Es par', weight: 1 },
    { input: '7', expectedOutput: 'Es impar', weight: 1 },
    { input: '0', expectedOutput: 'Es impar', weight: 2 },
  ];
  const r = probarCasos(codigo, casos);
  assert.equal(r.sintaxis, null);
  assert.deepEqual(r.resultados.map((x) => x.ok), [true, true, false]);
  assert.equal(r.puntaje, 0.5);

  const roto = probarCasos('Algoritmo x\n  Escribir "hola"', casos);
  assert.ok(roto.sintaxis);
  assert.equal(roto.puntaje, 0);

  const desconocida = probarCasos('Algoritmo x\n  Escribir Factorial(3)\nFinAlgoritmo', casos);
  assert.match(desconocida.sintaxis.mensaje, /Factorial|factorial/);
});
