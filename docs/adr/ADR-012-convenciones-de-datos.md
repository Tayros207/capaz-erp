# ADR-012: Convenciones de datos

**Estado:** aceptado con el inicio de la construcción · **Fecha:** 2026-11-14 · **Decide:** Moisés

## Decisión
- `tenant_id text` (id de organización de Better Auth). Identificadores `uuid` con `uuidv7()` (confirmado en PostgreSQL 18.6 local y 18.7 en Neon).
- `timestamptz` siempre. Zona horaria por empresa (`America/Lima` por defecto) para los cortes de día.
- **Llaves foráneas compuestas con `tenant_id`** y `unique (tenant_id, id)` en toda tabla que otra referencie: una llave foránea no pasa por la RLS.
- Correlativos por empresa con bloqueo de fila en `core.contadores`.
- Dinero en céntimos enteros (`bigint`); precios unitarios en milésimas. Los movimientos de dinero se anulan, no se editan ni se borran.
- Una migración que deba tocar filas de varias empresas quita `FORCE` al empezar y vuelve a llamar a `aplicar_aislamiento` al terminar, en la misma transacción.

## Consecuencias
- Un dato de una empresa no puede apuntar a otra aunque el código falle.
- Cortes de día correctos para empresas en zonas distintas.
