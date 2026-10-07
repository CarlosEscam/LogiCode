import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { config } from '../config.js';

// Copias de seguridad de la base de datos (RNF-07).
// Cada copia es un .json.gz con todas las tablas. Se hace una sola al día cuando la API
// está encendida, y el administrador puede hacer una a mano y descargarla.
// Los archivos subidos (carpeta de subidas) no van en la copia: se copian aparte.

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const HORAS_ENTRE_COPIAS = 24;
const COPIAS_GUARDADAS = 14;
const PATRON = /^logicode-\d{8}-\d{6}\.json\.gz$/;

const carpeta = () => config.backupDir;
const delegado = (modelo) => modelo.name[0].toLowerCase() + modelo.name.slice(1);

// Modelos ordenados para que cada tabla se restaure después de las tablas a las que apunta.
function modelosEnOrden() {
  const modelos = Prisma.dmmf.datamodel.models;
  const pendientes = new Map(
    modelos.map((m) => [
      m.name,
      new Set(m.fields.filter((f) => f.relationFromFields?.length && f.type !== m.name).map((f) => f.type)),
    ]),
  );
  const orden = [];
  while (pendientes.size > 0) {
    const listos = [...pendientes].filter(([, deps]) => [...deps].every((d) => !pendientes.has(d)));
    if (listos.length === 0) throw new Error('Las tablas tienen dependencias circulares.');
    for (const [nombre] of listos) {
      orden.push(modelos.find((m) => m.name === nombre));
      pendientes.delete(nombre);
    }
  }
  return orden;
}

function nombreArchivo(fecha) {
  const p = (n) => String(n).padStart(2, '0');
  const dia = `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}`;
  const hora = `${p(fecha.getHours())}${p(fecha.getMinutes())}${p(fecha.getSeconds())}`;
  return `logicode-${dia}-${hora}.json.gz`;
}

// Arma la copia con todas las tablas y la guarda en la carpeta de copias.
export async function hacerCopia() {
  const fecha = new Date();
  const tablas = {};
  for (const modelo of modelosEnOrden()) {
    tablas[modelo.name] = await prisma[delegado(modelo)].findMany();
  }
  const contenido = { app: 'LogiCode', version: 1, createdAt: fecha.toISOString(), tablas };
  await fs.promises.mkdir(carpeta(), { recursive: true });
  const nombre = nombreArchivo(fecha);
  await fs.promises.writeFile(path.join(carpeta(), nombre), await gzip(JSON.stringify(contenido)));
  await borrarViejas();
  return (await listarCopias()).find((c) => c.name === nombre);
}

export async function listarCopias() {
  let nombres;
  try {
    nombres = await fs.promises.readdir(carpeta());
  } catch {
    return [];
  }
  const copias = await Promise.all(
    nombres
      .filter((n) => PATRON.test(n))
      .map(async (name) => {
        const st = await fs.promises.stat(path.join(carpeta(), name));
        return { name, size: st.size, createdAt: st.mtime.toISOString() };
      }),
  );
  return copias.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function borrarViejas() {
  const copias = await listarCopias();
  for (const c of copias.slice(COPIAS_GUARDADAS)) {
    await fs.promises.rm(path.join(carpeta(), c.name), { force: true });
  }
}

// Ruta de una copia por su nombre; null si el nombre no es de una copia (evita salir de la carpeta).
export function rutaCopia(nombre) {
  if (!PATRON.test(String(nombre))) return null;
  const ruta = path.join(carpeta(), nombre);
  return fs.existsSync(ruta) ? ruta : null;
}

// Copia automática: al arrancar y cada hora se revisa si la última tiene más de un día.
export function programarCopias() {
  const revisar = async () => {
    try {
      const [ultima] = await listarCopias();
      const vieja = !ultima || Date.now() - new Date(ultima.createdAt).getTime() > HORAS_ENTRE_COPIAS * 3600_000;
      if (vieja) {
        const copia = await hacerCopia();
        console.log(`[copias] Copia de seguridad guardada: ${copia.name}`);
      }
    } catch (err) {
      console.error('[copias] No se pudo hacer la copia de seguridad:', err);
    }
  };
  setTimeout(revisar, 10_000).unref();
  setInterval(revisar, 3600_000).unref();
}

// Restaura una copia: borra todo lo que hay en la base y carga lo de la copia.
// Se usa desde la consola (npm run restaurar-copia), nunca desde la web.
export async function restaurarCopia(ruta) {
  const contenido = JSON.parse((await gunzip(await fs.promises.readFile(ruta))).toString('utf8'));
  if (contenido.app !== 'LogiCode' || !contenido.tablas) throw new Error('El archivo no es una copia de LogiCode.');

  const modelos = modelosEnOrden();
  const tabla = (m) => `"${m.dbName ?? m.name}"`;
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE ${modelos.map(tabla).join(', ')} RESTART IDENTITY CASCADE`);
      for (const modelo of modelos) {
        const filas = contenido.tablas[modelo.name] ?? [];
        const json = modelo.fields.filter((f) => f.type === 'Json').map((f) => f.name);
        const campos = new Set(modelo.fields.filter((f) => f.kind !== 'object').map((f) => f.name));
        const datos = filas.map((fila) => {
          const limpia = Object.fromEntries(Object.entries(fila).filter(([k]) => campos.has(k)));
          for (const k of json) if (limpia[k] === null) limpia[k] = Prisma.DbNull;
          return limpia;
        });
        for (let i = 0; i < datos.length; i += 1000) {
          await tx[delegado(modelo)].createMany({ data: datos.slice(i, i + 1000) });
        }
        // Los id siguen después del más alto que se restauró.
        const auto = modelo.fields.find((f) => f.default?.name === 'autoincrement');
        if (auto && datos.length > 0) {
          const columna = auto.dbName ?? auto.name;
          await tx.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('${tabla(modelo)}', '${columna}'), (SELECT MAX("${columna}") FROM ${tabla(modelo)}))`,
          );
        }
      }
    },
    { timeout: 10 * 60_000 },
  );
  return Object.fromEntries(modelos.map((m) => [m.name, (contenido.tablas[m.name] ?? []).length]));
}
