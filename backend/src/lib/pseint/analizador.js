// Analizador de PSeInt: convierte el texto del algoritmo en un árbol que luego ejecuta
// interprete.js. Sigue el perfil "flexible" de PSeInt: palabras clave sin importar
// mayúsculas ni tildes, ";" opcional, asignación con <-, = o :=, y "Fin Si" o "FinSi".

export class ErrorPSeInt extends Error {
  // tipo: 'sintaxis' (el programa no se puede leer) o 'ejecucion' (falló al correr).
  constructor(mensaje, linea, tipo = 'ejecucion') {
    super(linea ? `Línea ${linea}: ${mensaje}` : mensaje);
    this.linea = linea;
    this.tipo = tipo;
  }
}

const sintaxis = (mensaje, linea) => new ErrorPSeInt(mensaje, linea, 'sintaxis');

// Pasa a minúsculas y quita tildes, para comparar palabras clave y nombres.
export function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

// ---------------------------------------------------------------------------
// Análisis léxico
// ---------------------------------------------------------------------------

const OPERADORES = ['<-', ':=', '<=', '>=', '<>', '==', '!=', '&&', '||', '←', '=', '<', '>', '+', '-', '*', '/', '^', '%', '(', ')', '[', ']', ',', ':', '&', '|', '~', '!'];
const SE_UNEN_CON_FIN = new Set(['si', 'mientras', 'para', 'segun', 'algoritmo', 'proceso', 'subproceso', 'funcion']);

function tokenizar(codigo) {
  const tokens = [];
  let i = 0;
  let linea = 1;
  const agregar = (t, v, extra = {}) => tokens.push({ t, v, linea, ...extra });

  while (i < codigo.length) {
    const c = codigo[i];
    if (c === '\n') {
      agregar('fin', '\n');
      linea++;
      i++;
    } else if (c === ';') {
      agregar('fin', ';');
      i++;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === '/' && codigo[i + 1] === '/') {
      while (i < codigo.length && codigo[i] !== '\n') i++;
    } else if (c === '"' || c === "'" || c === '“' || c === '”') {
      const cierre = c === '“' ? '”' : c;
      let j = i + 1;
      while (j < codigo.length && codigo[j] !== cierre && !(cierre === '”' && codigo[j] === '"') && codigo[j] !== '\n') j++;
      if (j >= codigo.length || codigo[j] === '\n') throw sintaxis('falta cerrar las comillas del texto', linea);
      agregar('texto', codigo.slice(i + 1, j));
      i = j + 1;
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(codigo[i + 1] ?? ''))) {
      let j = i;
      while (j < codigo.length && /[0-9]/.test(codigo[j])) j++;
      if (codigo[j] === '.' && /[0-9]/.test(codigo[j + 1] ?? '')) {
        j++;
        while (j < codigo.length && /[0-9]/.test(codigo[j])) j++;
      }
      agregar('numero', Number(codigo.slice(i, j)));
      i = j;
    } else if (/[\p{L}_]/u.test(c)) {
      let j = i;
      while (j < codigo.length && /[\p{L}\p{N}_]/u.test(codigo[j])) j++;
      const palabra = codigo.slice(i, j);
      agregar('nombre', palabra, { k: normalizar(palabra) });
      i = j;
    } else {
      const op = OPERADORES.find((o) => codigo.startsWith(o, i));
      if (!op) throw sintaxis(`no se reconoce el símbolo "${c}"`, linea);
      agregar('op', op === '←' ? '<-' : op);
      i += op.length;
    }
  }
  agregar('fin', '\n');
  tokens.push({ t: 'eof', linea });

  // "Fin Si", "Fin Mientras"... se leen como "FinSi", "FinMientras"...
  const unidos = [];
  for (let n = 0; n < tokens.length; n++) {
    const tk = tokens[n];
    const sig = tokens[n + 1];
    if (tk.t === 'nombre' && tk.k === 'fin' && sig?.t === 'nombre' && SE_UNEN_CON_FIN.has(sig.k)) {
      unidos.push({ ...tk, v: 'Fin' + sig.v, k: 'fin' + sig.k });
      n++;
    } else if (tk.t === 'nombre' && tk.k === 'sin' && sig?.t === 'nombre' && sig.k === 'saltar') {
      unidos.push({ ...tk, v: 'SinSaltar', k: 'sinsaltar' });
      n++;
    } else {
      unidos.push(tk);
    }
  }
  return unidos;
}

// ---------------------------------------------------------------------------
// Análisis sintáctico
// ---------------------------------------------------------------------------

// Palabras que no pueden ser nombres de variables.
const RESERVADAS = new Set([
  'algoritmo', 'finalgoritmo', 'proceso', 'finproceso', 'subproceso', 'finsubproceso', 'funcion', 'finfuncion',
  'definir', 'como', 'dimension', 'dimensionar', 'leer', 'escribir', 'imprimir', 'mostrar', 'sinsaltar',
  'si', 'entonces', 'sino', 'finsi', 'segun', 'finsegun', 'mientras', 'finmientras', 'repetir', 'hasta',
  'para', 'finpara', 'hacer', 'con', 'paso', 'y', 'o', 'no', 'mod', 'verdadero', 'falso',
]);

const COMO_SE_ESCRIBE = {
  finalgoritmo: 'FinAlgoritmo', finfuncion: 'FinFuncion', finsi: 'FinSi', finmientras: 'FinMientras',
  finpara: 'FinPara', hasta: 'Hasta Que',
};

const TODOS_LOS_CIERRES = [
  'finalgoritmo', 'finproceso', 'finsubproceso', 'finfuncion', 'finsi', 'sino', 'finmientras', 'finpara', 'finsegun', 'hasta',
];

const TIPOS = {
  entero: 'entero', real: 'real', numero: 'real', numerico: 'real', caracter: 'texto', texto: 'texto',
  cadena: 'texto', logico: 'logico',
};

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }

  get actual() {
    return this.tokens[this.i];
  }

  avanzar() {
    return this.tokens[this.i++];
  }

  esPalabra(...palabras) {
    const tk = this.actual;
    return tk.t === 'nombre' && palabras.includes(tk.k);
  }

  esOp(...ops) {
    const tk = this.actual;
    return tk.t === 'op' && ops.includes(tk.v);
  }

  saltarFines() {
    while (this.actual.t === 'fin') this.i++;
  }

  esperarPalabra(palabra, contexto) {
    if (!this.esPalabra(palabra)) {
      throw sintaxis(`se esperaba "${palabra}"${contexto ? ' ' + contexto : ''}${this.describir()}`, this.actual.linea);
    }
    return this.avanzar();
  }

  esperarOp(op, contexto) {
    if (!this.esOp(op)) throw sintaxis(`se esperaba "${op}"${contexto ? ' ' + contexto : ''}${this.describir()}`, this.actual.linea);
    return this.avanzar();
  }

  describir() {
    const tk = this.actual;
    if (tk.t === 'eof') return ', pero el algoritmo terminó';
    if (tk.t === 'fin') return ', pero la línea terminó';
    return `, pero se encontró "${tk.v}"`;
  }

  // El final de una instrucción: salto de línea, ";" o fin del texto.
  finInstruccion() {
    if (this.actual.t === 'fin') {
      this.saltarFines();
      return;
    }
    if (this.actual.t !== 'eof') throw sintaxis(`sobra "${this.actual.v}" al final de la instrucción`, this.actual.linea);
  }

  nombre(contexto) {
    const tk = this.actual;
    if (tk.t !== 'nombre' || RESERVADAS.has(tk.k)) {
      throw sintaxis(`se esperaba un nombre ${contexto}${this.describir()}`, tk.linea);
    }
    this.i++;
    return tk.k;
  }

  // Programa: un Algoritmo (o Proceso) y los SubProcesos o Funciones que haya antes o después.
  programa() {
    const funciones = new Map();
    let principal = null;
    this.saltarFines();
    while (this.actual.t !== 'eof') {
      if (this.esPalabra('algoritmo', 'proceso')) {
        const inicio = this.avanzar();
        if (principal) throw sintaxis('hay más de un Algoritmo', inicio.linea);
        if (this.actual.t === 'nombre') this.i++;
        this.finInstruccion();
        const cuerpo = this.bloque(['finalgoritmo', 'finproceso'], `para el ${inicio.v} de la línea ${inicio.linea}`);
        this.avanzar();
        this.finInstruccion();
        principal = cuerpo;
      } else if (this.esPalabra('subproceso', 'funcion')) {
        const f = this.funcion();
        if (funciones.has(f.nombre)) throw sintaxis(`la función "${f.nombre}" está definida dos veces`, f.linea);
        funciones.set(f.nombre, f);
      } else {
        throw sintaxis(`se esperaba "Algoritmo"${this.describir()}`, this.actual.linea);
      }
    }
    if (!principal) throw sintaxis('falta el bloque Algoritmo ... FinAlgoritmo', 1);
    return { principal, funciones };
  }

  // Funcion r <- Nombre(a, b Por Referencia) ... FinFuncion  /  SubProceso Nombre ... FinSubProceso
  funcion() {
    const inicio = this.avanzar();
    let retorno = null;
    let nombre = this.nombre('para la función');
    if (this.esOp('<-', '=', ':=')) {
      this.avanzar();
      retorno = nombre;
      nombre = this.nombre('para la función');
    }
    const parametros = [];
    if (this.esOp('(')) {
      this.avanzar();
      while (!this.esOp(')')) {
        const p = { nombre: this.nombre('para el parámetro'), referencia: false };
        if (this.esPalabra('por')) {
          this.avanzar();
          if (this.esPalabra('referencia')) p.referencia = true;
          else if (!this.esPalabra('valor')) throw sintaxis('después de "Por" va "Valor" o "Referencia"', this.actual.linea);
          this.avanzar();
        }
        parametros.push(p);
        if (!this.esOp(',')) break;
        this.avanzar();
      }
      this.esperarOp(')', 'para cerrar los parámetros');
    }
    this.finInstruccion();
    const cuerpo = this.bloque(['finfuncion', 'finsubproceso'], `para la función de la línea ${inicio.linea}`);
    this.avanzar();
    this.finInstruccion();
    return { nombre, retorno, parametros, cuerpo, linea: inicio.linea };
  }

  // Instrucciones hasta encontrar una de las palabras de cierre (que no se consume).
  bloque(cierres, contexto) {
    const instrucciones = [];
    this.saltarFines();
    while (!this.esCierre(cierres)) {
      if (this.actual.t === 'eof' || this.esPalabra(...TODOS_LOS_CIERRES)) {
        throw sintaxis(`falta "${COMO_SE_ESCRIBE[cierres[0]] ?? cierres[0]}" ${contexto}`, this.actual.linea);
      }
      instrucciones.push(this.instruccion());
    }
    return instrucciones;
  }

  // En un Repetir, "Mientras" solo cierra si sigue "Que"; si no, es un ciclo Mientras adentro.
  esCierre(cierres) {
    if (!this.esPalabra(...cierres)) return false;
    if (this.actual.k === 'mientras' && cierres.includes('hasta')) return this.tokens[this.i + 1]?.k === 'que';
    return true;
  }

  instruccion() {
    const tk = this.actual;
    const linea = tk.linea;
    if (tk.t !== 'nombre') throw sintaxis(`instrucción no válida: "${tk.v}"`, linea);

    switch (tk.k) {
      case 'definir': {
        this.avanzar();
        const nombres = [this.nombre('después de Definir')];
        while (this.esOp(',')) {
          this.avanzar();
          nombres.push(this.nombre('después de la coma'));
        }
        this.esperarPalabra('como', 'después de los nombres');
        const tipoTk = this.avanzar();
        const tipo = TIPOS[tipoTk.k];
        if (!tipo) throw sintaxis(`tipo de dato desconocido "${tipoTk.v ?? ''}"`, linea);
        this.finInstruccion();
        return { k: 'definir', nombres, tipo, linea };
      }
      case 'dimension':
      case 'dimensionar': {
        this.avanzar();
        const arreglos = [];
        do {
          if (this.esOp(',')) this.avanzar();
          const nombre = this.nombre('para el arreglo');
          this.esperarOp('[', 'con el tamaño del arreglo');
          const tamanos = this.listaExpresiones(']');
          this.esperarOp(']', 'para cerrar el tamaño');
          arreglos.push({ nombre, tamanos });
        } while (this.esOp(','));
        this.finInstruccion();
        return { k: 'dimension', arreglos, linea };
      }
      case 'leer': {
        this.avanzar();
        const destinos = [this.destino()];
        while (this.esOp(',')) {
          this.avanzar();
          destinos.push(this.destino());
        }
        this.finInstruccion();
        return { k: 'leer', destinos, linea };
      }
      case 'escribir':
      case 'imprimir':
      case 'mostrar': {
        this.avanzar();
        let sinSaltar = false;
        if (this.esPalabra('sinsaltar')) {
          this.avanzar();
          sinSaltar = true;
        }
        const valores = this.actual.t === 'fin' || this.actual.t === 'eof' ? [] : this.listaExpresiones();
        if (this.esPalabra('sinsaltar')) {
          this.avanzar();
          sinSaltar = true;
        }
        this.finInstruccion();
        return { k: 'escribir', valores, sinSaltar, linea };
      }
      case 'si': {
        this.avanzar();
        const condicion = this.expresion();
        this.saltarFines();
        this.esperarPalabra('entonces', 'después de la condición del Si');
        const entonces = this.bloque(['finsi', 'sino'], `para el Si de la línea ${linea}`);
        let sino = [];
        if (this.esPalabra('sino')) {
          this.avanzar();
          sino = this.bloque(['finsi'], `para el Si de la línea ${linea}`);
        }
        this.avanzar();
        this.finInstruccion();
        return { k: 'si', condicion, entonces, sino, linea };
      }
      case 'mientras': {
        this.avanzar();
        const condicion = this.expresion();
        this.saltarFines();
        this.esperarPalabra('hacer', 'después de la condición del Mientras');
        const cuerpo = this.bloque(['finmientras'], `para el Mientras de la línea ${linea}`);
        this.avanzar();
        this.finInstruccion();
        return { k: 'mientras', condicion, cuerpo, linea };
      }
      case 'repetir': {
        this.avanzar();
        this.finInstruccion();
        const cuerpo = this.bloque(['hasta', 'mientras'], `para el Repetir de la línea ${linea}`);
        const repetirMientras = this.avanzar().k === 'mientras';
        this.esperarPalabra('que', repetirMientras ? 'después de "Mientras"' : 'después de "Hasta"');
        const condicion = this.expresion();
        this.finInstruccion();
        return { k: 'repetir', cuerpo, condicion, repetirMientras, linea };
      }
      case 'para': {
        this.avanzar();
        const variable = this.destino();
        if (!this.esOp('<-', '=', ':=')) throw sintaxis(`se esperaba "<-" después de la variable del Para${this.describir()}`, linea);
        this.avanzar();
        const desde = this.expresion();
        this.esperarPalabra('hasta', 'en el Para');
        const hasta = this.expresion();
        let paso = null;
        if (this.esPalabra('con')) {
          this.avanzar();
          this.esperarPalabra('paso', 'después de "Con"');
          paso = this.expresion();
        }
        this.saltarFines();
        this.esperarPalabra('hacer', 'en el Para');
        const cuerpo = this.bloque(['finpara'], `para el Para de la línea ${linea}`);
        this.avanzar();
        this.finInstruccion();
        return { k: 'para', variable, desde, hasta, paso, cuerpo, linea };
      }
      case 'segun':
        return this.segun();
      case 'limpiar':
      case 'borrar':
        this.avanzar();
        if (this.esPalabra('pantalla')) this.avanzar();
        this.finInstruccion();
        return { k: 'nada', linea };
      case 'esperar':
        this.avanzar();
        while (this.actual.t !== 'fin' && this.actual.t !== 'eof') this.avanzar();
        this.finInstruccion();
        return { k: 'nada', linea };
      default:
        break;
    }

    if (RESERVADAS.has(tk.k)) throw sintaxis(`"${tk.v}" no puede ir aquí`, linea);

    // Asignación o llamado a un SubProceso.
    const destino = this.destino();
    if (this.esOp('<-', '=', ':=')) {
      this.avanzar();
      const valor = this.expresion();
      this.finInstruccion();
      return { k: 'asignar', destino, valor, linea };
    }
    if (destino.indices) throw sintaxis(`se esperaba "<-" para asignar${this.describir()}`, linea);
    let argumentos = [];
    if (this.esOp('(')) {
      this.avanzar();
      argumentos = this.esOp(')') ? [] : this.listaExpresiones(')');
      this.esperarOp(')', 'para cerrar el llamado');
    }
    if (this.actual.t !== 'fin' && this.actual.t !== 'eof') {
      throw sintaxis(`instrucción no válida que empieza con "${tk.v}"`, linea);
    }
    this.finInstruccion();
    return { k: 'llamar', nombre: destino.nombre, argumentos, linea };
  }

  // Segun x Hacer   1: ...   2, 3: ...   De Otro Modo: ...   FinSegun
  segun() {
    const linea = this.avanzar().linea;
    const valor = this.expresion();
    this.saltarFines();
    this.esperarPalabra('hacer', 'después de la variable del Según');
    this.saltarFines();
    const casos = [];
    let otroModo = null;
    while (!this.esPalabra('finsegun')) {
      if (this.actual.t === 'eof') throw sintaxis(`falta "FinSegun" para el Según de la línea ${linea}`, this.actual.linea);
      if (this.esPalabra('de') && this.tokens[this.i + 1]?.k === 'otro') {
        this.i += 2;
        this.esperarPalabra('modo', 'después de "De Otro"');
        this.esperarOp(':', 'después de "De Otro Modo"');
        otroModo = this.cuerpoCaso();
        continue;
      }
      if (this.esPalabra('caso', 'opcion')) this.avanzar();
      const valores = this.listaExpresiones(':');
      this.esperarOp(':', 'después del valor de la opción');
      casos.push({ valores, cuerpo: this.cuerpoCaso() });
    }
    this.avanzar();
    this.finInstruccion();
    return { k: 'segun', valor, casos, otroModo, linea };
  }

  // Las instrucciones de una opción llegan hasta la siguiente opción o el FinSegun.
  cuerpoCaso() {
    const instrucciones = [];
    this.saltarFines();
    while (!this.esPalabra('finsegun') && this.actual.t !== 'eof' && !this.empiezaOpcion()) {
      instrucciones.push(this.instruccion());
    }
    return instrucciones;
  }

  // Una opción es una línea con ":" (fuera de paréntesis), o "De Otro Modo".
  empiezaOpcion() {
    if (this.esPalabra('de') && this.tokens[this.i + 1]?.k === 'otro') return true;
    let nivel = 0;
    for (let j = this.i; j < this.tokens.length; j++) {
      const tk = this.tokens[j];
      if (tk.t === 'fin' || tk.t === 'eof') return false;
      if (tk.t === 'op' && (tk.v === '(' || tk.v === '[')) nivel++;
      if (tk.t === 'op' && (tk.v === ')' || tk.v === ']')) nivel--;
      if (tk.t === 'op' && tk.v === ':' && nivel === 0) return true;
    }
    return false;
  }

  // Variable o posición de un arreglo: a, v[i], m[i, j], m[i][j]
  destino() {
    const linea = this.actual.linea;
    const nombre = this.nombre('de variable');
    let indices = null;
    while (this.esOp('[')) {
      this.avanzar();
      indices = [...(indices ?? []), ...this.listaExpresiones(']')];
      this.esperarOp(']', 'para cerrar la posición');
    }
    return { k: 'variable', nombre, indices, linea };
  }

  listaExpresiones(cierre) {
    const lista = [this.expresion()];
    while (this.esOp(',')) {
      this.avanzar();
      lista.push(this.expresion());
    }
    if (cierre && !this.esOp(cierre) && this.actual.t !== 'fin') {
      throw sintaxis(`se esperaba "${cierre}"${this.describir()}`, this.actual.linea);
    }
    return lista;
  }

  // Precedencia, de menor a mayor: O, Y, NO, comparaciones, + -, * / MOD, signo, ^
  expresion() {
    let izq = this.y();
    while (this.esPalabra('o') || this.esOp('|', '||')) {
      const linea = this.avanzar().linea;
      izq = { k: 'binaria', op: 'o', izq, der: this.y(), linea };
    }
    return izq;
  }

  y() {
    let izq = this.no();
    while (this.esPalabra('y') || this.esOp('&', '&&')) {
      const linea = this.avanzar().linea;
      izq = { k: 'binaria', op: 'y', izq, der: this.no(), linea };
    }
    return izq;
  }

  no() {
    if (this.esPalabra('no') || this.esOp('~', '!')) {
      const linea = this.avanzar().linea;
      return { k: 'no', valor: this.no(), linea };
    }
    return this.comparacion();
  }

  comparacion() {
    let izq = this.suma();
    while (this.esOp('=', '==', '<>', '!=', '<', '>', '<=', '>=')) {
      const tk = this.avanzar();
      const op = { '==': '=', '!=': '<>' }[tk.v] ?? tk.v;
      izq = { k: 'binaria', op, izq, der: this.suma(), linea: tk.linea };
    }
    return izq;
  }

  suma() {
    let izq = this.producto();
    while (this.esOp('+', '-')) {
      const tk = this.avanzar();
      izq = { k: 'binaria', op: tk.v, izq, der: this.producto(), linea: tk.linea };
    }
    return izq;
  }

  producto() {
    let izq = this.signo();
    while (this.esOp('*', '/', '%') || this.esPalabra('mod')) {
      const tk = this.avanzar();
      izq = { k: 'binaria', op: tk.v === '%' || tk.k === 'mod' ? 'mod' : tk.v, izq, der: this.signo(), linea: tk.linea };
    }
    return izq;
  }

  signo() {
    if (this.esOp('-', '+')) {
      const tk = this.avanzar();
      const valor = this.signo();
      return tk.v === '-' ? { k: 'negativo', valor, linea: tk.linea } : valor;
    }
    return this.potencia();
  }

  potencia() {
    const base = this.primario();
    if (this.esOp('^')) {
      const linea = this.avanzar().linea;
      return { k: 'binaria', op: '^', izq: base, der: this.signo(), linea };
    }
    return base;
  }

  primario() {
    const tk = this.actual;
    if (tk.t === 'numero') {
      this.i++;
      return { k: 'valor', valor: tk.v };
    }
    if (tk.t === 'texto') {
      this.i++;
      return { k: 'valor', valor: tk.v };
    }
    if (this.esOp('(')) {
      this.avanzar();
      const e = this.expresion();
      this.esperarOp(')', 'para cerrar el paréntesis');
      return e;
    }
    if (tk.t === 'nombre') {
      if (tk.k === 'verdadero' || tk.k === 'falso') {
        this.i++;
        return { k: 'valor', valor: tk.k === 'verdadero' };
      }
      if (RESERVADAS.has(tk.k)) throw sintaxis(`"${tk.v}" no puede ir dentro de una expresión`, tk.linea);
      this.i++;
      if (this.esOp('(')) {
        this.avanzar();
        const argumentos = this.esOp(')') ? [] : this.listaExpresiones(')');
        this.esperarOp(')', `para cerrar los datos de ${tk.v}`);
        return { k: 'llamada', nombre: tk.k, argumentos, linea: tk.linea };
      }
      let indices = null;
      while (this.esOp('[')) {
        this.avanzar();
        indices = [...(indices ?? []), ...this.listaExpresiones(']')];
        this.esperarOp(']', 'para cerrar la posición');
      }
      return { k: 'variable', nombre: tk.k, indices, linea: tk.linea };
    }
    throw sintaxis(`se esperaba un valor${this.describir()}`, tk.linea);
  }
}

export function analizar(codigo) {
  const tokens = tokenizar(String(codigo ?? '').replace(/\r\n?/g, '\n'));
  return new Parser(tokens).programa();
}
