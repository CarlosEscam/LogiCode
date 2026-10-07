import { ErrorPSeInt, normalizar } from './analizador.js';

// Ejecuta el árbol que arma analizador.js. No toca archivos ni red: solo lee la entrada
// que se le da y devuelve lo que el algoritmo escribió. Tiene topes de pasos, tiempo y
// salida para que un ciclo infinito no trabe el servidor.

const LIMITES = { pasos: 2_000_000, milisegundos: 2000, lineas: 5000, profundidad: 200 };

const error = (mensaje, linea) => new ErrorPSeInt(mensaje, linea, 'ejecucion');

// Cómo muestra PSeInt cada valor.
export function formatear(valor) {
  if (typeof valor === 'boolean') return valor ? 'VERDADERO' : 'FALSO';
  if (typeof valor === 'number') {
    if (Number.isInteger(valor)) return String(valor);
    return String(Number(valor.toFixed(10)));
  }
  return String(valor);
}

const VALOR_INICIAL = { entero: 0, real: 0, texto: '', logico: false };

// Un arreglo guarda sus tamaños y las posiciones en una sola lista.
// Las posiciones van de 1 al tamaño, como en PSeInt; también se acepta la 0.
class Arreglo {
  constructor(tamanos, inicial) {
    this.tamanos = tamanos;
    this.datos = new Array(tamanos.reduce((a, n) => a * (n + 1), 1)).fill(inicial);
  }

  posicion(indices, linea) {
    if (indices.length !== this.tamanos.length) {
      throw error(`el arreglo tiene ${this.tamanos.length} dimensión(es) y se usaron ${indices.length}`, linea);
    }
    let pos = 0;
    indices.forEach((i, n) => {
      if (!Number.isInteger(i)) throw error(`la posición ${formatear(i)} no es un número entero`, linea);
      if (i < 0 || i > this.tamanos[n]) throw error(`la posición ${i} está fuera del arreglo (tamaño ${this.tamanos[n]})`, linea);
      pos = pos * (this.tamanos[n] + 1) + i;
    });
    return pos;
  }
}

const FUNCIONES = {
  rc: [1, (x) => (x < 0 ? null : Math.sqrt(x))],
  raiz: [1, (x) => (x < 0 ? null : Math.sqrt(x))],
  abs: [1, Math.abs],
  ln: [1, (x) => (x <= 0 ? null : Math.log(x))],
  exp: [1, Math.exp],
  sen: [1, Math.sin],
  cos: [1, Math.cos],
  tan: [1, Math.tan],
  asen: [1, Math.asin],
  acos: [1, Math.acos],
  atan: [1, Math.atan],
  trunc: [1, Math.trunc],
  redon: [1, (x) => Math.sign(x) * Math.round(Math.abs(x))],
  azar: [1, (n) => Math.floor(Math.random() * n)],
  aleatorio: [2, (a, b) => a + Math.floor(Math.random() * (b - a + 1))],
};

const FUNCIONES_TEXTO = {
  longitud: (s) => String(s).length,
  mayusculas: (s) => String(s).toUpperCase(),
  minusculas: (s) => String(s).toLowerCase(),
  subcadena: (s, desde, hasta) => String(s).slice(desde - 1, hasta),
  concatenar: (a, b) => String(a) + String(b),
  convertiranumero: (s) => {
    const n = Number(String(s).trim().replace(',', '.'));
    return String(s).trim() === '' || Number.isNaN(n) ? null : n;
  },
  convertiratexto: (n) => formatear(n),
};

class Ejecucion {
  constructor(programa, entradas) {
    this.funciones = programa.funciones;
    this.entradas = entradas;
    this.lineas = [];
    this.lineaActual = '';
    this.pasos = 0;
    this.fin = Date.now() + LIMITES.milisegundos;
    this.profundidad = 0;
  }

  paso(linea) {
    this.pasos++;
    if (this.pasos > LIMITES.pasos || (this.pasos % 10000 === 0 && Date.now() > this.fin)) {
      throw error('el algoritmo no terminó a tiempo (¿un ciclo que nunca acaba?)', linea);
    }
  }

  escribir(texto, saltar) {
    this.lineaActual += texto;
    if (saltar) this.cerrarLinea();
  }

  cerrarLinea() {
    this.lineas.push(this.lineaActual);
    this.lineaActual = '';
    if (this.lineas.length > LIMITES.lineas) throw error('el algoritmo escribió demasiadas líneas');
  }

  // Variables: cada llamado a una función tiene las suyas. Cada variable es una celda
  // { valor, tipo } para poder pasarla por referencia.
  celda(ambito, nombre, linea) {
    const c = ambito.get(nombre);
    if (!c) throw error(`la variable "${nombre}" no tiene valor`, linea);
    return c;
  }

  leerVariable(ambito, nodo) {
    const c = this.celda(ambito, nodo.nombre, nodo.linea);
    if (!nodo.indices) {
      if (c.valor === undefined) throw error(`la variable "${nodo.nombre}" no tiene valor`, nodo.linea);
      return c.valor;
    }
    if (!(c.valor instanceof Arreglo)) throw error(`"${nodo.nombre}" no es un arreglo`, nodo.linea);
    const indices = nodo.indices.map((e) => this.numero(this.evaluar(ambito, e), e.linea ?? nodo.linea));
    const v = c.valor.datos[c.valor.posicion(indices, nodo.linea)];
    if (v === undefined) throw error(`la posición [${indices.join(',')}] de "${nodo.nombre}" no tiene valor`, nodo.linea);
    return v;
  }

  asignar(ambito, destino, valor) {
    if (valor instanceof Arreglo) throw error('no se puede asignar un arreglo completo', destino.linea);
    if (!destino.indices) {
      const c = ambito.get(destino.nombre);
      if (c?.valor instanceof Arreglo) throw error(`"${destino.nombre}" es un arreglo; indique la posición`, destino.linea);
      if (c) c.valor = valor;
      else ambito.set(destino.nombre, { valor });
      return;
    }
    const c = this.celda(ambito, destino.nombre, destino.linea);
    if (!(c.valor instanceof Arreglo)) throw error(`"${destino.nombre}" no es un arreglo (falta Dimension)`, destino.linea);
    const indices = destino.indices.map((e) => this.numero(this.evaluar(ambito, e), destino.linea));
    c.valor.datos[c.valor.posicion(indices, destino.linea)] = valor;
  }

  tipoDe(ambito, destino) {
    return ambito.get(destino.nombre)?.tipo;
  }

  numero(v, linea) {
    if (typeof v !== 'number') throw error(`se esperaba un número y se encontró ${typeof v === 'string' ? `el texto "${v}"` : formatear(v)}`, linea);
    return v;
  }

  logico(v, linea) {
    if (typeof v !== 'boolean') throw error(`se esperaba VERDADERO o FALSO y se encontró ${formatear(v)}`, linea);
    return v;
  }

  bloque(ambito, instrucciones) {
    for (const ins of instrucciones) this.instruccion(ambito, ins);
  }

  instruccion(ambito, ins) {
    this.paso(ins.linea);
    switch (ins.k) {
      case 'definir':
        for (const nombre of ins.nombres) {
          const c = ambito.get(nombre);
          if (c?.valor instanceof Arreglo) {
            c.tipo = ins.tipo;
            c.valor.datos = c.valor.datos.map((v) => v ?? VALOR_INICIAL[ins.tipo]);
          } else if (c) {
            c.tipo = ins.tipo;
          } else {
            ambito.set(nombre, { valor: VALOR_INICIAL[ins.tipo], tipo: ins.tipo });
          }
        }
        return;
      case 'dimension':
        for (const { nombre, tamanos } of ins.arreglos) {
          const ns = tamanos.map((e) => this.numero(this.evaluar(ambito, e), ins.linea));
          if (ns.some((n) => !Number.isInteger(n) || n < 1)) throw error(`el tamaño de "${nombre}" debe ser un entero mayor que 0`, ins.linea);
          if (ns.reduce((a, n) => a * (n + 1), 1) > 1_000_000) throw error(`el arreglo "${nombre}" es demasiado grande`, ins.linea);
          const tipo = ambito.get(nombre)?.tipo;
          ambito.set(nombre, { valor: new Arreglo(ns, tipo ? VALOR_INICIAL[tipo] : undefined), tipo });
        }
        return;
      case 'leer':
        for (const destino of ins.destinos) this.leer(ambito, destino, ins.linea);
        return;
      case 'escribir': {
        const texto = ins.valores.map((e) => formatear(this.evaluar(ambito, e))).join('');
        this.escribir(texto, !ins.sinSaltar);
        return;
      }
      case 'asignar':
        this.asignar(ambito, ins.destino, this.convertirAlTipo(this.tipoDe(ambito, ins.destino), this.evaluar(ambito, ins.valor), ins.linea));
        return;
      case 'si':
        if (this.logico(this.evaluar(ambito, ins.condicion), ins.linea)) this.bloque(ambito, ins.entonces);
        else this.bloque(ambito, ins.sino);
        return;
      case 'mientras':
        while (this.logico(this.evaluar(ambito, ins.condicion), ins.linea)) {
          this.paso(ins.linea);
          this.bloque(ambito, ins.cuerpo);
        }
        return;
      case 'repetir':
        for (;;) {
          this.paso(ins.linea);
          this.bloque(ambito, ins.cuerpo);
          const c = this.logico(this.evaluar(ambito, ins.condicion), ins.linea);
          if (ins.repetirMientras ? !c : c) break;
        }
        return;
      case 'para': {
        const desde = this.numero(this.evaluar(ambito, ins.desde), ins.linea);
        const hasta = this.numero(this.evaluar(ambito, ins.hasta), ins.linea);
        const paso = ins.paso ? this.numero(this.evaluar(ambito, ins.paso), ins.linea) : desde <= hasta ? 1 : -1;
        if (paso === 0) throw error('el paso del Para no puede ser 0', ins.linea);
        this.asignar(ambito, ins.variable, desde);
        while (paso > 0 ? this.leerVariable(ambito, ins.variable) <= hasta : this.leerVariable(ambito, ins.variable) >= hasta) {
          this.paso(ins.linea);
          this.bloque(ambito, ins.cuerpo);
          this.asignar(ambito, ins.variable, this.leerVariable(ambito, ins.variable) + paso);
        }
        return;
      }
      case 'segun': {
        const valor = this.evaluar(ambito, ins.valor);
        const caso = ins.casos.find((c) => c.valores.some((e) => this.iguales(valor, this.evaluar(ambito, e))));
        if (caso) this.bloque(ambito, caso.cuerpo);
        else if (ins.otroModo) this.bloque(ambito, ins.otroModo);
        return;
      }
      case 'llamar':
        this.llamar(ambito, ins.nombre, ins.argumentos, ins.linea, false);
        return;
      case 'nada':
        return;
      default:
        throw error('instrucción desconocida', ins.linea);
    }
  }

  // Cada dato que pide Leer sale de una línea de la entrada.
  leer(ambito, destino, linea) {
    if (this.lineaActual) this.cerrarLinea(); // el Enter de quien escribe el dato
    if (!this.entradas.length) throw error('el algoritmo pidió un dato más de los que trae la entrada', linea);
    const crudo = this.entradas.shift();
    const tipo = this.tipoDe(ambito, destino);
    let valor;
    const texto = crudo.trim();
    const comoNumero = Number(texto.replace(',', '.'));
    if (tipo === 'texto') valor = crudo;
    else if (tipo === 'logico') {
      const n = normalizar(texto);
      if (n !== 'verdadero' && n !== 'falso') throw error(`se esperaba VERDADERO o FALSO y se leyó "${crudo}"`, linea);
      valor = n === 'verdadero';
    } else if (tipo === 'entero' || tipo === 'real') {
      if (texto === '' || Number.isNaN(comoNumero)) throw error(`se esperaba un número y se leyó "${crudo}"`, linea);
      if (tipo === 'entero' && !Number.isInteger(comoNumero)) throw error(`se esperaba un número entero y se leyó "${crudo}"`, linea);
      valor = comoNumero;
    } else {
      valor = texto !== '' && !Number.isNaN(comoNumero) ? comoNumero : crudo;
    }
    this.asignar(ambito, destino, valor);
  }

  convertirAlTipo(tipo, valor, linea) {
    if (tipo === 'entero' || tipo === 'real') return this.numero(valor, linea);
    if (tipo === 'logico') return this.logico(valor, linea);
    if (tipo === 'texto' && typeof valor !== 'string') throw error(`se esperaba un texto y se encontró ${formatear(valor)}`, linea);
    return valor;
  }

  iguales(a, b) {
    return typeof a === typeof b && a === b;
  }

  evaluar(ambito, e) {
    switch (e.k) {
      case 'valor':
        return e.valor;
      case 'variable':
        return this.leerVariable(ambito, e);
      case 'negativo':
        return -this.numero(this.evaluar(ambito, e.valor), e.linea);
      case 'no':
        return !this.logico(this.evaluar(ambito, e.valor), e.linea);
      case 'llamada':
        return this.llamar(ambito, e.nombre, e.argumentos, e.linea, true);
      case 'binaria':
        return this.binaria(ambito, e);
      default:
        throw error('expresión desconocida', e.linea);
    }
  }

  binaria(ambito, e) {
    if (e.op === 'y') return this.logico(this.evaluar(ambito, e.izq), e.linea) && this.logico(this.evaluar(ambito, e.der), e.linea);
    if (e.op === 'o') return this.logico(this.evaluar(ambito, e.izq), e.linea) || this.logico(this.evaluar(ambito, e.der), e.linea);
    const a = this.evaluar(ambito, e.izq);
    const b = this.evaluar(ambito, e.der);
    switch (e.op) {
      case '+':
        if (typeof a === 'string' || typeof b === 'string') return formatear(a) + formatear(b);
        return this.numero(a, e.linea) + this.numero(b, e.linea);
      case '-':
        return this.numero(a, e.linea) - this.numero(b, e.linea);
      case '*':
        return this.numero(a, e.linea) * this.numero(b, e.linea);
      case '/':
        if (this.numero(b, e.linea) === 0) throw error('división por cero', e.linea);
        return this.numero(a, e.linea) / b;
      case 'mod':
        if (this.numero(b, e.linea) === 0) throw error('división por cero en MOD', e.linea);
        return this.numero(a, e.linea) % b;
      case '^':
        return this.numero(a, e.linea) ** this.numero(b, e.linea);
      case '=':
        return this.iguales(a, b);
      case '<>':
        return !this.iguales(a, b);
      default: {
        if (typeof a !== typeof b || typeof a === 'boolean') throw error(`no se pueden comparar ${formatear(a)} y ${formatear(b)}`, e.linea);
        if (e.op === '<') return a < b;
        if (e.op === '>') return a > b;
        if (e.op === '<=') return a <= b;
        return a >= b;
      }
    }
  }

  llamar(ambito, nombre, argumentos, linea, esperaValor) {
    if (this.funciones.has(nombre)) return this.llamarPropia(ambito, nombre, argumentos, linea, esperaValor);
    if (FUNCIONES[nombre]) {
      const [cuantos, f] = FUNCIONES[nombre];
      if (argumentos.length !== cuantos) throw error(`${nombre.toUpperCase()} recibe ${cuantos} dato(s)`, linea);
      const r = f(...argumentos.map((a) => this.numero(this.evaluar(ambito, a), linea)));
      if (r === null || Number.isNaN(r)) throw error(`${nombre.toUpperCase()} no está definida para ese valor`, linea);
      return r;
    }
    if (FUNCIONES_TEXTO[nombre]) {
      const f = FUNCIONES_TEXTO[nombre];
      if (argumentos.length !== f.length) throw error(`${nombre.toUpperCase()} recibe ${f.length} dato(s)`, linea);
      const r = f(...argumentos.map((a) => this.evaluar(ambito, a)));
      if (r === null) throw error(`${nombre.toUpperCase()} no pudo convertir el valor`, linea);
      return r;
    }
    if (nombre === 'pi' && !argumentos.length) return Math.PI;
    throw new ErrorPSeInt(`la función "${nombre}" no existe`, linea, 'sintaxis');
  }

  // SubProcesos y Funciones del estudiante.
  llamarPropia(ambito, nombre, argumentos, linea, esperaValor) {
    const f = this.funciones.get(nombre);
    if (argumentos.length !== f.parametros.length) {
      throw error(`"${nombre}" recibe ${f.parametros.length} dato(s) y se le dieron ${argumentos.length}`, linea);
    }
    if (esperaValor && !f.retorno) throw error(`"${nombre}" no devuelve ningún valor`, linea);
    if (++this.profundidad > LIMITES.profundidad) throw error('demasiadas llamadas anidadas (¿recursión sin fin?)', linea);

    const propio = new Map();
    f.parametros.forEach((p, n) => {
      const arg = argumentos[n];
      const celda = arg.k === 'variable' && !arg.indices ? ambito.get(arg.nombre) : null;
      // Los arreglos y los parámetros "Por Referencia" comparten la variable de quien llama.
      if (celda && (p.referencia || celda.valor instanceof Arreglo)) propio.set(p.nombre, celda);
      else if (p.referencia) throw error(`el dato ${n + 1} de "${nombre}" debe ser una variable`, linea);
      else propio.set(p.nombre, { valor: this.evaluar(ambito, arg) });
    });
    this.bloque(propio, f.cuerpo);
    this.profundidad--;
    if (!f.retorno) return undefined;
    const r = propio.get(f.retorno)?.valor;
    if (r === undefined) throw error(`"${nombre}" terminó sin darle valor a "${f.retorno}"`, linea);
    return r;
  }
}

// Ejecuta el programa ya analizado. Devuelve las líneas escritas; si falla, lanza ErrorPSeInt
// con las líneas que alcanzó a escribir en error.salida.
export function correr(programa, entradas) {
  const ejecucion = new Ejecucion(programa, [...entradas]);
  try {
    ejecucion.bloque(new Map(), programa.principal);
  } catch (e) {
    if (ejecucion.lineaActual) ejecucion.lineas.push(ejecucion.lineaActual);
    if (e instanceof ErrorPSeInt) {
      e.salida = ejecucion.lineas;
      throw e;
    }
    if (e instanceof RangeError) {
      const err = error('el algoritmo se llamó a sí mismo demasiadas veces');
      err.salida = ejecucion.lineas;
      throw err;
    }
    throw e;
  }
  if (ejecucion.lineaActual) ejecucion.lineas.push(ejecucion.lineaActual);
  return ejecucion.lineas;
}
