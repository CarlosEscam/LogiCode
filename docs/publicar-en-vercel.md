# Publicar LogiCode en internet (Vercel + Neon)

LogiCode se publica como **un solo proyecto de Vercel** con dos servicios, definidos en `vercel.json` de la raíz:

| Servicio | Carpeta | Qué atiende |
| --- | --- | --- |
| `backend` | `backend` | Todo lo que empieza por `/api` (Express + Prisma). Vercel lo corre como una función. |
| `frontend` | `frontend` | Todo lo demás: la web (Next.js). |

Web y API comparten la misma dirección, así que no hay que configurar direcciones entre ellas. Esa dirección la elige Vercel y aparece en el proyecto, en **Domains** (o en el botón **Visit**). Si el nombre `logicode` ya lo tiene otra persona, Vercel le agrega algo, por ejemplo `https://logicode-abc123.vercel.app`, y `logicode.vercel.app` muestra la página de otra cuenta o un 404.

La base de datos es **Neon** (PostgreSQL gratis de 1 GB), creada desde el panel de Vercel. Los archivos subidos van a **Cloudflare R2** (ver [la guía de R2](archivos-en-r2.md)). Todo es gratis; cada PR que se fusiona en `main` se publica solo.

En el PC nada cambia: la base sigue en Docker (puerto 5433) y la API y la web se corren como siempre.

## Pasos (una sola vez)

### 1. Cuenta de Vercel

1. Entre a https://vercel.com/signup, elija el plan **Hobby** y **Continue with GitHub** con la cuenta `CarlosEscam`.
2. Cuando pregunte a qué repositorios dar acceso, elija **LogiCode**.

### 2. Importar el proyecto

1. En Vercel: **Add New… → Project**, elija **LogiCode** y **Import**.
2. **Project Name:** `logicode`. Deje **Root Directory** en la raíz del repositorio: Vercel lee `vercel.json` y muestra *Importar proyecto multiservicio* con los servicios `backend` y `frontend`. No hace falta copiar el `vercel.json` que sugiere: el repositorio ya lo trae.
3. Abra **Environment Variables** y pegue estas (puede pegar todo el bloque de una vez). **Cambie cada valor por el suyo**: lo que está a la derecha del `=` es solo un ejemplo.

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

   Para las dos claves sirve cualquier texto largo sin espacios (por ejemplo, el que da https://www.uuidgenerator.net, dos veces seguidas). Con `SEED_ADMIN_*` se crea su usuario administrador en la base de internet; si ya existe, no se toca. `SEED_ADMIN_CEDULA` debe ser su cédula, solo con números; si no, la publicación falla con un aviso.
4. **Deploy.** Este primer intento **falla** porque todavía no hay base de datos: es normal.

### 3. La base de datos (Neon)

1. En el proyecto `logicode`, pestaña **Storage → Create Database → Neon** (*Serverless Postgres*).
2. Acepte crear la cuenta de Neon desde Vercel (no hace falta registrarse aparte), plan **Free**, región **Washington, D.C. (iad1)**, que es la más cercana a Colombia.
3. Al conectarla al proyecto, deje marcados *Production*, *Preview* y *Development*. Vercel agrega solo `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.

### 4. Publicar de nuevo

1. Pestaña **Deployments**, en el último: **⋯ → Redeploy**. Esta vez crea las tablas y su administrador.
2. Abra la dirección del proyecto (la de **Domains**) con `/api/health` al final. Debe responder `{"estado":"ok","baseDeDatos":"conectada"}`.
3. Abra la dirección sin nada al final y entre con su cédula y la contraseña de `SEED_ADMIN_PASSWORD`.

Si más adelante le pone un dominio propio, agregue la variable `APP_URL` con ese dominio (es la dirección que va en los correos de recuperación).

### 5. Archivos (Cloudflare R2)

Siga [la guía de R2](archivos-en-r2.md) para crear el bucket y sus claves, y pegue sus variables en `logicode` (Settings → Environment Variables):

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
```

Luego **Deployments → ⋯ → Redeploy**. Sin R2 la API no puede guardar fotos ni material en internet.

### 6. Copia diaria de la base

GitHub hace una copia de la base de Neon cada día y la guarda 14 días.

1. En `logicode` → **Settings → Environment Variables**, busque `DATABASE_URL_UNPOOLED`, ábrala con el ojo y cópiela.
2. En GitHub, repositorio LogiCode → **Settings → Secrets and variables → Actions → New repository secret**. Nombre: `NEON_DATABASE_URL`; valor: lo que copió.
3. Para probarla: pestaña **Actions → Copia diaria de la base → Run workflow**. Al terminar, la copia aparece abajo en *Artifacts*.

Neon, además, permite volver la base a cualquier momento de las últimas 6 horas desde su panel (**Restore**).

## Para tener en cuenta

- **Vistas previas:** cada PR también se publica en una dirección de prueba, pero esas vistas previas **no** cambian la base de datos: las migraciones solo corren al publicar `main`.
- **Calificación pendiente:** si una entrega queda sin calificar (por ejemplo, Gemini no respondió), Vercel la retoma una vez al día (tarea `/api/cron/diario`).
- **Correos de recuperación:** como en el PC, se escriben en el registro del proyecto: `logicode` → **Logs**.
- **Restaurar una copia en Neon** (borra lo que hay en la base de internet): descargue la copia, y en la carpeta `backend` de su PC, en PowerShell:

  ```powershell
  $env:DATABASE_URL="(el valor de DATABASE_URL_UNPOOLED)"
  npm run restaurar-copia -- C:\ruta\de\la\copia.json.gz
  ```

  Así mismo puede subir a internet lo que ya tiene en su PC: en el panel del administrador local, **Copias de seguridad → Hacer una copia ahora → Descargar**, y restaure esa copia en Neon. Los archivos (fotos, material) se pasan aparte con [la guía de R2](archivos-en-r2.md).
- **Límites del plan gratis:** Neon da 1 GB de base; Vercel corta cada petición a los 5 minutos y no deja subir por la API archivos de más de 4,5 MB (la parte de R2 resuelve las subidas grandes).
