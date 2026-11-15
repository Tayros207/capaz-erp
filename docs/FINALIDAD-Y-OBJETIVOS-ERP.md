# Finalidad y objetivos del ERP gráfico-publicitario

> **Nota 2026-11-15 (decisión del usuario):** Capaz es un ERP completo; primero se construye su estructura (núcleo, carcasa, consola, conectores, automatizaciones y módulos clásicos: finanzas ligeras, ventas y CRM, compras, inventario, personal) y **después** se adaptan el Registro por voz y el Cotizador. La sección 7 (alcance de la V1, con inventario y personal fuera) y el orden de la sección 11 quedan superados por `PLAN-DE-CONSTRUCCION.md` versión 3. Siguen vigentes la finalidad, el público, el cobro y las metas del piloto de voz (70 % sin corregir, 30 s), que ahora se miden en la ola 4. Facturación SUNAT y contabilidad formal siguen fuera.

> **Nota 2026-11-14:** pila, esquemas y roles vigentes están en los ADR 002, 003 y 011 (React + Vite y NestJS separados, esquemas `core`, `registro` y `cotizador`). Donde la sección 8 o la 11 hablen de Next.js, de esquemas `public` y `registro` o del catálogo de Cotizín, manda lo anterior.

**Fecha:** 2026-11-10 · **Decide:** Moisés (Keny es el técnico que ayuda a construir) · **Estado:** borrador para aprobar. Donde choque con `ERP-INTERFAZ-ARQUITECTURA.md` o con el catálogo de módulos, manda este documento una vez aprobado.

## 1. Finalidad

Un ERP modular para empresarios de la industria gráfica y publicitaria, en el que casi nada se teclea: el empresario habla desde el celular, el sistema entiende, propone y él aprueba. Los módulos (Registro, Cotizador, CRM) se contratan por separado y se complementan entre sí.

## 2. Por qué existe (motivos)

1. **Dolor operativo:** hoy se registra con Tairos.RC, a nivel aceptable pero sin automatizar; una asistente tarda bastante y el empresario no puede registrar solo con la voz.
2. **Costos:** varias micro-apps implican pagar varias bases de datos (Neon/Supabase) y varios despliegues (Vercel). Un solo ERP paga una base y un despliegue.
3. **Venta modular:** vender a colegas gráficos solo lo que necesitan y ofrecer el resto como complemento, con datos vinculados.
4. **Tendencia:** pasar de un sistema donde las personas digitan a uno donde agentes proponen y las personas aprueban.

## 3. Para quién

Empresarios de la industria gráfica y publicitaria (imprentas, talleres, publicidad). Primero Atlantisgraf como piloto. Usuario principal: el empresario ocupado, sin tiempo de teclado, desde el celular. Secundario: encargado/a o asistente que revisa y corrige, con acceso limitado a saldos y reportes.

## 4. Cómo se gana dinero

Suscripción por módulo, con prueba gratis y baja en solo lectura (nunca se borran datos). Sin pasarela de pago al inicio: los módulos se activan a mano.

## 5. Objetivos medibles de la V1 (piloto de 30 días)

| Medida | Hoy | Meta |
|---|---|---|
| Registros por voz que se aprueban sin corregir | no existe voz | **70 %** |
| Tiempo para registrar un movimiento | ~2 min (estimado por Moisés, no cronometrado) | **30 s** |
| Quién registra | una asistente, con mucho tiempo | el empresario, desde el celular; la asistente solo revisa |

Antes de empezar el piloto se cronometra la situación actual con 10 registros reales, para que la meta se compare con un dato y no con una impresión.

## 6. Cómo funciona el registro por voz

1. El empresario dicta desde el celular (audio corto).
2. El sistema lo convierte en un **borrador** (monto, tipo, contacto, categoría) que no toca los libros.
3. En otro momento, en una **bandeja de revisión**, el empresario o la asistente ve los borradores de ingresos, egresos y deudas, aprueba con un clic o corrige.
4. Solo lo aprobado se guarda como movimiento. Todo queda auditado (quién, cuándo, qué cambió).

La voz captura; no autoriza. Esto cambia el flujo actual de Tairos.RC, que confirma en el momento con una tarjeta: aquí se puede acumular y aprobar después.

**Canal:** micrófono dentro de la app web móvil (PWA). Tairos.RC ya trae la base: el hook `useSpeechRecognition` (Web Speech API del navegador), el chat y la ruta de extracción `/api/extract` con OpenRouter. Quedan fuera por ahora las notas de voz de WhatsApp (requieren la API de Meta Business). Riesgo abierto: el reconocimiento no se ha probado con ruido real de taller; si falla, el plan ya prevé Whisper en servidor como respaldo.

## 7. Alcance de la V1

**Dentro (estructura primero):** el ERP como carcasa (inicio, módulos, acceso por contratación y por usuario, empresa activa), con tres módulos que se irán mejorando uno a uno.

| Módulo | V1 | Después |
|---|---|---|
| **Registro** (base) | Movimientos, deudas, ventas a crédito con abonos parciales, soles, voz con bandeja de revisión | Órdenes, proformas, reportes, papelera |
| **Cotizador** | Lo que ya existe (cotizar, enlace, PDF, WhatsApp) | Puente cotización → orden → cobro |
| **CRM** | Información básica: clientes únicos con datos de contacto e historial | Información que se va sumando (seguimiento, notas, etapas) |

**Fuera de la V1:** inventario y almacén; producción en planta; planilla y RRHH; portal con cuenta propia para clientes; cobro automático de suscripciones; varias monedas; agentes que escriben sin aprobación; app móvil nativa; API pública y reportes a medida; CRM con embudo de ventas; facturación electrónica SUNAT y contabilidad formal.

## 8. Principios de construcción

1. Una sola aplicación Next.js con módulos internos, una sola base (esquemas `public` y `registro`), aislamiento por empresa con RLS.
2. Los módulos no se importan entre sí; se hablan por el núcleo (clientes, empresa) y por eventos.
3. El dinero se guarda en céntimos exactos; solo soles.
4. Un solo registro de herramientas para el agente, con permisos, confirmación y auditoría.
5. Móvil primero. Un solo diseño visual para todo el ERP.
6. Datos limpios antes que agentes: un cliente único, correlativos y categorías consistentes.

## 9. Riesgos

- **Voz con ruido real:** sin audios de taller no se sabe si llega al 70 %. Mitigación: grabar frases reales antes de dar por buena la voz.
- **Pilotos de agentes que no llegan a producción:** se evita con bandeja de revisión, métricas desde el día uno y alcance corto.
- **Dispersión:** tres módulos a la vez. Mitigación: estructura primero, un módulo mejorado por vez.

## 10. Decisiones tomadas y abiertas

Tomadas: lo de las secciones 1 a 7. Nombre: **Capaz ERP** (elegido por Moisés el 2026-11-10; pendiente confirmar disponibilidad en INDECOPI, clases 9 y 42, y dominios). También decididas (2026-11-10): la lista de exclusiones de la sección 7 queda aceptada, y un usuario nuevo no entra a ningún módulo hasta que el administrador se lo asigne. Abiertas: prefijo de rutas del cotizador (`/cotizador`); disponibilidad del nombre; revisión de puntos ciegos por Opus (ver `.claude/memory/project/capaz-erp-finalidad.md`).

## 11. Cambios que este documento obliga a hacer

- `catalogo.ts`: el Registro pasa a ser el módulo base (hoy lo es el Cotizador) y se agrega el módulo CRM.
- `ERP-INTERFAZ-ARQUITECTURA.md`: el orden de fases se reordena (estructura, Registro con voz, CRM básico, puente al final) y la decisión E4 deja de ser la prioridad.
- Nueva tabla de borradores para la bandeja de revisión (la pide el agente de datos).
- Datos de Tairos.RC: solo pruebas, se empieza limpio; se descarta la migración de usuarios y la conciliación al centavo.
