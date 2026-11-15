# ADR-011: Cuatro roles de base, esquema `auth` y ninguna función `security definer` sobre datos con RLS

**Estado:** aceptado con el inicio de la construcción · **Fecha:** 2026-11-14 · **Decide:** Moisés · **Amplía:** ADR-004

## Contexto
Probado en PostgreSQL 18.6 con un dueño sin superusuario: una política solo para `capaz_app` más funciones `security definer` del dueño hace que `modulo_activo` devuelva falso y que `activar_modulo` falle (la RLS forzada también aplica al dueño). En Neon, además, el rol `neondb_owner` trae `BYPASSRLS`.

## Decisión
- `capaz_owner`: dueño de todo, solo corre migraciones. **Sin superusuario ni `BYPASSRLS`, también en local.** Se crea por SQL.
- `capaz_auth`: solo el esquema `auth` (tablas de Better Auth).
- `capaz_app`: negocio. Sin `BYPASSRLS`, sin propiedad de tablas, **sin acceso a `auth`**. Ve a los miembros de su empresa por la vista `core.v_miembros`.
- `capaz_sistema`: lo que cruza empresas (consola y relevo de eventos). Solo las tablas de la lista de plataforma, con política `plataforma` explícita y permisos por columna cuando la tabla lleva datos de negocio. Sin acceso a `registro`, `cotizador` ni clientes.
- La política de aislamiento va **sin cláusula `TO`**. Toda función corre con los permisos de quien llama y nace sin permiso para `PUBLIC`.
- Los esquemas de negocio son `core`, `registro` y `cotizador`; `auth` es solo para la librería.

## Consecuencias
- El entorno local falla igual que producción.
- Cada tabla y función recibe sus permisos explícitos; tres pruebas de catálogo lo vigilan (RLS, llaves compuestas y funciones).
