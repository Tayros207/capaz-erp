# ADR-002: Web y API separadas (React + Vite y NestJS), sin Next.js

**Estado:** aceptado · **Fecha:** 2026-11-11 · **Decide:** Moisés

## Contexto
Next.js no se considera adecuado para este proyecto. Evidencia en Cotizín: solo 38 de 370 archivos dependen de Next; se abandonaron las Server Actions por un atasco con la base; todo el uso es detrás de login, sin necesidad de posicionamiento en buscadores. Varios clientes (web móvil, voz, agente, MCP) hablarán con el mismo servidor, y habrá tareas largas.

## Decisión
- Interfaz: React 19 + Vite + Tailwind 4 + React Router (aplicación de una página, móvil primero).
- Servidor: NestJS 12 (ESM), API REST bajo `/api/v1/`.
- TypeScript 6.0.3 en todo el repositorio (NestJS 12 apunta a la línea 6).
- Contratos Zod en `packages/shared`: única fuente de verdad entre web y API.
- En producción, mismo origen: la API sirve la web compilada (cookies de sesión sin problemas entre dominios).
- La página pública de cotizaciones (enlace por WhatsApp) la genera la API como HTML simple, sin JavaScript.

## Consecuencias
- Dos aplicaciones en un repositorio; se despliegan juntas en un contenedor.
- Más trabajo para conectar web y API; se compensa con cliente tipado y esquemas compartidos.
- Sin e2e, el contrato compartido es lo que detecta desajustes entre las dos.
- Python queda fuera del núcleo (ver ADR-006).
