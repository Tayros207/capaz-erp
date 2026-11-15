# Cómo entran Cotizín y Tairos.RC en Capaz ERP

> **Nota 2026-11-15:** el orden de la sección 4 (voz primero) quedó superado. Cotizín y Tairos.RC entran en la **ola 4** (`PLAN-DE-CONSTRUCCION.md` versión 3, fases 21 a 23), sobre la estructura ya construida: el dinero del Registro llega antes, como Finanzas ligeras con pantallas tradicionales (fase 14, ola 2), con las mismas pruebas de equivalencia de la sección 5. El resto de este documento (qué se porta y adónde, se copia y no se mueve) sigue vigente.

**Fecha:** 2026-11-11 · **Estado:** plan aprobado en sus decisiones de fondo; falta la revisión de puntos ciegos. Complementa `FINALIDAD-Y-OBJETIVOS-ERP.md`.

Regla general: **se copia, no se mueve.** Cotizín y Tairos.RC siguen funcionando tal como están durante el piloto. Capaz toma de ellos lo útil y se prueba por separado.

## 1. Decisiones tomadas (2026-11-11)

| Tema | Decisión | Motivo |
|---|---|---|
| Esquemas de la base | Tres: `core`, `registro`, `cotizador` | Fronteras claras desde la primera migración |
| Lógica de dinero del Registro | Se reescribe en TypeScript; las funciones SQL sirven de referencia en pruebas de equivalencia | Una sola implementación compartida por pantalla, voz y agente |
| Pantallas del Registro | Voz primero; se porta solo lo que la voz necesita, adaptado al diseño Pliego; el resto después | El dolor principal y la meta del piloto son la voz (70 % sin corregir, 30 s por registro) |
| Pruebas | Sin e2e. Vitest unitarias y de integración del servidor contra una base real, más revisión visual manual a 390 y 1280 px | Regla del usuario |

## 2. Qué hay hoy

| | Cotizín | Tairos.RC (Registro) |
|---|---|---|
| Líneas (sin pruebas) | ≈ 20.600 | ≈ 30.000 |
| Pruebas | 87 unitarias, 18 de base | 52 unitarias, 12 de SQL (16 e2e, no se traen) |
| Base | Neon + Drizzle | Supabase |
| Lógica de negocio | TypeScript: 92 herramientas registradas | 23 funciones SQL en la base |
| Acoplamiento a Next | 38 de 370 archivos | 61 de 246 archivos |
| Servidor | 1 ruta de herramientas + 4 | 28 rutas de API |
| Pantallas | 12 | 15 |

Trabajo de datos ya hecho para el Registro en el repositorio de Cotizín (diseño anterior, con esquemas `public` y `registro`): `src/shared/db/esquema/registro.ts` (265 líneas), `drizzle/0016_registro_y_modulos.sql` (480), `drizzle/0019_registro_funciones.sql` (1.426, 19 funciones) y las pruebas `tests/db/registro-*.test.ts`. Se usa como referencia y punto de partida, no se copia sin revisar: depende de tablas y funciones de Cotizín (`modulo_activo`, `contadores`, clientes unificados).

## 3. Dónde cae cada pieza

| Origen | Destino en Capaz |
|---|---|
| Cotizín `shared/herramientas` (registro de herramientas, confirmación en dos pasos, auditoría) | `apps/api/src/core/herramientas` (casi sin cambios) |
| Cotizín motores (costeo, imposición, precio por escala) | `apps/api/src/modules/cotizador/` (solo servidor, como hoy) |
| Cotizín herramientas y repositorios Neon | `apps/api/src/modules/cotizador/`, esquema `cotizador` |
| Cotizín `POST /api/herramientas` | Controlador de NestJS que llama a `ejecutar()` |
| Cotizín páginas y componentes (116 `use client`) | `apps/web/src/modules/cotizador/` y `apps/web/src/shared/ui` |
| Cotizín Tailwind 3 + tokens Pliego | Tailwind 4: tokens a `@theme` en CSS |
| Cotizín `next/link`, `next/navigation`, `next/headers`, `next/font` | React Router, sesión desde la API, fuente en CSS |
| Cotizín página pública `/c/[token]`, PDF | La API genera el HTML sin JavaScript y el PDF en Node |
| Tairos las 23 funciones SQL | Servicios TypeScript en `apps/api/src/modules/registro/` |
| Tairos 28 rutas de API | Herramientas registradas, expuestas por `POST /api/v1/herramientas/:nombre` (ADR-009) |
| Tairos `extract` y `chat` (interpretación) | `apps/api/src/modules/registro/` con AI SDK |
| Tairos pantallas | `apps/web/src/modules/registro/`, con el diseño Pliego |
| Tairos tablas | Esquema `registro`, con `tenant_id` y RLS |

## 4. Fases

| Fase | Entrega | Listo cuando |
|---|---|---|
| 0 | Esquemas `core`, `registro`, `cotizador`; Drizzle; rol de aplicación sin `BYPASSRLS`; Better Auth con empresas y permisos por módulo | Pruebas de aislamiento entre empresas con el rol de la aplicación pasan |
| 1 | Registro de herramientas y auditoría; carcasa web (inicio, módulos, acceso por usuario) con el kit de Cotizín | Un usuario sin módulo asignado no entra |
| 2 | Registro, corte de voz: servicios TypeScript de movimientos, deudas y abonos con equivalencia contra el SQL; captura por voz; borradores; bandeja de revisión; lista de movimientos; deudas y abonos | Cálculos idénticos al original en los casos de referencia y flujo voz → borrador → aprobar funcionando desde el celular |
| 3 | Medición con audios reales de taller | Se mide el porcentaje sin corregir y el tiempo por registro |
| 4 | Cotizador completo | Los casos de referencia dan los mismos precios que en Cotizín |
| 5 | Registro, resto: órdenes, proformas, recibos, reportes, papelera | Equivalencia por función |
| 6 | Puente cotización → orden → cobro | Idempotente: aprobar dos veces no crea dos órdenes |

## 5. Pruebas de equivalencia (Registro)
Para cada función SQL de Tairos.RC se escribe una versión en TypeScript y se prueban ambas con los mismos casos: montos con céntimos, abonos parciales, anulaciones, reactivaciones y borrados. Se comparan los saldos resultantes. El SQL queda solo como referencia en las pruebas y se retira cuando hay paridad. La base conserva restricciones de integridad, RLS y disparadores de inmutabilidad: son protección y no lógica de negocio.

## 6. Riesgos
1. **Cambios sin confirmar en Cotizín** (incluido el trabajo de datos): antes de copiar, tomar una copia limpia de ese estado.
2. **Sin e2e** se pierde la detección automática de fallos visuales: revisar capturas a 390 y 1280 px a mano en cada pantalla.
3. **Reglas de dinero:** el riesgo principal al reescribir; se cubre con la sección 5.
4. **Dos estilos visuales:** Tairos.RC debe adoptar el diseño Pliego al portarse.
5. **Tailwind 3 → 4:** el archivo de configuración se reemplaza por tokens en CSS; revisar contraste en modo claro y oscuro.
6. **Voz con ruido real:** sin audios del taller no se sabe si llega a la meta; la fase 3 lo mide antes de seguir.

## 7. Pendiente
Revisión de puntos ciegos por Opus; elección de región de Neon y del alojamiento del servidor tras medir latencia; confirmación de disponibilidad del nombre.
