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
```

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para la base de datos), o PostgreSQL 16 instalado

## Puesta en marcha en local

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

## Pruebas

```bash
cd backend && npm test               # necesita la base de datos corriendo
cd frontend && npm run lint && npm run build
```

## Flujo de trabajo

Ramas cortas (`feature/`, `fix/`, `docs/`) e integración a `main` por Pull Request con el CI en verde.

## Plan

El alcance, los roles y el plan por fases están en el anteproyecto del proyecto. Fase actual: **2. Usuarios y acceso** (registro, ingreso, roles, cédulas habilitadas).
