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

## Pruebas

```bash
cd backend && npm test               # necesita la base de datos corriendo
cd frontend && npm run lint && npm run build
```

## Flujo de trabajo

Ramas cortas (`feature/`, `fix/`, `docs/`) e integración a `main` por Pull Request con el CI en verde.

## Plan

El alcance, los roles y el plan por fases están en el anteproyecto del proyecto. Fase actual: **1. Análisis y diseño** (esqueleto y base de datos).
