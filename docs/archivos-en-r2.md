# Archivos en Cloudflare R2

En internet, LogiCode guarda en **Cloudflare R2** todo lo que se sube: fotos de perfil, fotos y archivos de las entregas, material de apoyo y videos de clase. La base (Neon) solo guarda el nombre de cada archivo.

En su PC no cambia nada: si `backend/.env` no tiene las variables `R2_*`, los archivos se siguen guardando en `backend/uploads`.

**Qué da el plan gratis de R2:** 10 GB de archivos, 1 millón de subidas y 10 millones de lecturas al mes, y descargas sin costo. Cloudflare pide una tarjeta para activar R2, pero no cobra mientras no se pase de eso.

## Pasos (una sola vez)

### 1. Activar R2 y crear el bucket

1. Entre a [dash.cloudflare.com](https://dash.cloudflare.com) (cree la cuenta si no la tiene).
2. En el menú de la izquierda, **R2 Object Storage**. La primera vez pide activar R2 con un método de pago.
3. **Create bucket** → nombre `logicode` → ubicación **Automatic** → **Create bucket**. No active el acceso público: LogiCode entrega cada archivo con un enlace firmado que vence en una hora.
4. En la página de R2 (Overview), copie el **Account ID**. Es el valor de `R2_ACCOUNT_ID`.

### 2. Permitir que la web suba y abra archivos (CORS)

Los videos pesan hasta 1 GB y Vercel no deja pasar por la API más de 4,5 MB, así que el navegador sube el archivo directo a R2. Para eso R2 tiene que aceptar a la web.

En el bucket `logicode` → **Settings** → **CORS Policy** → **Add CORS policy** (o **Edit**), pegue esto y guarde:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

El `*` deja entrar a la web publicada (por ejemplo `https://logicode.vercel.app`), a las vistas previas de Vercel y a `localhost`. Si prefiere cerrarlo, cambie `"*"` por la dirección de su web, pero entonces las vistas previas no podrán subir archivos. No abre los archivos a nadie: sin un enlace firmado por la API, R2 los rechaza.

### 3. Crear las claves de acceso

1. En R2 → **Manage API tokens** (arriba a la derecha en Overview) → **Create API token** (el de cuenta o el de usuario sirve).
2. Nombre: `logicode`. Permiso: **Object Read & Write**. En **Specify bucket(s)** elija solo `logicode`.
3. **Create API Token**. Copie el **Access Key ID** y el **Secret Access Key**: el secreto se ve una sola vez.

### 4. Pegar las variables en Vercel

En el proyecto `logicode` de Vercel → **Settings** → **Environment Variables**, agregue:

| Variable | Valor |
| --- | --- |
| `R2_ACCOUNT_ID` | el Account ID del paso 1 |
| `R2_ACCESS_KEY_ID` | el Access Key ID del paso 3 |
| `R2_SECRET_ACCESS_KEY` | el Secret Access Key del paso 3 |
| `R2_BUCKET` | `logicode` |

Luego **Deployments** → el último → **Redeploy**.

### 5. Pasar a R2 los archivos que ya tiene en su PC

Hágalo cuando pase la base de su PC a Neon (ver [publicar-en-vercel.md](publicar-en-vercel.md)), para que los nombres de la base y los archivos coincidan.

1. Abra `backend\.env` de su PC y agregue al final las mismas cuatro variables del paso 4.
2. En una terminal, dentro de la carpeta `backend`:

   ```
   npm run subir-archivos-r2
   ```

   Copia todo `backend\uploads` a R2 con los mismos nombres. Los que ya están se saltan, así que se puede repetir si se corta. No borra nada de su PC.
3. Quite las cuatro variables de `backend\.env` para que su PC siga guardando en la carpeta local. (Si las deja, su PC también usará R2.)

## Cómo funciona

- `backend/src/lib/almacen.js` guarda, lee y borra en R2 o en la carpeta local según haya o no variables `R2_*`.
- La web pide un enlace firmado a `POST /api/archivos/subida`, sube el archivo directo a R2 con avance y le pasa a la API el comprobante (`subida`) en vez del archivo. La API revisa quién lo subió, el formato y el tamaño real en R2; si se pasa del límite, lo borra.
- Para ver o descargar, la API revisa los permisos como siempre y entrega un enlace de R2 que vence en una hora, con el tipo y el nombre del archivo puestos por la API.
- La IA que califica las fotos y el revisor de Scratch leen el archivo desde R2.
