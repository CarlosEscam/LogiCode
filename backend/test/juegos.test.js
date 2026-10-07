import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar } from '../src/lib/pseint/index.js';
import { ALGORITMOS } from '../../frontend/src/lib/juegos/adivinaSalida.mjs';

// El juego "Adivina la salida" trae la respuesta escrita a mano: aquí se comprueba
// con el intérprete que cada algoritmo muestra exactamente eso.
test('cada algoritmo del juego Adivina la salida muestra la respuesta marcada', () => {
  assert.ok(ALGORITMOS.length >= 10);
  for (const a of ALGORITMOS) {
    const { salida, error } = ejecutar(a.codigo, '');
    assert.equal(error, null, `${a.tema}: ${error?.mensaje}`);
    assert.equal(salida, a.salida, a.tema);
    assert.equal(new Set(a.opciones).size, 4, `${a.tema}: las 4 opciones deben ser distintas`);
    assert.ok(a.opciones.includes(a.salida), `${a.tema}: la respuesta debe estar entre las opciones`);
  }
});
