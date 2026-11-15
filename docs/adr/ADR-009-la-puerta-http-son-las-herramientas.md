# ADR-009: La puerta HTTP son las herramientas

**Estado:** aceptado con el inicio de la construcción · **Fecha:** 2026-11-14 · **Decide:** Moisés

## Contexto
Pantalla, voz, agente y MCP piden las mismas operaciones. Duplicar rutas REST por módulo repetiría permisos, validación y auditoría.

## Decisión
- `POST /api/v1/herramientas/:nombre` ejecuta una herramienta registrada, con cuerpo `{ args, confirmacion? }`, y responde siempre `Respuesta<T>`.
- `@capaz/shared` exporta el mapa de contratos (entrada y salida Zod por herramienta). El servidor registra cada herramienta **a partir de ese contrato** y el cliente web queda tipado por el mismo mapa, sin generar código.
- Las rutas REST clásicas se agregan solo cuando un tercero las necesite, como envoltorios de las mismas herramientas.

## Consecuencias
- Una operación nueva toca solo su contrato y su archivo.
- Un cambio de contrato rompe el tipo en la web (la defensa principal sin e2e).
- Detalle: `docs/PLAN-DE-CONSTRUCCION.md`, fase 5a.
