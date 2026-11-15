# ADR-003: PostgreSQL y Drizzle; alojamiento pendiente

**Estado:** PostgreSQL, Drizzle y alojamiento en Neon aceptados (2026-11-14); región y plan por verificar · **Fecha:** 2026-11-11 · **Decide:** Moisés

## Contexto
El dominio necesita relaciones estrictas y transacciones: deudas ligadas a clientes, ventas con abonos parciales, cotizaciones con partidas, auditoría. Hay que pagar una sola base para todos los módulos.

## Decisión
- Motor: PostgreSQL 18 (local en Docker, puerto 5450).
- Acceso: Drizzle ORM con el controlador `pg` (conexión TCP normal; el servidor corre de forma permanente, no hace falta el controlador serverless).
- SQL estándar: **ninguna función propia de un proveedor**, para poder cambiar de alojamiento.
- Esquemas: `core`, `registro`, `cotizador`.
- Migraciones: `drizzle-kit generate` más archivos SQL propios (RLS, funciones, disparadores) en el mismo historial.
- Dinero en céntimos enteros; solo soles.

## Alojamiento: Neon (decidido 2026-11-14)
Base principal en **Neon** (PostgreSQL), servidor NestJS en un host **por decidir** (Hetzner Ashburn es solo un candidato, no una decisión), archivos en Cloudflare R2. Motivos: Capaz tiene backend, autenticación y ORM propios, así que Auth, Storage y Realtime de Supabase quedarían sin uso; las ramas de Neon dan bases de prueba aisladas para agentes y CI; paga por uso mientras crece. Neon es infraestructura de datos, no dueña de la arquitectura: solo PostgreSQL estándar, migrable con `pg_dump` y `pg_restore`.

Plan: Neon Launch para construir; evaluar Scale (SLA, red privada) antes de los primeros clientes comerciales.

**Condiciones, comprobadas en la fase 10a antes de datos reales:**
1. Elegir el host del servidor comparando al menos 2 o 3 opciones con región cercana a la de Neon (hoy: Virginia); misma zona que la base; medir latencia desde Perú y arranque en frío.
2. PostgreSQL 18, `uuidv7()` y `pg_trgm` disponibles en Neon.
3. Los cuatro roles se crean por SQL sin `BYPASSRLS` (los de la consola de Neon lo traen); correr ahí las pruebas de catálogo y de roles.
4. Migraciones por conexión directa; la app puede usar el pooler solo si `set_config(..., true)` dentro de la transacción se comporta bien (probar).
5. Límite de gasto y alertas configurados; copias independientes y una restauración probada.
6. Desarrollo y pruebas siguen en Docker local; las ramas de Neon son opcionales y de pago por uso (regla 14: no se activan sin orden).

## Región (hallazgo 2026-11-14)
El proyecto de Neon (`erp-microsevicios`) está en **aws-sa-east-1 (São Paulo)**, no en Virginia. El servidor debe ir en la misma región: Hetzner no tiene centro allí y queda descartado; sirven proveedores con región en São Paulo. Neon trae PostgreSQL 18.7, `uuidv7()` y `pg_trgm`; su rol `neondb_owner` tiene `BYPASSRLS`, así que los roles de Capaz se crean por SQL (ADR-011).

## Consecuencias
- Cambiar de proveedor es posible sin reescribir.
- La región de la base condiciona dónde se aloja el servidor.
- Sin dependencias de funciones propias de Neon (regla de SQL estándar).
