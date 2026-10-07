// Convierte el texto pegado por el docente (una cédula por línea, opcionalmente
// seguida del nombre, separada por coma, punto y coma o tabulación, como sale de Excel)
// en una lista de cédulas válidas y otra de líneas que no se pudieron leer.
export function parseRoster(text) {
  const validas = new Map();
  const invalidas = [];

  for (const linea of String(text ?? '').split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const [primera, ...resto] = linea.split(/[,;\t]/);
    const cedula = primera.replace(/[\s.]/g, '');
    if (!/^\d{5,15}$/.test(cedula)) {
      // La primera fila de un Excel suele ser el encabezado ("Cédula, Nombre"); se ignora sin error.
      if (validas.size === 0 && invalidas.length === 0 && /c[eé]dula|documento/i.test(primera)) continue;
      invalidas.push(linea.trim());
      continue;
    }
    const fullName = resto.join(' ').trim().replace(/\s+/g, ' ').slice(0, 150) || null;
    validas.set(cedula, { cedula, fullName });
  }

  return { entries: [...validas.values()], invalid: invalidas };
}
