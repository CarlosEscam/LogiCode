import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoster } from '../src/lib/roster.js';

test('lee cédulas con y sin nombre, separadas como en Excel o CSV', () => {
  const { entries, invalid } = parseRoster(
    'Cédula\tNombre\n1.094.123.456\tAna Pérez\n1094555666;Luis Gómez\n  1094777888  \n\n1094555666,Repetido'
  );
  assert.deepEqual(entries, [
    { cedula: '1094123456', fullName: 'Ana Pérez' },
    { cedula: '1094555666', fullName: 'Repetido' },
    { cedula: '1094777888', fullName: null },
  ]);
  assert.deepEqual(invalid, []);
});

test('devuelve las líneas que no tienen una cédula válida', () => {
  const { entries, invalid } = parseRoster('12345678\nabc,Juan\n123');
  assert.equal(entries.length, 1);
  assert.deepEqual(invalid, ['abc,Juan', '123']);
});
