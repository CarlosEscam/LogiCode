import JSZip from 'jszip';

// Revisión de proyectos de Scratch (.sb3): el archivo es un .zip con project.json, donde
// cada bloque tiene un "opcode". El docente elige qué debe usar el proyecto y aquí se
// comprueba bloque por bloque (RF-12).

export const REVISIONES_SCRATCH = [
  { clave: 'bandera', nombre: 'Empieza al hacer clic en la bandera verde', bloques: ['event_whenflagclicked'] },
  { clave: 'bucle', nombre: 'Usa un ciclo (repetir, por siempre o repetir hasta)', bloques: ['control_repeat', 'control_forever', 'control_repeat_until', 'control_while', 'control_for_each'] },
  { clave: 'condicional', nombre: 'Usa un condicional (si o si / si no)', bloques: ['control_if', 'control_if_else', 'control_wait_until'] },
  { clave: 'variable', nombre: 'Usa variables', bloques: ['data_setvariableto', 'data_changevariableby'] },
  { clave: 'lista', nombre: 'Usa listas', bloques: ['data_addtolist', 'data_deleteoflist', 'data_insertatlist', 'data_replaceitemoflist', 'data_itemoflist'] },
  { clave: 'operadores', nombre: 'Usa operadores matemáticos o de comparación', bloques: ['operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide', 'operator_mod', 'operator_lt', 'operator_gt', 'operator_equals', 'operator_and', 'operator_or', 'operator_not', 'operator_random'] },
  { clave: 'pregunta', nombre: 'Pregunta algo y usa la respuesta', bloques: ['sensing_askandwait'] },
  { clave: 'tecla', nombre: 'Responde a las teclas', bloques: ['event_whenkeypressed', 'sensing_keypressed'] },
  { clave: 'mensajes', nombre: 'Envía y recibe mensajes', bloques: ['event_broadcast', 'event_broadcastandwait'] },
  { clave: 'movimiento', nombre: 'Mueve un objeto', prefijo: 'motion_' },
  { clave: 'dialogo', nombre: 'Un objeto dice o piensa algo', bloques: ['looks_say', 'looks_sayforsecs', 'looks_think', 'looks_thinkforsecs'] },
  { clave: 'sonido', nombre: 'Usa sonidos', prefijo: 'sound_' },
  { clave: 'sensores', nombre: 'Detecta si toca otro objeto o un color', bloques: ['sensing_touchingobject', 'sensing_touchingcolor', 'sensing_coloristouchingcolor'] },
  { clave: 'bloque_propio', nombre: 'Crea un bloque propio', bloques: ['procedures_definition'] },
  { clave: 'clones', nombre: 'Usa clones', bloques: ['control_create_clone_of', 'control_start_as_clone'] },
];

const POR_CLAVE = new Map(REVISIONES_SCRATCH.map((r) => [r.clave, r]));

export const clavesScratchValidas = (claves) => claves.filter((c) => POR_CLAVE.has(c));

// Lee los bloques del proyecto. Lanza Error con un mensaje claro si el archivo no sirve.
export async function bloquesDelProyecto(datos) {
  let zip;
  try {
    zip = await JSZip.loadAsync(datos);
  } catch {
    throw new Error('El archivo no es un proyecto de Scratch (.sb3) válido.');
  }
  const archivo = zip.file('project.json');
  if (!archivo) throw new Error('El proyecto de Scratch no tiene project.json.');
  let proyecto;
  try {
    proyecto = JSON.parse(await archivo.async('string'));
  } catch {
    throw new Error('No se pudo leer el project.json del proyecto de Scratch.');
  }
  const usados = new Map();
  for (const objeto of proyecto.targets ?? []) {
    for (const bloque of Object.values(objeto.blocks ?? {})) {
      if (!bloque || typeof bloque !== 'object' || bloque.shadow || !bloque.opcode) continue;
      usados.set(bloque.opcode, (usados.get(bloque.opcode) ?? 0) + 1);
    }
  }
  return usados;
}

// Revisa la lista del docente. puntaje va de 0 a 1.
export async function revisarScratch(datos, claves) {
  const usados = await bloquesDelProyecto(datos);
  const revisiones = clavesScratchValidas(claves).map((clave) => {
    const r = POR_CLAVE.get(clave);
    const ok = [...usados.keys()].some((op) => (r.prefijo ? op.startsWith(r.prefijo) : r.bloques.includes(op)));
    return { clave, nombre: r.nombre, ok };
  });
  const total = [...usados.values()].reduce((a, n) => a + n, 0);
  const puntaje = revisiones.length ? revisiones.filter((r) => r.ok).length / revisiones.length : null;
  return { revisiones, totalBloques: total, puntaje };
}
