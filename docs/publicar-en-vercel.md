# Publicar LogiCode en internet (Vercel + Neon)

LogiCode se publica como **dos proyectos de Vercel** que salen del mismo repositorio:

| Proyecto de Vercel | Carpeta del repositorio | Qué es |
| --- | --- | --- |
| `logicode-api` | `backend` | La API (Express + Prisma). Vercel la corre como una función. |
| `logicode-web` | `frontend` | La web (Next.js). |

La base de datos es **Neon** (PostgreSQL gratis de 1 GB), creada desde el panel de Vercel. Los archivos subidos van a **Cloudflare R2** (ver la guía de R2). Todo es gratis; cada PR que se fusiona en `main` se publica solo.

En el PC nada cambia: la base sigue en Docker (puerto 5433) y la API y la web se corren como siempre.

## Pasos (una sola vez)

### 1. Cuenta de Vercel

1. Entre a https://vercel.com/signup, elija el plan **Hobby** y **Continue with GitHub** con la cuenta `CarlosEscam`.
2. Cuando pregunte a qué repositorios dar acceso, elija **LogiCode**.

### 2. La API (`logicode-api`)

1. En Vercel: **Add New… → Project**, elija **LogiCode** y **Import**.
2. **Project Name:** `logicode-api`. **Root Directory:** `backend` (botón *Edit*). El *Framework Preset* debe decir **Express**.
3. Abra **Environment Variables** y pegue estas (puede pegar todo el bloque de una vez):

   ```
   JWT_SECRET=una-clave-larga-y-aleatoria
   CRON_SECRET=otra-clave-larga-y-aleatoria
   AI_PROVIDER=gemini
   GEMINI_API_KEY=su-clave-de-https://aistudio.google.com/apikey
   SEED_ADMIN_CEDULA=su-cedula
   SEED_ADMIN_NAME=Su nombre
   SEED_ADMIN_EMAIL=su-correo
   SEED_ADMIN_PASSWORD=una-contrasena-de-8-o-mas
   ```

   Para las dos claves sirve cualquier texto largo sin espacios (por ejemplo, el que da https://www.uuidgenerator.net, dos veces seguidas). Con `SEED_ADMIN_*` se crea su usuario administrador en la base de internet; si ya existe, no se toca.
4. **Deploy.** Este primer intento **falla** porque todavía no hay base de datos: es normal.

### 3. La base de datos (Neon)

1. En el proyecto `logicode-api`, pestaña **Storage → Create Database → Neon** (*Serverless Postgres*).
2. Acepte crear la cuenta de Neon desde Vercel (no hace falta registrarse aparte), plan **Free**, región **Washington, D.C. (iad1)**, que es la más cercana a Colombia.
3. Al conectarla al proyecto, deje marcados *Production*, *Preview* y *Development*. Vercel agrega solo `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
4. Pestaña **Deployments**, en el último: **⋯ → Redeploy**. Esta vez crea las tablas y su administrador.
5. Copie la dirección del proyecto (por ejemplo `https://logicode-api.vercel.app`) y ábrala con `/api/health` al final. Debe responder `{"estado":"ok","baseDeDatos":"conectada"}`.

### 4. La web (`logicode-web`)

1. **Add New… → Project**, otra vez **LogiCode**.
2. **Project Name:** `logicode-web`. **Root Directory:** `frontend`. El *Framework Preset* debe decir **Next.js**.
3. Variable de entorno (la dirección de la API del paso 3, sin `/` al final):

   ```
   NEXT_PUBLIC_API_URL=https://logicode-api.vercel.app
   ```
4. **Deploy.** Copie la dirección de la web (por ejemplo `https://logicode-web.vercel.app`).

### 5. Avisarle a la API dónde está la web

1. En `logicode-api` → **Settings → Environment Variables**, agregue (con la dirección del paso 4):

   ```
   CORS_ORIGIN=https://logicode-web.vercel.app
   APP_URL=https://logicode-web.vercel.app
   ```
2. **Deployments → ⋯ → Redeploy.** Ya puede entrar a la web con su cédula y la contraseña de `SEED_ADMIN_PASSWORD`.

### 6. Archivos (Cloudflare R2)

Siga la guía de R2 y pegue sus variables en `logicode-api` (Settings → Environment Variables), luego **Redeploy**. Sin R2 la API no puede guardar fotos ni material en internet.

### 7. Copia diaria de la base

GitHub hace una copia de la base de Neon cada día y la guarda 14 días.

1. En `logicode-api` → **Settings → Environment Variables**, busque `DATABASE_URL_UNPOOLED`, ábrala con el ojo y cópiela.
2. En GitHub, repositorio LogiCode → **Settings → Secrets and variables → Actions → New repository secret**. Nombre: `NEON_DATABASE_URL`; valor: lo que copió.
3. Para probarla: pestaña **Actions → Copia diaria de la base → Run workflow**. Al terminar, la copia aparece abajo en *Artifacts*.

Neon, además, permite volver la base a cualquier momento de las últimas 6 horas desde su panel (**Restore**).

## Para tener en cuenta

- **Vistas previas:** cada PR también se publica en una dirección de prueba, pero esas vistas previas **no** cambian la base de datos: las migraciones solo corren al publicar `main`.
- **Calificación pendiente:** si una entrega queda sin calificar (por ejemplo, Gemini no respondió), Vercel la retoma una vez al día (tarea `/api/cron/diario`).
- **Correos de recuperación:** como en el PC, se escriben en el registro de la API: `logicode-api` → **Logs**.
- **Restaurar una copia en Neon** (borra lo que hay en la base de internet): descargue la copia, y en la carpeta `backend` de su PC, en PowerShell:

  ```powershell
  $env:DATABASE_URL="(el valor de DATABASE_URL_UNPOOLED)"
  npm run restaurar-copia -- C:\ruta\de\la\copia.json.gz
  ```

  Así mismo puede subir a internet lo que ya tiene en su PC: en el panel del administrador local, **Copias de seguridad → Hacer una copia ahora → Descargar**, y restaure esa copia en Neon. Los archivos (fotos, material) se pasan aparte con la guía de R2.
- **Límites del plan gratis:** Neon da 1 GB de base; Vercel corta cada petición a los 5 minutos y no deja subir por la API archivos de más de 4,5 MB (la parte de R2 resuelve las subidas grandes).
