# ADR-005: Registro único de herramientas; el agente no tiene permisos especiales

**Estado:** aceptado · **Fecha:** 2026-11-11 · **Decide:** Moisés

## Contexto
Una misma operación puede pedirla una pantalla, la voz, un agente o un cliente MCP. Si cada uno tuviera su propia implementación, las reglas de dinero se duplicarían. Un agente de IA puede equivocarse.

## Decisión
- Todas las operaciones se registran como herramientas con esquema Zod, permiso, módulo y ayuda; se ejecutan por un único `ejecutar()`.
- El contexto (empresa, usuario, permisos, canal) lo pone el servidor; se rechazan los argumentos con nombres reservados (`empresaId`, `usuarioId`, `permisos`, `canal`, entre otros).
- Canales: `ui`, `agente`, `mcp`, `sistema`.
- Las acciones críticas piden confirmación con un token firmado, de un solo uso, ligado a usuario, empresa, argumentos y estado, **válido solo desde la pantalla**: la aprobación la da el usuario autenticado, no el modelo.
- Cada llamada deja un evento en `core.auditoria` (solo inserción), con módulo, canal, resultado, hash de argumentos y `requestId`.
- Los borradores del Registro por voz persisten en la base con estado pendiente, independientemente de cualquier proceso en ejecución.

## Consecuencias
- Se porta `shared/herramientas` de Cotizín (92 herramientas, con pruebas).
- Agregar el agente y MCP después no obliga a tocar las reglas.
