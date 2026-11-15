# Plan de cimientos de Capaz ERP

**Versión 3 · 2026-11-11 · Estado: documento de diseño (qué y por qué).** Complementa `FINALIDAD-Y-OBJETIVOS-ERP.md`, `INTEGRACION-DE-MODULOS.md` y `ARQUITECTURA-DE-MODULOS.md`. Las decisiones están en `docs/adr/`.

> **Para construir se sigue `PLAN-DE-CONSTRUCCION.md`**, que revisa este documento y manda donde choquen. Cambios principales de esa revisión: no se adoptan los paquetes 0.x de NestJS (salida de eventos e idempotencia propias; reemplaza D10, D11 y el paquete G); la puerta HTTP son las herramientas (ajusta D13 y D14); cuatro roles de base y un esquema técnico `auth` (amplía D3); Better Auth se integra sin el paquete comunitario; y el orden pasa de paquetes A a K a fases 0 a 10, con pantallas visibles desde la fase 3.

## 1. Qué son los cimientos y cuándo terminan

Lo que todos los módulos futuros (Registro, Cotizador, CRM y los que vengan) heredan sin reescribirlo: identidad, empresas, permisos por módulo, acceso seguro a datos, una sola puerta para las operaciones, auditoría, eventos entre módulos, contrato entre web y API, y una carcasa de pantalla.

**Cada empresa tiene sus cosas y la plataforma las administra.** Los datos de cada empresa (movimientos, deudas, cotizaciones, clientes) son suyos y están aislados de las demás. Tú y Keny, como plataforma, manejan qué contrata cada una (módulos, planes, precios, vigencia), pero no ven el contenido de su negocio (D25 a D28).

Terminan cuando existe un **corte vertical de referencia** (Clientes del núcleo) que cruza todas las capas, con pruebas que demuestran el aislamiento entre empresas y el bloqueo por módulo. Ese corte es la plantilla de cada módulo nuevo.

## 2. Estado del repositorio hoy

Ubicación: `/home/datayros/Documentos/work/modules/capaz-erp` (repositorio git propio, sin commits).

| Hecho y verificado | Pendiente |
|---|---|
| Monorepo pnpm: `apps/web` (React 19.3, Vite 8.3, Tailwind 4.3, React Router 8.5), `apps/api` (NestJS 12.4), `packages/shared` (Zod 4.6) | Drizzle configurado (solo instalado) |
| TypeScript fijado en 6.0.3 en todo el repositorio | Better Auth |
| PostgreSQL 18.6 local en Docker, puerto 5450 | Esquemas, roles, RLS |
| Ruta `GET /api/health` validada con el contrato compartido; la web la consume | Registro de herramientas, auditoría, permisos |
| Compila; typecheck, lint y 6 pruebas unitarias en verde; la cadena web → API → base probada | Carcasa web |
| ADR 001 a 008 redactados | `AGENTS.md` de Capaz, `pnpm check`, prueba de arquitectura |

Referencia Odoo 20.0 (solo lectura) en `/home/datayros/Documentos/work/referencias/odoo-20.0`.

## 3. Decisiones cerradas

| Tema | Decisión | ADR |
|---|---|---|
| Arquitectura | Monolito modular, no microservicios | 001 |
| Frontend y servidor | React + Vite y NestJS 12, separados; sin Next.js; mismo origen en producción | 002 |
| Base de datos | PostgreSQL 18 + Drizzle; SQL estándar sin funciones de proveedor; esquemas `core`, `registro`, `cotizador` | 003 |
| Aislamiento | `tenant_id` + RLS forzada + rol de aplicación sin `BYPASSRLS` | 004 |
| Operaciones | Registro único de herramientas; el agente no tiene permisos especiales; aprueba el usuario autenticado | 005 |
| Odoo y Python | Se estudia Odoo, no se copia ni se traduce; Python fuera del núcleo, con puerta abierta por API o rol de lectura | 006 |
| Pruebas | Sin e2e; Vitest con base real; revisión visual manual | 007 |
| Registro | Lógica reescrita en TypeScript con equivalencia contra el SQL; voz primero | 008 |

Pendientes de decisión: **dónde se aloja la base** (Neon recomendado; falta medir latencia desde Perú y el arranque en frío), nombre disponible en INDECOPI, y cuándo llamar a Opus.

## 4. Lo que ya existe y se reaprovecha (de Cotizín)

| Pieza | Dónde está | Qué hace | Adaptación |
|---|---|---|---|
| `conEmpresa(ctx, fn)` | `shared/db/con-empresa.ts` (36 líneas) | Abre una transacción, fija `app.tenant_id` y `app.user_id` con `set_config(..., true)`, y evita cambiar de empresa dentro de la misma transacción | Cambiar el cliente de Neon por `pg` |
| `ejecutar()` | `shared/herramientas/ejecutar.ts` (271 líneas) | Contexto del servidor, permisos, esquema estricto, confirmación firmada, salida validada y auditoría | Casi ninguna; no depende de Next |
| Argumentos prohibidos | `ARGUMENTOS_DE_CONTEXTO` | Rechaza que el modelo cuele `empresaId`, `usuarioId`, `permisos` o `canal` | Ninguna |
| Confirmación | `confirmacion.ts` | Token firmado, de un solo uso, ligado a usuario, empresa, argumentos y estado; solo desde la pantalla | Ninguna |
| Permisos por rol | `auth/permisos.ts` | Mapea rol de organización a permisos | Ampliar con permisos por módulo |
| Auditoría | `auditoria*.ts` | Un evento por llamada | Pasar a `core.auditoria` con columna de módulo |
| Pruebas de esas piezas | `*.test.ts`, `tests/db/*` | Cubren lo anterior | Portar junto con el código |

Lección del propio proyecto: Better Auth deja `activeOrganizationId` en nulo al iniciar sesión; hay que fijar la empresa en `session.create.before`.

## 5. Lo verificado sobre NestJS 12 y Better Auth

- **Paquetes oficiales de NestJS con capítulo propio en la documentación:** outbox, idempotency, workflows, locks, mcp, ai, storage, authentication, authorization, drizzle, terminus, resilience, webhooks, schedule, bullmq, config, event-emitter. No verifiqué su madurez: cada uno pasa por prueba de concepto antes de adoptarlo.
- **Better Auth en NestJS** lo mantiene la comunidad (`@thallesp/nestjs-better-auth`, con `@OrgRoles()` y `@RequireActiveOrg()`); no verifiqué su compatibilidad con NestJS 12. Su plugin de organizaciones trae `owner`, `admin` y `member`, y permite roles personalizados.
- Los esquemas Zod se aceptan en las rutas de NestJS 12 (`@Body({ schema })`) y `@nestjs/swagger` 12 los convierte a OpenAPI. No verifiqué cómo generar un cliente tipado para la web desde ahí.

## 6. Decisiones de diseño

| # | Tema | Decisión |
|---|---|---|
| D1 | Esquemas | `core`, `registro`, `cotizador` |
| D2 | Empresa | Columna `tenant_id` (texto, id de organización de Better Auth); variable `app.tenant_id` |
| D3 | Roles de base | `capaz_owner` (migraciones), `capaz_app` (ejecución), `capaz_ro` (futuro, lectura) |
| D4 | RLS | Forzada en toda tabla con `tenant_id`, política única por plantilla |
| D5 | Contexto de petición | `AsyncLocalStorage` con `{ tenantId, userId, rol, permisos, canal, requestId }`; canal ∈ `ui`, `agente`, `mcp`, `sistema` |
| D6 | Permisos | Identidad (Better Auth), rol en la empresa (propietario, administrador, encargado, consulta) y módulo (contratado y asignado); usuario nuevo sin módulos hasta que el administrador los asigne |
| D7 | Bloqueo por módulo | `core.modulo_activo(tenant, modulo)` consultada por la base al escribir, más guardas en la API |
| D8 | Registro de herramientas | Se porta `shared/herramientas` con el campo `modulo` |
| D9 | Auditoría | `core.auditoria`, solo inserción (disparador), sin datos sensibles en claro |
| D10 | Eventos | Tabla de salida en la misma transacción, con reintento y consumidores idempotentes; se evalúa `@nestjs/outbox` antes de construirla |
| D11 | Idempotencia | Cabecera `Idempotency-Key` en operaciones que crean dinero |
| D12 | Respuestas | Contrato `Respuesta<T>` con códigos estables y mensajes en español; HTTP los traduce |
| D13 | API | `/api/v1/{modulo}/…`, validación Zod, OpenAPI desde los mismos esquemas |
| D14 | Cliente web | Cliente tipado `api.get(ruta, esquema)`; TanStack Query para datos del servidor; Zustand solo para estado de pantalla |
| D15 | Configuración | Variables validadas con Zod al arrancar; nadie más lee `process.env` |
| D16 | Registros de actividad | JSON con `requestId`, empresa y usuario; datos personales ocultos |
| D17 | Migraciones | `drizzle-kit generate` más SQL a mano en el mismo historial; ejecutor con el rol propietario |
| D18 | Fronteras entre módulos | Prueba de arquitectura que lee los imports |
| D19 | Datos personales | Inventario de datos, audio sin guardar por defecto, campos de retención (Ley 29733) |
| D20 | Manifiesto de módulo | `dependeDe`, permisos y herramientas declarados; validados al arrancar |
| D21 | Extensión sin herencia | Un módulo extiende a otro con tablas propias y eventos, nunca modificando sus modelos |
| D22 | Dos puntos de entrada | API y trabajador salen del mismo código; hoy en un solo proceso |
| D23 | Límite de tamaño | Archivos de más de 500 líneas se dividen |
| D24 | Servicios en otros lenguajes | Nunca como propietario de la base: por la API o con un rol de lectura sujeto a RLS |
| D25 | Tres niveles de acceso | Plataforma (tú), empresa (su administrador) y usuario; la empresa no se activa módulos sola. Ver `PLATAFORMA-Y-PLANES.md` |
| D26 | Planes y precios | `core.planes`, `core.plan_modulos` y precio acordado por empresa con vigencia; estados prueba, activo, suspendido y baja (solo lectura, sin borrar datos) |
| D27 | Consola de plataforma | Área aparte (`/plataforma`, `/api/v1/plataforma`) para `core.plataforma_admins`; operaciones por funciones controladas con rol propio, todas auditadas |
| D28 | Privacidad frente a la plataforma | La consola ve contratos y cifras de uso agregadas, nunca los datos del negocio de cada empresa |

## 7. Paquetes de trabajo

Tamaños relativos: **S** corto, **M** medio, **L** largo. No estimo horas.

| Paquete | Entrega | Tamaño | Listo cuando |
|---|---|---|---|
| **A. Higiene del repositorio** | `AGENTS.md` de Capaz (reglas para agentes), script `pnpm check`, prueba de arquitectura (D18). Los ADR ya están redactados | S | `pnpm check` en verde y las reglas escritas |
| **B. Configuración, registros y errores** | Variables con Zod, registro JSON, filtro de errores, `requestId`, contexto de petición (D5, D12, D15, D16) | S | Una petición deja su rastro con `requestId` |
| **C. Base de datos** | Drizzle con `pg`, los tres esquemas, roles (D3), plantilla de RLS (D4), `conEmpresa` portado, ejecutor de migraciones, prueba que revisa en el catálogo que toda tabla con `tenant_id` tiene RLS forzada | M | La prueba del catálogo falla si una tabla nueva olvida la RLS |
| **D. Identidad y empresas** | Better Auth con organizaciones, empresa activa fijada al iniciar sesión, registro y creación de empresa | M | Alta de usuario y empresa; dos empresas aisladas en las pruebas |
| **E. Permisos y módulos** | Catálogo de permisos, roles, `core.modulos`, `empresa_modulos`, `usuario_modulos`, `modulo_activo`, manifiestos con `dependeDe`, guardas `@RequireModule` y `@RequirePermission` | M | Usuario sin módulo recibe 403; módulo en baja bloquea escritura aun saltándose la API; el arranque falla ante un ciclo de dependencias |
| **F. Registro de herramientas** | Portar `ejecutar`, confirmación y auditoría; adaptador para rutas HTTP | M | Pruebas portadas en verde y una herramienta de ejemplo de punta a punta |
| **G. Eventos e idempotencia** | Prueba de concepto de `@nestjs/outbox` e `@nestjs/idempotency` frente a una versión mínima propia; ADR con la decisión | M | Un evento de ejemplo se entrega una sola vez aun con reintentos |
| **H. Contrato web ↔ API** | Pipe de Zod, OpenAPI, cliente tipado, `GET /me`, mapeo de errores | S | La web consume `/me` con tipos y un cambio de esquema rompe el tipo |
| **I. Carcasa web** | Rutas y layouts, pantallas de acceso, inicio con tarjetas de módulos, barra lateral, selector de empresa, tokens Pliego, formato de soles | L | Navegación por módulo según contratación y asignación, revisada a 390 y 1280 px |
| **J. Corte de referencia: Clientes** | Tabla `core.clientes`, herramientas, API, lista y alta en pantalla | M | Cruza todas las capas; sirve de plantilla y base del CRM |
| **K. Consola de plataforma** | Pantallas de empresas, ficha con interruptores de módulo, planes y precios, solicitudes y vencimientos; «Usuarios y accesos» para cada empresa (D25 a D28; ver `PLATAFORMA-Y-PLANES.md`) | L | Activar, suspender y dar de baja un módulo a una empresa desde la pantalla, con precio y vigencia, y todo auditado; un usuario sin módulo no entra |

El paquete **E** incluye además las tablas de planes, precios, suspensión, `usuario_modulos` y solicitudes de módulo.

**Orden:** A → (B y C en paralelo) → D → E → F → (G y H en paralelo) → I → J → K. La consola K debe existir **antes del segundo cliente**; para el piloto de una sola empresa, los módulos se activan con la función de base de datos.

**Primeros pasos al aprobar (paquete A):**
1. Escribir el `AGENTS.md` de Capaz con las reglas de los ADR.
2. Añadir `pnpm check` (typecheck, lint y pruebas de todo el repositorio).
3. Escribir la prueba de arquitectura que falla si un módulo importa a otro.
4. Primer commit del repositorio (con tu permiso).

### Interfaz de referencia (indicada por el usuario el 2026-11-10; a confirmar con la imagen)

1. **Inicio `/inicio` (hub):** saludo, buscador global y una tarjeta por módulo. Cada tarjeta muestra su estado: activo, en prueba (con días), en baja (solo lectura), no contratado (con «Solicitar»), o «sin acceso, pide a tu administrador» cuando el módulo está contratado pero el usuario no lo tiene asignado.
2. **Dentro de un módulo:** barra lateral solo con sus secciones y un encabezado delgado con Inicio, migas, búsqueda del módulo, filtros, notificaciones, ayuda, selector de empresa y usuario; sin pestañas.
3. **Móvil:** barra inferior con 4 destinos y «Más». **Tableta:** barra lateral solo con íconos.
4. **Consola de plataforma:** área aparte (`/plataforma`), con el mismo lenguaje visual (paquete K).
5. **Diseño visual:** sistema Pliego (papel cálido, tinta, colores de proceso cian, magenta y amarillo; modo claro y oscuro). El aspecto definitivo se confirma con la imagen de referencia que el usuario mencionó; no la tengo en esta conversación.

## 8. Pruebas de los cimientos (ADR-007)

- Unitarias en Vitest para reglas y herramientas.
- De integración contra PostgreSQL 18 real con el rol `capaz_app`: aislamiento entre dos empresas por cada tabla (generado desde el catálogo), inmutabilidad de la auditoría, bloqueo por módulo.
- De arquitectura: fronteras entre módulos y RLS forzada.
- De contrato: los esquemas compartidos validan lo que responde la API.
- Visual manual: cada pantalla nueva se revisa a 390 y 1280 px en claro y oscuro.

## 9. Visión a futuro: cuándo se trae cada mejora

| Mejora | Se trae cuando |
|---|---|
| Agente de Registro (AI SDK o `@nestjs/ai`) | El corte de voz del Registro esté listo para medir |
| Servidor MCP (`@nestjs/mcp`) | Exista una segunda herramienta de escritura probada y un cliente externo que la pida |
| Procesos duraderos (`@nestjs/workflows`) | Una operación deba esperar una aprobación durante horas o días |
| Almacenamiento de archivos (R2, `@nestjs/storage`) | Haya adjuntos o PDFs que conservar |
| Webhooks y WhatsApp (`@nestjs/webhooks`) | El puente cotización → orden necesite avisar al exterior |
| Límite de peticiones (`@nestjs/throttler`) | Antes del primer cliente externo |
| Cobro automático de suscripciones | Más de unos pocos clientes de pago |
| Sentry y OpenTelemetry | Primer despliegue en producción |
| Copias de seguridad y recuperación a un punto en el tiempo | Antes de datos reales de clientes |
| Exportación y borrado de datos por empresa | Antes del primer cliente externo (Ley 29733) |
| `pgvector` y capa semántica | Una pregunta del agente que la base estructurada no pueda responder |
| Servicio en Python (análisis, predicción, audio) | Una necesidad que TypeScript no cubra bien; ver ADR-006 |
| Paquete regional `es-PE` separado | Primer cliente fuera de Perú |
| Funciones por empresa (feature flags) | Haya clientes en versiones distintas |
| Trabajo sin conexión (PWA) | La voz en el taller sufra por mala señal |
| Conector con Odoo | Un cliente pida inventario, planilla o contabilidad completa |

No se activa **NestJS Observe** (servicio externo de pago) sin que lo pidas.

## 10. Pruebas de concepto antes de adoptar

1. Better Auth con sus tablas en el esquema `core` y su integración con NestJS 12.
2. `@nestjs/outbox` e `@nestjs/idempotency` frente a una versión mínima propia.
3. Drizzle con varios esquemas y políticas RLS escritas en el propio esquema.
4. `set_config(..., true)` con la conexión de Neon (directa o con pooler) y el costo de los viajes por petición.
5. Esquemas Zod en las rutas de NestJS 12, su conversión a OpenAPI y la generación del cliente tipado.

## 11. Riesgos

- **Latencia hacia la base:** cada petición abre una transacción y fija dos variables; medir antes de fijar la región.
- **Paquetes nuevos de NestJS:** pueden estar poco probados; por eso van a prueba de concepto.
- **Cambios sin confirmar en Cotizín:** tomar copia limpia antes de portar código.
- **Sin e2e:** se pierde la detección automática de fallos de pantalla; la revisión manual lo reemplaza.
- **Alcance:** diez paquetes son muchos; A a E ya dan una base segura aunque F a J tarden.

## 12. Decisiones que necesito del usuario

1. **Aprobar este plan** y empezar por el paquete A.
2. **Permiso para un commit en Cotizín** que deje su estado actual a salvo antes de portar código.
3. **Cuándo llamar a Opus:** mi sugerencia es antes del paquete C, que es lo más caro de corregir después.
4. **Alojamiento de la base:** confirmar Neon con la medición previa de latencia, o elegir otra opción (ADR-003).
6. **Imagen de la interfaz de referencia:** el usuario dijo haberla pasado, pero no está en la conversación; reenviarla o indicar cuál de sus capturas es.
5. ~~Consola de plataforma y CRM~~ **Decidido el 2026-11-11** (`PLATAFORMA-Y-PLANES.md` sección 8): CRM con la misma pieza para operador y empresas; precios por módulo y paquetes con precio especial por empresa; consola antes del segundo cliente.
