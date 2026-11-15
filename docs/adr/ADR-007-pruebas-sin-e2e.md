# ADR-007: Pruebas sin e2e

**Estado:** aceptado · **Fecha:** 2026-11-11 · **Decide:** Moisés

## Contexto
El usuario no quiere pruebas de extremo a extremo en Capaz. En Cotizín esas pruebas detectaban fallos visuales a 390 y 1280 px, pero tenían un costo alto de memoria y mantenimiento.

## Decisión
- **Sin e2e:** ni Playwright ni pruebas de navegador.
- **Vitest unitarias** para reglas y herramientas.
- **Integración del servidor contra PostgreSQL real** con el rol `capaz_app`: aislamiento entre dos empresas por cada tabla (generado desde el catálogo), auditoría de solo inserción, bloqueo por módulo.
- **Pruebas de arquitectura:** fronteras entre módulos y RLS forzada en toda tabla con `tenant_id`.
- **Pruebas de contrato:** los esquemas compartidos validan lo que responde la API.
- **Revisión visual manual:** toda pantalla nueva se revisa a 390 y 1280 px, en claro y oscuro, antes de darla por terminada.
- **Registro:** pruebas de equivalencia contra las funciones SQL de Tairos.RC, con los mismos casos.

## Consecuencias
- Se pierde la detección automática de fallos de pantalla; la revisión manual lo reemplaza.
- El contrato compartido entre web y API pasa a ser la defensa principal contra desajustes.
