# LogiCode

Plataforma web de apoyo para la materia **Pensamiento Computacional** de primer semestre. El docente publica material y crea actividades que la plataforma califica automáticamente; los estudiantes del curso las resuelven y repasan; los visitantes consultan la biblioteca pública y el foro. Herramientas: PSeInt, DFD, Scratch y Arduino.

**Autores:** Carlos Alberto Escamilla Mariño · Yarly Melitza Guerrero Berbesi

## Estructura

```
backend/             API en Node.js (Express 5) + Prisma + PostgreSQL
  prisma/schema.prisma   modelo de datos (usuarios, curso, temas, material, actividades, entregas, foro)
  prisma/migrations/     migraciones de la base de datos
  src/                   código de la API
  test/                  pruebas (node:test + supertest)
frontend/            web en Next.js (React) + Tailwind CSS
docker-compose.yml   PostgreSQL para desarrollo local
main.js              arranque local de todo con "npm start" (o F5 en VS Code)
```

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para la base de datos), o PostgreSQL 16 instalado

## Puesta en marcha en local

Con Docker Desktop abierto, en la carpeta del proyecto:

```bash
npm start          # o F5 en VS Code ("Iniciar LogiCode")
```

`main.js` hace todo en una sola ventana: trae lo nuevo de GitHub (si no hay archivos cambiados), crea los `.env` la primera vez con claves aleatorias, levanta la base en Docker, instala dependencias cuando cambian, aplica las migraciones, arranca la API y la web, y abre http://localhost:3000. Ctrl+C apaga la API y la web.

Lo que nunca va a GitHub (está en `.gitignore`): los `.env` con contraseñas, los archivos subidos (`backend/uploads`), las copias de la base (`backend/copias`) y `node_modules`.

### Los mismos datos en varios equipos

Para que dos PCs vean los mismos usuarios, cursos y archivos, los dos usan la base y los archivos de la web:

1. En Vercel → proyecto `logicode` → **Settings → Environment Variables**, copie `DATABASE_URL` (la de Neon) y las cuatro `R2_*`.
2. En cada PC, pegue esos valores en `backend/.env`, en lugar de la línea `DATABASE_URL` que apunta a `localhost`.
3. `npm start`. Cuando `DATABASE_URL` no es de `localhost`, `main.js` no usa Docker ni cambia las tablas (eso lo hace Vercel al publicar).

Todo lo que se haga así cambia los datos reales de la web. Para volver a la base local, ponga otra vez la línea de `localhost`, que está en el `.env` de la raíz (`POSTGRES_PASSWORD`).

### Paso a paso (sin main.js)

```bash
# 1. Base de datos
cp .env.example .env                  # cambie POSTGRES_PASSWORD
docker compose up -d

# 2. API (http://localhost:4000)
cd backend
cp .env.example .env                  # misma contraseña en DATABASE_URL, y un JWT_SECRET aleatorio
npm install
npm run db:migrate                    # crea las tablas
npm run db:seed                       # crea el primer administrador (variables SEED_ADMIN_*)
npm run dev

# 3. Web (http://localhost:3000), en otra terminal
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Para comprobar que todo funciona: http://localhost:4000/api/health debe responder `{"estado":"ok","baseDeDatos":"conectada"}`.

## Acceso y roles (fase 2)

| Ruta de la API | Quién | Qué hace |
| --- | --- | --- |
| `POST /api/auth/register` | cualquiera | Estudiante: solo si su cédula está en la lista de un curso. Docente: queda pendiente. |
| `POST /api/auth/login` | cualquiera | Ingreso con cédula y contraseña; devuelve la sesión (8 horas). |
| `GET /api/auth/me` | con sesión | Datos del usuario actual. |
| `POST /api/auth/forgot-password` | cualquiera | Envía el enlace de recuperación (vence en 1 hora). |
| `POST /api/auth/reset-password` | con enlace | Cambia la contraseña; el enlace sirve una sola vez. |
| `GET /api/admin/teachers?status=PENDING` | administrador | Docentes por estado. |
| `POST /api/admin/teachers/:id/approve` y `/disable` | administrador | Aprueba o rechaza a un docente. |
| `GET` / `POST /api/courses` | con sesión / docente | Lista los cursos según el rol; el docente crea el suyo. |
| `GET` / `POST /api/courses/:id/roster` | docente del curso | Lista o carga cédulas (texto pegado desde Excel o CSV). |
| `DELETE /api/courses/:id/roster/:entryId` | docente del curso | Quita una cédula de la lista. |

Mientras no haya servidor de correo, el correo de recuperación se escribe en la consola de la API (la ventana donde corre `npm run dev`), con el enlace para abrir.

## Contenidos (fase 3)

| Ruta de la API | Quién | Qué hace |
| --- | --- | --- |
| `GET` / `POST /api/courses/:id/topics` | curso / docente | Temas en orden con su material; el docente crea temas. |
| `PATCH` / `DELETE /api/topics/:id` | docente del curso | Edita, marca "próxima clase" (solo uno por curso) o borra un tema. |
| `POST /api/topics/:id/move` | docente del curso | Sube o baja el tema (`direction: up | down`). |
| `POST /api/archivos/subida` | con sesión | Enlace firmado para subir un archivo directo a Cloudflare R2 (`destino: material | entrega`). Sin R2 responde `directo: false`. |
| `POST /api/materials` | docente / administrador | Archivo (multipart, máx. 20 MB, o `subida` de R2 con videos hasta 1 GB), enlace o video. Sin `courseId` va directo a la biblioteca. |
| `PATCH` / `DELETE /api/materials/:id` | quien lo subió o el docente | Cambia visibilidad, título o tema; borra el material y su archivo. |
| `GET /api/materials/:id/file` | según visibilidad | Descarga: público para todos, del curso solo para sus estudiantes. |
| `GET /api/library?tool=PSEINT` | visitantes | Material público, filtrado por herramienta. |

Los archivos se guardan en `backend/uploads` (cambiable con `UPLOAD_DIR`) con nombres aleatorios y solo se sirven por la API. Con las variables `R2_*` se guardan en Cloudflare R2 y la API entrega enlaces firmados que vencen en una hora; los pasos para crear el bucket y copiar los archivos que ya existen están en [docs/archivos-en-r2.md](docs/archivos-en-r2.md).

## Apartado del estudiante y perfil

| Ruta de la API | Quién | Qué hace |
| --- | --- | --- |
| `GET /api/me/summary` | estudiante | Panel: lo que tiene por entregar (actividades y quizzes, con prórrogas), próximos quizzes, últimas notas, avance por tema y mejores puntajes de los juegos. |
| `GET /api/me/grades` | estudiante | Notas y comentarios de cada actividad y quiz; la definitiva es la misma de la planilla del docente. |
| `PATCH /api/me` | con sesión | Cambia el correo. |
| `POST /api/me/password` | con sesión | Cambia la contraseña (pide la actual). |
| `PUT` / `DELETE /api/me/avatar` | con sesión | Sube (JPG, PNG o WebP, máx. 1 MB; la web la recorta a 320×320) o quita la foto de perfil. |
| `GET /api/users/:id/avatar` | cualquiera | La foto de perfil (sale en el foro, que es público). |
| `GET` / `POST /api/me/games` | con sesión | Mejores puntajes y partidas de los juegos. |

Páginas: `/panel` (estudiante), `/mis-notas`, `/perfil` (todos los roles) y `/juegos` con *Adivina la salida*, *Memorama de símbolos* y *Ordena los pasos*. Los visitantes también pueden jugar, pero el puntaje solo se guarda con sesión. Las respuestas de *Adivina la salida* se comprueban con el intérprete de PSeInt en `backend/test/juegos.test.js`.

## Publicar en internet (Vercel + Neon)

La API (`backend`) y la web (`frontend`) se publican como un solo proyecto de Vercel con dos servicios (`vercel.json` de la raíz: `/api` va a la API y lo demás a la web), con la base en Neon. Los pasos para crear las cuentas y pegar las variables están en [docs/publicar-en-vercel.md](docs/publicar-en-vercel.md).

- En producción, `npm run vercel-build` aplica las migraciones a Neon y crea el primer administrador; las vistas previas de los PR no tocan la base.
- En Vercel web y API comparten dirección: la web llama a `/api` sin dominio y no hace falta CORS. En el PC, `CORS_ORIGIN` acepta varias direcciones separadas por comas, y `*` vale por cualquier texto.
- La copia diaria de la base la hace GitHub Actions (`.github/workflows/copia-diaria.yml`, secreto `NEON_DATABASE_URL`) y queda 14 días en la pestaña Actions.
- Vercel llama una vez al día a `/api/cron/diario` (con `CRON_SECRET`) para calificar las entregas que quedaron pendientes.

## Pruebas

```bash
cd backend && npm test               # necesita la base de datos corriendo
cd frontend && npm run lint && npm run build
```

## Flujo de trabajo

Ramas cortas (`feature/`, `fix/`, `docs/`) e integración a `main` por Pull Request con el CI en verde.

## Plan

El alcance, los roles y el plan por fases están en el anteproyecto del proyecto. Fase actual: **3. Contenidos** (temas, material de apoyo, próxima clase y biblioteca).
