# Capaz ERP

ERP moderno, modular y multiempresa para la industria gráfica y publicitaria: estructura completa de ERP comercial con apariencia tradicional y, por detrás, comportamiento de trabajador digital (agentes, voz, aprobación humana). Software nuevo e independiente de Cotizín y de Tairos.RC; el **Registro** por voz y el **Cotizador** se adaptan como módulos después de construir la estructura.

## Documentación

| Documento | Para qué |
|---|---|
| [docs/FINALIDAD-Y-OBJETIVOS-ERP.md](docs/FINALIDAD-Y-OBJETIVOS-ERP.md) | Finalidad, alcance, metas del piloto |
| [docs/RELEVO.md](docs/RELEVO.md) | **Estado actual y cómo retomar el trabajo** |
| [docs/PLAN-PARALELO.md](docs/PLAN-PARALELO.md) | **Carriles para varios agentes en paralelo** |
| [docs/PLAN-DE-CONSTRUCCION.md](docs/PLAN-DE-CONSTRUCCION.md) | **Cómo se construye, fase por fase (para el agente constructor)** |
| [docs/MODULOS-Y-MERCADO.md](docs/MODULOS-Y-MERCADO.md) | Catálogo de módulos (referencia Odoo), mercado 2026 y olas de construcción |
| [docs/PLAN-CIMIENTOS.md](docs/PLAN-CIMIENTOS.md) | Diseño de los cimientos: qué y por qué |
| [docs/ARQUITECTURA-DE-MODULOS.md](docs/ARQUITECTURA-DE-MODULOS.md) | Anatomía y reglas de los módulos |
| [docs/ARQUITECTURA-DE-IA.md](docs/ARQUITECTURA-DE-IA.md) | Principios de agentes, herramientas y aprobación |
| [docs/INTEGRACION-DE-MODULOS.md](docs/INTEGRACION-DE-MODULOS.md) | Cómo entran Cotizín y Tairos.RC |
| [docs/PLATAFORMA-Y-PLANES.md](docs/PLATAFORMA-Y-PLANES.md) | Consola de plataforma, planes, precios y accesos |
| [docs/adr/](docs/adr/) | Decisiones de arquitectura (ADR 001 a 015) |
| [docs/FRONTEND-INVESTIGACION.md](docs/FRONTEND-INVESTIGACION.md) | Pila de interfaz propuesta (pendiente de aprobar) |
| [AGENTS.md](AGENTS.md) | Reglas para agentes y personas que construyen |
| [docs/REFERENCIAS.md](docs/REFERENCIAS.md) | Odoo 20.0, solo para estudio |

## Estructura

```
apps/web         React 19 + Vite + Tailwind + React Router (interfaz)
apps/api         NestJS 12 (API, lógica de negocio, permisos)
packages/shared  Contratos Zod compartidos entre web y api
docs/            Documentación y decisiones
```

## Primeros pasos

Requisitos: Node 22 o superior, pnpm y Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up          # PostgreSQL 18 local en el puerto 5450
pnpm db:preparar    # crea los cuatro roles sin superusuario y las bases capaz y capaz_test
pnpm db:migrar      # aplica las migraciones con capaz_owner
pnpm build          # compila shared primero
pnpm dev:api        # http://localhost:3001/api/health
pnpm dev:web        # http://localhost:5173
```

Comandos útiles: `pnpm check` (todo), `pnpm test`, `pnpm test:int`, `pnpm typecheck`, `pnpm lint`, `pnpm db:down`.

## Decisiones vigentes

- Pila: React + Vite en el frente, NestJS en el servidor, PostgreSQL con Drizzle, Better Auth, Zod.
- Base de datos: Neon (proyecto en São Paulo). Servidor en la misma región: host por decidir (fase 10a). Archivos en Cloudflare R2.
- Sin pruebas e2e en este proyecto: se prueba con Vitest (unitarias y de integración del servidor).
- TypeScript fijado en 6.0.3 para todo el repositorio (NestJS 12 apunta a la línea 6).
