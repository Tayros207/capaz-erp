# ADR-001: Monolito modular, no microservicios

**Estado:** aceptado · **Fecha:** 2026-11-11 · **Decide:** Moisés

## Contexto
Capaz ERP tendrá varios módulos (Registro, Cotizador y los que vengan) que se venden por separado y deben poder vincularse. El equipo es de dos personas y la meta económica es pagar una sola base y un solo despliegue. Se estudió Odoo 20.0 (también un monolito modular) y se descartó construir microservicios.

## Decisión
Una sola aplicación y una sola base de datos, dividida en módulos con fronteras claras. Cada módulo vive en su carpeta, declara un manifiesto con sus dependencias y se comunica con los demás por el núcleo y por eventos. El código de todos los módulos está siempre desplegado; `empresa_modulos` decide cuál usa cada empresa.

## Consecuencias
- Un solo despliegue y un solo costo de base de datos.
- Las fronteras se hacen cumplir con una prueba de arquitectura, porque el compilador no las impone.
- Si un módulo necesitara vivir aparte, su carpeta ya está aislada.
- Detalle: `docs/ARQUITECTURA-DE-MODULOS.md`.
