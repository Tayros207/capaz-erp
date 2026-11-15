# ADR-008: Lógica del Registro en TypeScript y voz primero

**Estado:** aceptado · **Fecha:** 2026-11-11 · **Decide:** Moisés (la parte de pantallas delegada en el asistente)

## Contexto
Tairos.RC (Registro actual) tiene 23 funciones SQL con la lógica de saldos, abonos y cobros, sobre Supabase. Sus datos son de prueba. El dolor principal y la meta del piloto de 30 días son registrar por voz: 70 % sin corregir y 30 segundos por registro. Tairos.RC seguirá funcionando durante el piloto.

## Decisión
- **Se reescribe la lógica de dinero en TypeScript** (servicios del módulo `registro`), con pruebas de equivalencia contra las funciones SQL originales usando los mismos casos. El SQL queda solo como referencia y se retira al lograr paridad. La base conserva restricciones, RLS y disparadores de inmutabilidad.
- **Voz primero.** El primer corte del Registro incluye captura por voz, borradores, bandeja de revisión (aprobar o corregir con un clic), lista de movimientos, deudas y abonos, adaptado al diseño Pliego.
- Órdenes, proformas, recibos, reportes y papelera se portan después.
- Se mide con audios reales de taller antes de seguir con el resto.
- Se copia, no se mueve: Cotizín y Tairos.RC no se tocan.

## Consecuencias
- Una sola implementación de las reglas de dinero, compartida por pantalla, voz y agente.
- Riesgo principal: cambiar una regla de dinero al reescribir; se cubre con las pruebas de equivalencia.
- Detalle: `docs/INTEGRACION-DE-MODULOS.md`.
