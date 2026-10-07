// Convierte el texto pegado por el docente en una lista de cédulas válidas y otra
// de líneas que no se pudieron leer. Cada línea trae la cédula y, opcionalmente,
// el nombre, separados por espacio, coma, punto y coma o tabulación (como sale de Excel).
// Ejemplos: "1094123456", "1.094.123.456 Ana Pérez", "1094123456;Ana Pérez".
const LINEA = /^\s*([\d.]+)(?:[\s,;]+(.*))?$/;

export function parseRoster(text) {
  const validas = new Map();
  const invalidas = [];

  for (const linea of String(text ?? '').split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const partes = linea.match(LINEA);
    const cedula = partes?.[1].replace(/\./g, '');
    if (!cedula || !/^\d{5,15}$/.test(cedula)) {
      // La primera fila de un Excel suele ser el encabezado ("Cédula, Nombre"); se ignora sin error.
      if (validas.size === 0 && invalidas.length === 0 && /c[eé]dula|documento/i.test(linea)) continue;
      invalidas.push(linea.trim());
      continue;
    }
    const fullName = (partes[2] ?? '').replace(/[,;\t]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, 150) || null;
    validas.set(cedula, { cedula, fullName });
  }

  return { entries: [...validas.values()], invalid: invalidas };
}
