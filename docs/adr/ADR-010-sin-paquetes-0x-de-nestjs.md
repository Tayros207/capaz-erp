# ADR-010: Sin paquetes 0.x de NestJS en los cimientos

**Estado:** aceptado con el inicio de la construcción · **Fecha:** 2026-11-14 · **Decide:** Moisés

## Contexto
Verificado el 2026-11-11: `@nestjs/drizzle` 0.0.2, `@nestjs/idempotency` 0.0.4 (sin almacén para PostgreSQL), `@nestjs/outbox` 0.1.4, `@nestjs/authentication` 0.1.5, `@nestjs/authorization` 0.1.3.

## Decisión
No se adoptan. Módulo de base, salida de eventos (≈150 líneas) e idempotencia (≈50 líneas) propios, sobre PostgreSQL. Se reevalúan al llegar a 1.0, con una prueba de concepto antes.

## Consecuencias
- Menos dependencias inmaduras en el núcleo.
- Más código propio, pero pequeño y con pruebas.
