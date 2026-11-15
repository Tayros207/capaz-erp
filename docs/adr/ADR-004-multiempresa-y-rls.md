# ADR-004: Multiempresa con tenant_id y RLS forzada

**Estado:** aceptado (ampliado por ADR-011: cuatro roles y política sin cláusula `TO`) · **Fecha:** 2026-11-11 · **Decide:** Moisés

## Contexto
Muchas empresas comparten una base. Un fallo de aislamiento expone datos financieros de otra empresa. Odoo aísla con filtros en la aplicación y una base por cliente; aquí se busca una sola base.

## Decisión
- Toda tabla de negocio lleva `tenant_id` (texto, igual al id de organización de Better Auth).
- `FORCE ROW LEVEL SECURITY` con una política única por plantilla.
- Tres roles de base: `capaz_owner` (migraciones), `capaz_app` (ejecución, sin `BYPASSRLS` ni propiedad de tablas) y `capaz_ro` (futuro, lectura).
- `conEmpresa(ctx, fn)` abre la transacción y fija `app.tenant_id` y `app.user_id` con `set_config(..., true)`; es la única puerta a la base para código de negocio.
- La empresa y el usuario salen de la sesión del servidor, nunca de los argumentos.
- Una prueba revisa en el catálogo que toda tabla con `tenant_id` tenga RLS forzada.
- Las pruebas de aislamiento corren con el rol `capaz_app`.
- Permisos en tres niveles: identidad, rol en la empresa y módulo (contratado y asignado). Un usuario nuevo no entra a ningún módulo hasta que el administrador se lo asigne.
- `core.modulo_activo(tenant, modulo)` bloquea la escritura de módulos en baja o con la prueba vencida, aunque falle el código.

## Consecuencias
- Cada petición abre una transacción; la latencia hacia la base importa.
- Pieza ya probada en Cotizín (`conEmpresa`), que se porta.
