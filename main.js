// Arranca LogiCode en este computador: base de datos, API y web.
// Uso: "npm start" en esta carpeta, o F5 en VS Code. Ctrl+C lo apaga todo.
// Solo usa módulos de Node, así que funciona antes de instalar dependencias.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const backend = path.join(raiz, 'backend');
const frontend = path.join(raiz, 'frontend');
const windows = process.platform === 'win32';
const API = 'http://localhost:4000';
const WEB = 'http://localhost:3000';

function paso(titulo) {
  console.log(`\n=== ${titulo}`);
}

function salirConError(mensaje) {
  console.error(`\nNo se puede continuar: ${mensaje}`);
  process.exit(1);
}

// En Windows, npm y npx son .cmd y necesitan la consola. Ahí se pasa la línea ya armada
// (pasar la lista de argumentos con shell da un aviso de Node). Ningún argumento lleva espacios.
const linea = (comando, args) => (windows ? [[comando, ...args].join(' '), []] : [comando, args]);

// Corre un comando mostrando su salida; devuelve true si terminó bien.
function correr(comando, args, cwd = raiz) {
  const r = spawnSync(...linea(comando, args), { cwd, stdio: 'inherit', shell: windows });
  return r.status === 0;
}

function salidaDe(comando, args, cwd = raiz) {
  const r = spawnSync(...linea(comando, args), { cwd, encoding: 'utf8', shell: windows });
  return r.status === 0 ? r.stdout.trim() : null;
}

const aleatorio = (bytes) => crypto.randomBytes(bytes).toString('hex');

// Crea un archivo de configuración solo si no existe (nunca pisa el suyo).
function crearSiFalta(ruta, texto) {
  if (fs.existsSync(ruta)) return;
  fs.writeFileSync(ruta, texto);
  console.log(`Creado: ${path.relative(raiz, ruta)}`);
}

function configuracion() {
  paso('Revisando la configuración');
  const rootEnv = path.join(raiz, '.env');
  let clave = aleatorio(24);
  if (fs.existsSync(rootEnv)) {
    const linea = fs.readFileSync(rootEnv, 'utf8').split(/\r?\n/).find((l) => l.startsWith('POSTGRES_PASSWORD='));
    if (linea) clave = linea.slice('POSTGRES_PASSWORD='.length).trim();
  }
  crearSiFalta(rootEnv, `POSTGRES_USER=logicode\nPOSTGRES_PASSWORD=${clave}\nPOSTGRES_DB=logicode\n`);
  crearSiFalta(
    path.join(backend, '.env'),
    `DATABASE_URL="postgresql://logicode:${clave}@localhost:5433/logicode"\n` +
      `JWT_SECRET="${aleatorio(48)}"\nPORT=4000\nCORS_ORIGIN="${WEB}"\n`,
  );
  crearSiFalta(path.join(frontend, '.env.local'), `NEXT_PUBLIC_API_URL="${API}"\n`);
  console.log('Configuración lista.');
}

function actualizarCodigo() {
  paso('Buscando actualizaciones en GitHub');
  if (!fs.existsSync(path.join(raiz, '.git')) || salidaDe('git', ['--version']) === null) {
    console.log('Esta carpeta no es un clon de git; se usa el código tal como está.');
    return;
  }
  const cambios = salidaDe('git', ['status', '--porcelain', '--untracked-files=no']);
  if (cambios) {
    console.log('Hay archivos cambiados en esta carpeta; no se actualiza para no perderlos:');
    console.log(cambios);
    return;
  }
  if (!correr('git', ['pull', '--ff-only'])) {
    console.log('No se pudo actualizar (¿sin internet?). Se sigue con el código actual.');
  }
}

function revisarDocker() {
  paso('Revisando Docker');
  if (salidaDe('docker', ['--version']) === null) salirConError('falta Docker Desktop (https://www.docker.com/products/docker-desktop/).');
  if (salidaDe('docker', ['info']) === null) salirConError('Docker Desktop está instalado pero no está abierto. Ábralo y vuelva a intentar.');
  console.log('Docker está abierto.');
}

async function levantarBase() {
  paso('Levantando la base de datos');
  if (!correr('docker', ['compose', 'up', '-d'])) salirConError('Docker no pudo levantar la base de datos.');
  for (let i = 0; i < 40; i++) {
    if (salidaDe('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'logicode_db']) === 'healthy') {
      console.log('La base de datos está lista.');
      return;
    }
    await esperar(2000);
  }
  salirConError('la base de datos no respondió en 80 segundos.');
}

// Instala dependencias solo si faltan o si package-lock.json cambió desde la última instalación.
function instalar(carpeta, nombre) {
  const lock = path.join(carpeta, 'package-lock.json');
  const instalado = path.join(carpeta, 'node_modules', '.package-lock.json');
  const alDia = fs.existsSync(instalado) && fs.statSync(instalado).mtimeMs >= fs.statSync(lock).mtimeMs;
  if (alDia) return false;
  paso(`Instalando dependencias de ${nombre}`);
  if (!correr('npm', ['ci', '--no-fund', '--no-audit'], carpeta)) salirConError(`falló la instalación de ${nombre}.`);
  return true;
}

function prepararBase() {
  paso('Aplicando cambios a las tablas');
  // npm reciente no corre "postinstall", así que el cliente de Prisma se genera aquí.
  if (!correr('npx', ['prisma', 'generate'], backend)) salirConError('no se pudo generar el cliente de la base de datos.');
  if (!correr('npx', ['prisma', 'migrate', 'deploy'], backend)) salirConError('no se pudieron aplicar las migraciones.');
}

function puertoOcupado(puerto) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => s.close(() => resolve(false)));
    s.listen(puerto);
  });
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const procesos = [];

// Arranca "npm run dev" en una carpeta y antepone [API] o [WEB] a cada línea.
function arrancar(carpeta, etiqueta) {
  // En Linux y macOS va en su propio grupo de procesos para poder cerrarlo completo.
  const p = spawn(...linea('npm', ['run', 'dev']), { cwd: carpeta, shell: windows, env: process.env, detached: !windows });
  for (const flujo of [p.stdout, p.stderr]) {
    let resto = '';
    flujo.on('data', (d) => {
      const lineas = (resto + d).split(/\r?\n/);
      resto = lineas.pop();
      for (const l of lineas) console.log(`[${etiqueta}] ${l}`);
    });
  }
  p.on('exit', (codigo) => {
    if (!apagando) {
      console.log(`[${etiqueta}] se detuvo (código ${codigo}). Se apaga todo.`);
      apagar();
    }
  });
  procesos.push(p);
}

async function responde(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function esperarA(url, segundos) {
  for (let i = 0; i < segundos / 2; i++) {
    if (await responde(url)) return true;
    await esperar(2000);
  }
  return false;
}

function abrirNavegador(url) {
  const [cmd, args] = windows ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const p = spawn(cmd, args, { stdio: 'ignore', detached: true });
  p.on('error', () => console.log(`Abra ${url} en el navegador.`));
  p.unref();
}

function cerrarProcesos() {
  for (const p of procesos) {
    if (p.exitCode !== null) continue;
    // En Windows hay que cerrar el árbol completo (npm -> node) o la web queda corriendo.
    if (windows) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try {
        process.kill(-p.pid, 'SIGINT');
      } catch {}
    }
  }
}
// Si este programa termina por cualquier motivo, no deja la API ni la web huérfanas.
process.on('exit', cerrarProcesos);

let apagando = false;
function apagar() {
  if (apagando) return;
  apagando = true;
  console.log('\nApagando LogiCode...');
  cerrarProcesos();
  console.log('La base de datos sigue en Docker; se apaga sola al cerrar Docker Desktop.');
  setTimeout(() => process.exit(0), 500);
}

async function main() {
  console.log('LogiCode: arranque local');
  for (const puerto of [4000, 3000]) {
    if (await puertoOcupado(puerto)) {
      salirConError(`el puerto ${puerto} ya está en uso. ¿LogiCode ya está abierto en otra ventana? Ciérrela con Ctrl+C.`);
    }
  }
  actualizarCodigo();
  configuracion();
  revisarDocker();
  await levantarBase();
  instalar(backend, 'la API');
  instalar(frontend, 'la web');
  prepararBase();

  paso('Arrancando la API y la web');
  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);
  arrancar(backend, 'API');
  arrancar(frontend, 'WEB');

  const apiOk = await esperarA(`${API}/api/health`, 60);
  const webOk = apiOk && (await esperarA(WEB, 120));
  if (apiOk && webOk) {
    console.log(`\n=== LISTO. LogiCode está en ${WEB}  (Ctrl+C para apagar)\n`);
    abrirNavegador(WEB);
  } else {
    console.log(`\n${apiOk ? 'La web' : 'La API'} no respondió a tiempo. Revise los mensajes de arriba.`);
  }
}

main();
