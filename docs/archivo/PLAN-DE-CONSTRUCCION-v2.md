# Plan de construcción de los cimientos de Capaz ERP

**Versión 2 · 2026-11-14 · Para: el agente que construye (por ejemplo Sonnet) y quien lo supervisa.**
Este documento dice **cómo** construir, paso a paso. El **qué y el porqué** están en `PLAN-CIMIENTOS.md`, `ARQUITECTURA-DE-MODULOS.md`, `PLATAFORMA-Y-PLANES.md`, `MODULOS-Y-MERCADO.md` (catálogo de módulos, mercado y olas) y `docs/adr/`. Si algo choca, **manda este documento**. La versión 1 queda en `docs/archivo/PLAN-DE-CONSTRUCCION-v1.md` solo como historial: no se sigue.

---

## 0. Cómo usar este plan

1. Se trabaja **una fase (o subfase) por sesión**, en el orden de la sección 4. No se empieza una si la anterior no cumple su «Hecho cuando».
2. Al abrir la sesión: leer este archivo completo, la fase que toca y los archivos que esa fase menciona. Nada más.
3. Al cerrar: correr `pnpm check`, pegar el resultado en el informe, actualizar la fila de la fase en la sección 7 y hacer un commit (`fase-N: resumen`). Sin permiso de commit del usuario, dejar los cambios sin confirmar y decirlo.
4. Informe de cierre, siempre con este formato: **qué se hizo · qué se verificó (comando y resultado) · qué no se hizo y por qué · desviaciones del plan · revisión visual pendiente (lista de pantallas) · qué necesita el usuario**.
5. Si un paso no se puede cumplir como está escrito, **se para y se pregunta**; no se inventa un rodeo. Cada fase trae su lista de «Parar y preguntar si».
6. **Lo que el constructor no puede comprobar, no lo da por comprobado.** La revisión visual en el navegador es de una persona (regla 17): la fase queda «hecha, falta revisión visual» hasta que el usuario la confirme. Lo que sí debe comprobar el constructor son los recorridos por HTTP real (servidor levantado en un puerto libre y `fetch` con cookies), que son pruebas de integración del servidor y no e2e.

## 1. Reglas del constructor (no negociables)

1. **Las versiones instaladas son más nuevas que tu memoria.** Instaladas hoy: NestJS 12.4, React 19.3, React Router 8.5, Vite 8.3, Tailwind 4.3, Zod 4.6, TypeScript 6.0.3, Vitest 4.1, `drizzle-orm` 0.45, `drizzle-kit` 0.31, `pg` 8.23. Better Auth aún no está instalado (se agrega en la fase 3a; la 1.7 pide `drizzle-orm` ^0.45.2, que ya se cumple). Antes de usar una API, léela en `node_modules/<paquete>` o en su documentación oficial (NestJS: `https://docs.nestjs.com/llms.txt`). No escribas de memoria.
2. **Una sola puerta a la base:** el código de negocio solo toca la base dentro de `conEmpresa(ctx, fn)`. Solo `infra/database` crea conexiones. Solo `infra/config` (servidor) y `scripts/config.ts` (scripts) leen `process.env`.
3. **Una sola puerta a las operaciones:** toda operación de negocio es una herramienta registrada y pasa por `ejecutar()`. Tampoco se dejan abiertas las rutas de Better Auth que hacen lo mismo por otro lado (fase 3a, paso 5).
4. **La empresa, el usuario y los permisos salen de la sesión del servidor.** Nunca de argumentos, cabeceras propias ni del cuerpo. En TypeScript el contexto se llama como en Cotizín: `empresaId`, `usuarioId`. `tenant_id` es solo el nombre de la columna y de la variable de sesión de la base.
5. **Toda tabla con `tenant_id` se protege** con `select core.aplicar_aislamiento('esquema.tabla')` en su migración, **toda llave foránea entre tablas con `tenant_id` es compuesta** (`(tenant_id, x_id)` → `(tenant_id, id)`), porque una llave foránea no pasa por la RLS, y **todo índice empieza por `tenant_id`** (salvo la clave primaria; ADR-013). Tres pruebas de catálogo lo exigen.
6. **Nunca `drizzle-kit push`.** Solo `generate` más migraciones SQL a mano (`generate --custom`).
7. **Un módulo no importa a otro.** `core` no importa de `modules`. `infra` no importa de nadie. Una prueba lo exige.
8. **Sin e2e** (ni Playwright ni pruebas de navegador). Vitest unitarias y de integración contra PostgreSQL real.
9. **Dinero:** céntimos enteros. En la base `bigint`; en Drizzle `bigint(..., { mode: 'number' })`; en TypeScript el tipo `Centimos` (entero seguro, validado con Zod). Precios unitarios en milésimas, igual. Nunca decimales en `number`. Formato de salida `S/ 1,234.50` (locale `es-PE`).
10. **Nombres:** dominio y módulos en español sin tildes en identificadores (`conEmpresa`, `herramientas`, `clientes`), como en Cotizín, para portar sin renombrar. Infraestructura técnica (`infra/`) en inglés. Archivos en `kebab-case`. Textos de pantalla y mensajes de error en español.
11. **Archivos de más de 500 líneas se dividen.** Funciones de más de 50, también.
12. **No se copia ni se traduce código de Odoo.** Se puede leer en `/home/datayros/Documentos/work/referencias/odoo-20.0`. **Tampoco se copian de Odoo ni de ningún otro ERP:** textos, iconos, CSS, nombres de pantallas o componentes, marca, colores distintivos, cifras de diseño (tamaños, radios, curvas) ni maquetas casi idénticas. Odoo es solo inspiración de ideas genéricas de uso; todo se nombra, dibuja y mide de forma propia (regla del usuario, 2026-11-15).
13. **Cotizín y Tairos.RC son de solo lectura.** No se modifica nada allí. Las fuentes de Cotizín se leen de la copia de referencia que deja la fase 0 (varias no están confirmadas en git).
14. **No se activan servicios externos ni de pago** (NestJS Observe, Sentry, Neon, correo, modelos de IA) sin orden del usuario.
15. **No se agregan dependencias fuera de las que nombra este plan** sin preguntar. En particular, no se adoptan paquetes con versión 0.x de NestJS (ver sección 2).
16. **Secretos:** solo en `.env` (ignorado por git). `.env.example` lleva los nombres con valores de desarrollo. El servidor en ejecución **no recibe** la credencial del dueño de la base.
17. **Pantallas:** móvil primero. Cada pantalla nueva se revisa a 390 px y 1280 px, en claro y oscuro. La revisa una persona; el constructor deja la lista en el informe (sección 0, punto 6).
18. **Ninguna función `security definer` sobre tablas con RLS.** Lo que cruza empresas lo hace el rol `capaz_sistema`, con una política y permisos explícitos, tabla por tabla. Toda función nace sin permiso para `PUBLIC`.
19. **Las cuentas de usuario son globales** (una persona puede estar en varias empresas). Nadie de una empresa puede cambiar el correo ni la contraseña de otra persona.
20. **Un solo catálogo de códigos de error** (`@capaz/shared`), con los nombres de Cotizín. No se inventa un código en un archivo suelto.

## 2. Qué cambió en la versión 2, y por qué

Revisión del 2026-11-14 contra el código real de Cotizín, de Tairos.RC y de este repositorio, con pruebas en PostgreSQL 18.6 local usando un dueño **sin** superusuario (bases y roles temporales, ya borrados).

### 2.1 Errores de la versión 1 que habrían roto la construcción

| Hallazgo | Evidencia | Corrección |
|---|---|---|
| **La seguridad de la base solo funcionaba con superusuario.** La versión 1 ponía la política `aislamiento` solo para `capaz_app`, forzaba la RLS y declaraba `modulo_activo` y `activar_modulo` como `security definer` del dueño | Probado: con un dueño normal, `modulo_activo` devuelve **falso** aunque el módulo esté activo, y `activar_modulo` falla con «violates row-level security policy». En local no se veía porque el usuario `capaz` del contenedor es superusuario con `BYPASSRLS` | Fase 2: el dueño local es `capaz_owner`, sin superusuario, igual que en producción. La política va **sin cláusula `TO`** (como en Cotizín). `modulo_activo` y `exigir_modulo` corren con los permisos de quien llama. Lo que cruza empresas usa `capaz_sistema` con política `plataforma` explícita (regla 18). Probado que así funciona |
| El contrato `Respuesta<T>` de la fase 1 no era el de Cotizín | `cotizin/src/shared/herramientas/tipos.ts` tiene tres formas (éxito con `avisos` y `recibo`, rechazo con `candidatas`, y `requiereConfirmacion`). La fase 5 necesita la tercera; la voz necesita `candidatas` | Fase 1: el contrato completo desde el inicio |
| Dos juegos de códigos de error | La versión 1 decía `entrada_invalida`; Cotizín y sus 402 líneas de pruebas dicen `argumentos_invalidos`, `argumento_prohibido`, `herramienta_desconocida`, `confirmacion_*` | Regla 20 y fase 1: un catálogo, con los nombres de Cotizín |
| Nombres del contexto distintos de los del código a portar | Versión 1: `tenantId`, `userId`. `ejecutar.ts` y `con-empresa.ts` usan `ctx.empresaId`, `ctx.usuarioId` | Regla 4 |
| El token de confirmación «de un solo uso» no tenía dónde guardarse | Cotizín reserva el `jti` en la tabla de auditoría y luego **actualiza** esa fila. La `core.auditoria` de la versión 1 rechaza `update` | Fase 5a: tabla `core.confirmaciones_usadas`; la auditoría es solo inserción |
| El paquete de dinero no lo construía ninguna fase | `dinero.ts` aparecía en la estructura y la fase 4 ya guarda precios en céntimos | Fase 1, paso 5 |
| Las fuentes a portar no están a salvo | En Cotizín están **sin confirmar en git**: `drizzle/0016` a `0020`, `src/shared/modulos/`, `src/shared/components/erp/`, `esquema/modulos.ts`, `esquema/registro.ts`; y con cambios sin confirmar `con-empresa.ts`, `migrar.ts`, `auth/servidor.ts` | Fase 0, paso 1 |

### 2.2 Huecos de seguridad cerrados

| Hueco | Corrección |
|---|---|
| «La contraseña la restablece el administrador de la empresa»: como las cuentas son globales, el administrador de la empresa A podría entrar a la empresa B de ese usuario | Regla 19. Hasta tener correo, el enlace de restablecimiento lo genera solo la plataforma (`pnpm plataforma restablecer`) |
| Un miembro expulsado seguía entrando mientras durara su sesión (caché de cookie de 5 minutos y empresa activa guardada en la sesión) | Fase 3a: el guardia comprueba la membresía en cada petición; hay prueba |
| Las rutas propias de Better Auth (`/api/auth/organization/*`) dejaban crear o borrar empresas e invitar gente sin pasar por las herramientas, la auditoría ni los límites | Fase 3a, paso 5: lista blanca de rutas de `/api/auth` |
| Cualquiera podía registrarse, crear empresas sin límite y obtener una prueba gratis por cada una | Variable `ALTA_DE_EMPRESAS` (`plataforma` por defecto; decisión 4 de la sección 8) |
| Una fila de la empresa A podía apuntar a una fila de la empresa B (las llaves foráneas no pasan por la RLS) | Regla 5: llaves compuestas, como ya hace Cotizín. Probado |
| `capaz_sistema` podía leer la carga de los eventos de salida, que lleva datos de negocio | Fase 8: permisos por columna; el relevo no lee `carga`. Probado |
| La prueba de «la plataforma no ve datos de negocio» era una lista de tablas prohibidas: una tabla nueva quedaba fuera | Fases 4 y 9: lista de lo **permitido**; todo lo demás falla |
| En PostgreSQL toda función nueva es ejecutable por `PUBLIC` | Fase 2: `alter default privileges … revoke execute on functions from public` y prueba de catálogo. Probado |
| El servidor recibía la credencial del dueño de la base | Fase 1: solo los scripts de migración la leen |

### 2.3 Mejoras de diseño y de orden

- **Ruta al piloto** (sección 4): el Registro por voz ya no espera a los eventos ni a la consola. La fase 10 se parte en 10a (despliegue del piloto, antes de datos reales) y 10b.
- **Pista de voz en paralelo** (sección 4): audios reales y medición de la situación actual, sin código, antes de invertir en la voz.
- **Fases grandes partidas** (3, 5, 6, 9) en subfases con su propio «Hecho cuando»: caben en una sesión.
- **Clientes del núcleo según lo que el Registro ya necesita:** columna `tipo` (`cliente`, `proveedor`, `ambos`), nombre normalizado, búsqueda por parecido y fusión, como en Cotizín y en Tairos.RC (`contactos`).
- **Módulo en baja = solo lectura, también en `ejecutar()`:** las herramientas de lectura siguen funcionando; las demás responden `modulo_solo_lectura`.
- **Auditoría:** el éxito se guarda en la misma transacción que la operación; el rechazo, en una propia. Se agregan `entidad_tipo`, `entidad_id` y un `resumen` con los campos que cada herramienta declara seguros.
- **Relevo de eventos sin sondeo cada segundo** (mantendría despierta, y cobrando, una base de pago por uso): despierta por señal del propio proceso y hace un barrido de respaldo.
- **Documentos desfasados:** la fase 0 los pone al día para que ningún agente lea «Next.js» o «tres roles».
- **Después de la revisión (2026-11-14, tarde):** el ADR-013 fija extensibilidad y escalabilidad (índices por `tenant_id`, `datos_extra`, productos y sucursales en el núcleo); el ADR-014 propone conectores y automatizaciones (fase 11); la facturación electrónica SUNAT es la fase 12, al final. `MODULOS-Y-MERCADO.md` v2 recoge el catálogo, el mercado y las olas.

### 2.4 Sigue vigente de la versión 1 (verificado el 2026-11-11)

| Hallazgo | Decisión |
|---|---|
| Paquetes de NestJS muy nuevos: `@nestjs/drizzle` 0.0.2, `@nestjs/idempotency` 0.0.4 (sin almacén para PostgreSQL), `@nestjs/outbox` 0.1.4, `@nestjs/authentication` 0.1.5, `@nestjs/authorization` 0.1.3 | No se adoptan. Módulo de base, salida de eventos e idempotencia propios. Se reevalúan al llegar a 1.0 |
| `drizzle-kit` genera `ENABLE ROW LEVEL SECURITY` pero no `FORCE` ni `GRANT` | La seguridad va en SQL a mano. No se declaran políticas en el esquema de Drizzle |
| Varios esquemas y llaves foráneas entre esquemas funcionan en `drizzle-kit` | Un esquema por módulo |
| `uuidv7()` existe en PostgreSQL 18 | `uuid` con `default uuidv7()`. Confirmar en el proveedor de producción; si no, `gen_random_uuid()` |
| La variable de empresa vuelve a cadena vacía, no a nulo | La política compara con `NULLIF(current_setting('app.tenant_id', true), '')` |
| `@thallesp/nestjs-better-auth` declara compatibilidad con NestJS 12 | No se usa: el guardia propio hace falta igual. Integración directa con `toNodeHandler` y `auth.api.getSession` |
| `StandardSchemaValidationPipe` existe en `@nestjs/common` 12.4 (comprobado en `node_modules`) | Se usa en las pocas rutas REST; las herramientas validan en `ejecutar()` |
| Hetzner tiene centro en Ashburn, Virginia | Candidato de alojamiento. **Sin medir** |

### 2.5 Decisiones que el usuario debe aprobar (la fase 0 las convierte en ADR 009 a 012)

- **ADR-009. La puerta HTTP son las herramientas.** `POST /api/v1/herramientas/:nombre` ejecuta una herramienta registrada. `@capaz/shared` exporta el mapa de contratos (entrada y salida Zod por herramienta) y el cliente web queda tipado por ese mapa, sin generar código. Las rutas REST clásicas se agregan solo cuando un tercero las necesite, como envoltorios de las mismas herramientas.
- **ADR-010. Sin paquetes 0.x de NestJS en los cimientos.** Salida de eventos e idempotencia propias, sobre PostgreSQL.
- **ADR-011. Cuatro roles de base, un esquema técnico `auth` y ninguna función `security definer` sobre datos con RLS.**
  - `capaz_owner`: dueño de todo; solo corre migraciones. **Sin superusuario y sin `BYPASSRLS`, también en local.** Como la RLS es forzada, sin empresa fijada no ve filas.
  - `capaz_auth`: solo el esquema `auth` (tablas de Better Auth). Lo usa únicamente la librería de autenticación y el guardia.
  - `capaz_app`: negocio. Sin `BYPASSRLS`, sin propiedad de tablas, **sin acceso a las tablas de `auth`**. Ve a los miembros de su empresa por la vista `core.v_miembros`.
  - `capaz_sistema`: lo que cruza empresas (consola de plataforma y relevo de eventos). Solo las tablas de la **lista de plataforma**, con política `plataforma` y permisos explícitos, por columna cuando la tabla lleva datos de negocio. **Sin acceso a `registro`, `cotizador` ni a los clientes.**
  - Los esquemas de negocio siguen siendo `core`, `registro` y `cotizador`. `auth` es solo para la librería.
- **ADR-012. Convenciones de datos.** `tenant_id text` (id de organización de Better Auth); `uuid` con `uuidv7()`; `timestamptz` siempre; zona horaria por empresa (`America/Lima` por defecto) para cortes de día; **llaves foráneas compuestas con `tenant_id`** y `unique (tenant_id, id)` en toda tabla que otra referencie; correlativos por empresa con bloqueo de fila en `core.contadores`; dinero según la regla 9; los movimientos de dinero se anulan, no se editan ni se borran; una migración que deba tocar filas de varias empresas quita `FORCE` al empezar y vuelve a llamar a `aplicar_aislamiento` al terminar, en la misma transacción.

## 3. Puntos ciegos revisados

| Punto | Decisión |
|---|---|
| Código de negocio leyendo contraseñas o sesiones | Rol y esquema aparte para la autenticación (ADR-011) |
| La plataforma viendo datos de sus clientes | `capaz_sistema` solo tiene lo de la lista de plataforma; lo comprueba una prueba por lista de permitidos |
| Entorno local distinto de producción en permisos | Dueño sin superusuario en local (fase 2). Es lo que habría ocultado el fallo de la sección 2.1 |
| Correo para invitaciones y recuperación de contraseña | Fuera de los cimientos. La invitación genera un **enlace** que el administrador copia y envía por WhatsApp. El restablecimiento de contraseña lo genera solo la plataforma (regla 19). Proveedor de correo: después |
| Registro con el correo de otra persona (sin verificación de correo) | Riesgo aceptado durante el piloto, acotado por el alta de empresas cerrada. Se cierra al tener proveedor de correo; cambiar el correo queda bloqueado hasta entonces |
| Costo de IA y de voz por empresa | Tabla `core.uso` (empresa, módulo, tipo, cantidad, costo) al construir la voz, con tope por empresa. No en los cimientos |
| El micrófono exige HTTPS | La fase 10a deja un dominio con certificado antes de probar la voz en el celular |
| Que la voz no llegue al 70 % con ruido real | Pista V (sección 4): audios reales desde ya, sin esperar a los cimientos |
| Dinero con decimales en el Cotizador | El motor del Cotizador conserva `NUMERIC` con `big.js`; el Registro usa céntimos. La conversión vive en un único adaptador al construir el puente |
| «Caja de hoy» y cortes de día | Zona horaria por empresa (ADR-012) |
| Numeración de órdenes y proformas | `core.contadores` con bloqueo de fila; sin huecos por reintentos |
| Reintentos desde el celular con mala señal | Idempotencia por clave en las herramientas que crean dinero (fase 5a) |
| Guardar un cambio y no avisar al otro módulo | Salida de eventos en la misma transacción (fase 8) |
| Crear la empresa y que falle a medias (autenticación, negocio y plataforma usan conexiones distintas) | El aprovisionamiento es idempotente y se repite solo si quedó incompleto (fase 3a, paso 8) |
| Protección de datos personales (Ley 29733) | El audio no se guarda por defecto; exportar y borrar datos por empresa antes del primer cliente externo; inventario en `docs/DATOS-PERSONALES.md` al construir la voz |
| Copias de seguridad | Antes de datos reales: recuperación a un punto en el tiempo y una restauración probada (fase 10a) |
| Dos agentes editando a la vez | Una fase por sesión y un commit por fase. No se trabaja en paralelo sobre el mismo repositorio sin ramas |
| Sin e2e | Contratos compartidos, recorridos por HTTP real en las pruebas de integración y revisión visual hecha por una persona |
| Ataques por texto dictado o por datos de contactos | Los argumentos reservados se rechazan en `ejecutar()`; la confirmación solo vale desde la pantalla; el agente no aprueba |
| Límite de intentos de inicio de sesión | Limitador propio de Better Auth (fase 3a) |
| Proveedor de producción sin `uuidv7()`, sin PostgreSQL 18 o sin `pg_trgm` | Comprobar en la fase 10a |

## 4. Ruta al piloto

La meta de la V1 es el piloto diario en el taller con el Registro por voz. Los cimientos se construyen en este orden, y **no todos van antes del piloto**:

```
Base segura        0 → 1 → 2
Carcasa            3a → 3b → 4 → 5a → 5b → 6a → 6b
Plantilla          7
Antes de datos     10a  (despliegue del piloto: HTTPS, copias, restauración)
reales                 │
                       ▼
        Registro, corte de voz (plan propio)  →  piloto de 30 días

Después            8 (eventos: lo pide el puente cotización → orden)
                   11a → 11b → 11c (conectores y automatizaciones: ola 2)
                   9a → 9b (consola: antes del segundo cliente)
                   10b (endurecer: antes del primer cliente externo)
                   12 (facturación electrónica SUNAT: etapa final, con todo estable)

Pista V            en paralelo desde hoy; la hace el usuario; sin código.
                   Cuando existan los audios: prueba comparativa de reconocimiento
                   (3 o 4 servicios; requiere orden del usuario por el costo)
```

- La fase 10a puede adelantarse en cuanto el usuario decida el alojamiento; como tarde, va antes de probar la voz desde un celular.
- La fase 9 puede ir antes de la 8 si el segundo cliente llega pronto.

**Pista V · Validar la voz con audios reales (usuario, en paralelo).** Es el mayor riesgo del producto y no depende del código:
1. Cronometrar 10 registros reales con el método actual (lo pide `FINALIDAD-Y-OBJETIVOS-ERP.md`, sección 5): es la línea base contra la que se medirán los 30 segundos.
2. Grabar entre 30 y 50 dictados reales en el taller, con el ruido de siempre: ingresos, egresos, deudas, abonos, nombres de clientes y proveedores, montos con céntimos. Anotar para cada uno lo correcto (monto, tipo, contacto, categoría).
3. Guardarlos **fuera del repositorio** (son datos personales), por ejemplo en `/home/datayros/Documentos/work/referencias/voz-taller/`.

Esos audios serán los casos de prueba del corte de voz. Probarlos contra un servicio de reconocimiento es parte del plan de voz y necesita orden del usuario (regla 14).

## 5. Estructura de carpetas objetivo

```
apps/api/
  drizzle/                    migraciones (generadas y SQL a mano)
  scripts/                    config.ts, preparar-base.ts, migrar.ts, plataforma.ts
  src/
    main.ts  app.module.ts
    infra/                    config/ logger/ database/ http/ health/
    db/                       esquema/ (un archivo por esquema: auth, core, registro, cotizador)
    core/
      auth/                   instancia de Better Auth, guardia, contexto
      empresas/               aprovisionar empresa, configuración, miembros
      modulos/                manifiestos, catálogo, guardas, contratación
      herramientas/           ejecutar, registro, confirmación, idempotencia
      auditoria/
      eventos/                salida de eventos y relevo (fase 8)
      clientes/               corte de referencia
      plataforma/             consola (fase 9)
    modules/
      registro/  cotizador/   solo manifiesto en los cimientos
apps/web/src/
  app/                        enrutador, layouts, guardas de ruta
  shared/                     api/ (cliente tipado) ui/ (kit) formato/ estilos/
  core/                       acceso/ inicio/ ajustes/ clientes/
  modules/                    registro/ cotizador/ (manifiesto de pantalla)
  plataforma/                 consola (fase 9)
packages/shared/src/
  respuesta.ts  codigos.ts  permisos.ts  modulos.ts  dinero.ts
  contratos/                  un archivo por módulo: nombre de herramienta → { entrada, salida }
```

## 6. Fases

Tamaños: **S** corto, **M** medio, **L** largo. Estado en la sección 7.

---

### Fase 0 · Preparar el repositorio (S)

**Objetivo:** que cualquier agente trabaje con las mismas reglas, las mismas fuentes y un solo comando de verificación.

**Pasos**
1. **Poner a salvo las fuentes de Cotizín.** Si el usuario autorizó un commit en Cotizín, anotar su identificador en `docs/REFERENCIAS.md` y portar siempre desde ese commit. Si no, copiar el árbol de trabajo actual (sin `node_modules`, `.next` ni archivos `.env*`) a `/home/datayros/Documentos/work/referencias/cotizin-<fecha>/` y anotar la ruta. Las fases siguientes leen de ahí.
2. Commit base del repositorio tal como está (con permiso), antes de cambiar nada.
3. Crear `AGENTS.md` en la raíz con las reglas de la sección 1, la tabla de documentos y el formato de informe. Crear `CLAUDE.md` con una sola línea que remita a `AGENTS.md`.
4. Reemplazar `apps/api/AGENTS.md` (generado por NestJS) por una nota corta: «Lee `/AGENTS.md`. Documentación de NestJS: https://docs.nestjs.com/llms.txt». Quitar toda mención a NestJS Observe.
5. Redactar ADR-009 a ADR-012 (sección 2.5) con el formato de los existentes.
6. Poner al día los documentos desfasados, con una nota breve y sin tocar las decisiones de producto:
   - `FINALIDAD-Y-OBJETIVOS-ERP.md`, secciones 8.1 y 11: hablan de «una sola aplicación Next.js», de esquemas `public` y `registro` y del catálogo de Cotizín. Nota al inicio: «Pila y esquemas vigentes: ADR-002, 003 y 011».
   - `ADR-004`: «tres roles» y `capaz_ro` → «ampliado por ADR-011».
   - `INTEGRACION-DE-MODULOS.md`, sección 3: `apps/api/src/herramientas` → `core/herramientas`; «controladores bajo `/api/v1/registro/…`» → herramientas (ADR-009).
   - `ARQUITECTURA-DE-MODULOS.md`, sección 3: la carpeta `http/` solo existe si un tercero necesita rutas REST (ADR-009).
   - `PLATAFORMA-Y-PLANES.md`, sección 9: paquetes E y K → fases 4 y 9.
   - `README.md` y `docker-compose.yml`: «Producción: Neon» → «alojamiento pendiente (fase 10a)»; ADR 001 a 012.
7. Mover lo existente a la estructura de la sección 5: `src/config`, `src/database`, `src/health` → `src/infra/…`. Ajustar imports.
8. Pruebas: unitarias `*.spec.ts`; de integración `*.int.spec.ts` con `apps/api/vitest.int.config.ts`. La configuración unitaria debe excluir `*.int.spec.ts`.
9. Prueba de arquitectura `apps/api/src/arquitectura.spec.ts`: lee los `import` de `src/**` y falla si (a) `modules/X` importa `modules/Y`, (b) `core` importa `modules`, (c) `infra` importa `core` o `modules`, (d) un archivo supera 500 líneas, (e) aparece `process.env` fuera de `infra/config`, (f) se importa `pg` fuera de `infra/database`. Lo mismo para `apps/web/src` (`modules`, `core`, `shared`), puntos (a) a (d).
10. Script raíz `pnpm check` = `build` de `shared` + `typecheck` + `lint` + pruebas unitarias + pruebas de integración. Si la base no responde, falla con el mensaje «Base no disponible: ejecuta `pnpm db:up`».

**Verificación:** `pnpm check` en verde. Meter a mano un import prohibido, ver que la prueba falla, y quitarlo.
**Hecho cuando:** existe `AGENTS.md`, las fuentes de Cotizín están a salvo y anotadas, `pnpm check` pasa y la prueba de arquitectura detecta una violación de ejemplo.
**Parar y preguntar si:** el usuario no ha aprobado las decisiones ADR-009 a 012, o no ha dicho cómo poner a salvo las fuentes de Cotizín (decisiones 1 y 3 de la sección 8).

---

### Fase 1 · Infraestructura del servidor (S)

**Objetivo:** configuración validada, registros útiles, errores con un solo formato y el contrato compartido completo.

**Fuentes para portar:** `cotizin/src/shared/herramientas/tipos.ts`, `cotizin/src/shared/types/resultado.ts`, `cotizin/src/shared/utils/respuesta.ts`.

**Pasos**
1. `infra/config`: esquema Zod de variables del **servidor**: `DATABASE_URL_APP`, `DATABASE_URL_AUTH`, `DATABASE_URL_SISTEMA`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CONFIRMACION_SECRET` (32 caracteres o más), `ORIGENES_PERMITIDOS`, `ALTA_DE_EMPRESAS` (`plataforma` | `abierta`), `PORT`, `NODE_ENV`. Se valida al arrancar y el proceso termina con un mensaje claro si falta algo. `scripts/config.ts` valida aparte lo que solo usan los scripts: `DATABASE_URL_ADMIN` (solo `preparar-base`) y `DATABASE_URL_OWNER` (solo `migrar`). Actualizar `.env.example`.
2. `infra/logger`: registros en JSON con `pino` (dependencias permitidas: `pino`, `pino-http`). Campos: `requestId`, `empresaId`, `usuarioId`, ruta, estado, duración. Ocultar `authorization`, `cookie`, contraseñas y cuerpos.
3. `infra/http/contexto.ts`: `AsyncLocalStorage` con `{ requestId, empresaId, usuarioId, rol, permisos, modulos, canal }`. Un middleware asigna `requestId` (cabecera `x-request-id` o `randomUUID()`); el resto lo llena el guardia en la fase 3a.
4. `packages/shared/src/respuesta.ts`: el contrato de Cotizín **completo**, con su esquema Zod:
   - `{ ok: true, datos, recibo?, avisos }`
   - `{ ok: false, error: { codigo, mensaje, candidatas? } }`
   - `{ ok: false, requiereConfirmacion: { resumen, token, venceEn } }`

   Con las funciones `exito` y `rechazo`.
5. `packages/shared/src/codigos.ts`: catálogo único de códigos con su estado HTTP. Los de Cotizín (`herramienta_desconocida`, `argumentos_invalidos`, `argumento_prohibido`, `sin_permiso`, `confirmacion_vencida`, `confirmacion_invalida`, `confirmacion_no_coincide`, `confirmacion_desactualizada`, `confirmacion_ya_usada`, `confirmacion_solo_ui`, `origen_invalido`, `solicitud_invalida`, `solicitud_muy_grande`, `sin_conexion`, `error_interno`) más `no_autenticado`, `sin_empresa`, `modulo_no_disponible`, `modulo_solo_lectura`, `no_encontrado`, `conflicto`, `demasiados_intentos`. El cliente web solo mira el cuerpo; el estado HTTP sirve a los registros.
6. `packages/shared/src/dinero.ts`: tipo `Centimos` y su esquema Zod (entero seguro), `aCentimos('1234.50')`, `formatearSoles(123450)` → `S/ 1,234.50`. Con pruebas unitarias, incluidos montos grandes y entradas inválidas.
7. `infra/http/filtro-de-errores.ts`: filtro global que convierte cualquier excepción en `Respuesta` con un código del catálogo y su estado HTTP. Nunca devuelve trazas.
8. `StandardSchemaValidationPipe` global, con `exceptionFactory` que produzca `argumentos_invalidos`.

**Verificación:** arrancar sin `BETTER_AUTH_SECRET` falla con mensaje claro; `curl -i localhost:3001/api/nada` devuelve 404 con la forma `Respuesta`; el registro de esa petición trae `requestId`.
**Hecho cuando:** lo anterior se cumple y hay pruebas unitarias del esquema de configuración, del filtro, del contrato y del dinero.

---

### Fase 2 · Base de datos, roles y aislamiento (M)

**Objetivo:** que sea imposible, desde el código de negocio, leer datos de otra empresa; y que el entorno local falle igual que fallaría producción.

**Fuentes para portar:** `cotizin/src/shared/db/con-empresa.ts`, `cotizin/drizzle/0001_aislamiento_y_roles.sql`, `cotizin/scripts/db/migrar.ts`, `cotizin/tests/db/aislamiento.test.ts`, `cotizin/tests/db/helpers.ts` y `globalSetup.ts`.

**Pasos**
1. `scripts/preparar-base.ts` (`pnpm db:preparar`; usa `DATABASE_URL_ADMIN`, el superusuario del contenedor local): crea o actualiza los cuatro roles `capaz_owner`, `capaz_auth`, `capaz_app` y `capaz_sistema` con `LOGIN` y **sin** `SUPERUSER`, `BYPASSRLS` ni `CREATEROLE`, tomando usuario y contraseña de las cuatro URL de `.env` (una sola fuente); deja las bases `capaz` y `capaz_test` con `capaz_owner` como dueño. Es idempotente. El superusuario no se usa para nada más.
2. `apps/api/drizzle.config.ts` con `schemaFilter: ['auth','core','registro','cotizador']` y `out: './drizzle'`. Esquema en `src/db/esquema/` con `pgSchema()` por esquema.
3. `scripts/migrar.ts` (usa `DATABASE_URL_OWNER`): comprueba que quien migra **no** es superusuario ni tiene `BYPASSRLS`, y que ningún rol de ejecución lo tiene (si no, falla); crea los esquemas si no existen; aplica las migraciones en orden.
4. Primera migración a mano (`drizzle-kit generate --custom`):

```sql
create extension if not exists pg_trgm;

-- Toda función nueva nace sin permiso para PUBLIC: cada una necesita su grant.
alter default privileges for role capaz_owner revoke execute on functions from public;

-- modo: 'completo' (leer y escribir), 'lectura', 'insercion' (leer e insertar).
create or replace function core.aplicar_aislamiento(tabla regclass, modo text default 'completo')
returns void language plpgsql as $$
begin
  if modo not in ('completo', 'lectura', 'insercion') then
    raise exception 'Modo de aislamiento desconocido: %', modo;
  end if;
  execute format('alter table %s enable row level security', tabla);
  execute format('alter table %s force row level security', tabla);
  execute format('drop policy if exists aislamiento on %s', tabla);
  -- Sin cláusula TO: vale para todos los roles, también para el dueño.
  execute format($p$create policy aislamiento on %s
      using      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
      with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''))$p$, tabla);
  execute format('revoke all on %s from capaz_app', tabla);
  execute format('grant %s on %s to capaz_app',
    case modo when 'completo' then 'select, insert, update, delete'
              when 'lectura'  then 'select'
              else 'select, insert' end, tabla);
end $$;

-- Abre una tabla a la plataforma. Sin columnas_lectura lee todo; con ellas, solo esas columnas.
create or replace function core.abrir_a_plataforma(
  tabla regclass, escritura text default null, columnas_lectura text default null)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists plataforma on %s', tabla);
  execute format('create policy plataforma on %s to capaz_sistema using (true) with check (true)', tabla);
  execute format('revoke all on %s from capaz_sistema', tabla);
  if columnas_lectura is null then
    execute format('grant select on %s to capaz_sistema', tabla);
  else
    execute format('grant select (%s) on %s to capaz_sistema', columnas_lectura, tabla);
  end if;
  if escritura is not null then
    execute format('grant %s on %s to capaz_sistema', escritura, tabla);
  end if;
end $$;

grant usage on schema core, registro, cotizador to capaz_app;
grant usage on schema auth to capaz_auth;
grant usage on schema core to capaz_sistema;
```

   No se usa `alter default privileges … grant` a favor de `capaz_app` (en Cotizín obligó a quitar permisos a mano después de cada migración): cada tabla y cada función recibe sus permisos explícitos.
5. Primera tabla real: `core.empresa_config` (`tenant_id` clave primaria, `zona_horaria` por defecto `America/Lima`, `moneda` `PEN`, `locale` `es-PE`, `creado_en`). Su migración termina con `select core.aplicar_aislamiento('core.empresa_config');`.
6. `infra/database`: tres grupos de conexiones (`pg.Pool`): aplicación, autenticación y sistema. `conEmpresa(ctx, fn)` portado: abre transacción en el grupo de aplicación, fija `app.tenant_id` y `app.user_id` con `set_config(..., true)` **en una sola consulta**, guarda la transacción en `AsyncLocalStorage`, reutiliza la transacción si ya hay una y **lanza error** si se pide otra empresa dentro de la misma. `DatabaseService.ping()` usa el grupo de aplicación. Los grupos se cierran al apagar el servidor.
7. Base de pruebas: `capaz_test`. `vitest.int.config.ts` con `globalSetup` que corre `migrar.ts` sobre ella. Las pruebas **no vacían tablas**: cada una crea empresas con ids únicos.
8. Pruebas de integración (con el rol `capaz_app`, nunca con el dueño):
   - **Catálogo de aislamiento:** toda tabla de `core`, `registro` y `cotizador` con columna `tenant_id` tiene `relrowsecurity` y `relforcerowsecurity` en verdadero y una política `aislamiento` sin restricción de rol. Falla si aparece una tabla nueva sin protección.
   - **Catálogo de llaves:** toda llave foránea entre dos tablas con `tenant_id` incluye `tenant_id` en ambos lados.
   - **Catálogo de funciones:** ninguna función de los esquemas propios es ejecutable por `PUBLIC` ni es `security definer` (lista de excepciones vacía; agregar una exige ADR).
   - **Aislamiento:** la empresa A no ve, no modifica y no borra filas de la B; insertar con el `tenant_id` de otra empresa falla; sin `app.tenant_id` no se ve ninguna fila, **tampoco con el rol dueño**.
   - **Roles:** ningún rol tiene `rolsuper` ni `rolbypassrls` (salvo el superusuario del contenedor, que no aparece en ninguna URL del servidor); `capaz_app` no puede hacer `select` en ninguna tabla de `auth`.
   - **`conEmpresa`:** anida bien y rechaza el cambio de empresa.
9. Scripts: `pnpm db:preparar`, `pnpm db:generar` (`drizzle-kit generate`), `pnpm db:migrar`. Actualizar el `README.md`.

**Verificación:** `pnpm db:preparar` y `pnpm db:migrar` dos veces seguidas no fallan; `pnpm check` en verde; quitar a mano la llamada a `aplicar_aislamiento` hace fallar la prueba de catálogo (y se repone).
**Hecho cuando:** las seis pruebas pasan con `capaz_app` y con un dueño que no es superusuario.
**Parar y preguntar si:** `drizzle-kit` intenta borrar o recrear objetos creados a mano; o si hace falta `BYPASSRLS`, superusuario o `security definer` para que algo funcione (no hace falta: es señal de un diseño equivocado).

---

### Fase 3a · Identidad y empresas en el servidor (M)

**Objetivo:** registrarse, iniciar sesión, tener empresa y que cada petición lleve un contexto comprobado.

**Fuentes para portar:** `cotizin/src/shared/auth/*`, `cotizin/src/shared/db/esquema/auth.ts`.

**Pasos**
1. Dependencia: `better-auth` en `apps/api`. Antes de escribir, leer su documentación de la versión instalada sobre: adaptador de Drizzle, plugin `organization` y sus opciones, `toNodeHandler`, restablecimiento de contraseña. **Primero, una prueba corta:** crear usuario y organización con las tablas en el esquema `auth`. Si no funciona, parar.
2. Tablas de Better Auth en el esquema `auth`: copiar `esquema/auth.ts` de Cotizín, cambiar `pgTable` por `auth.table` y compararlo con lo que genera el CLI de Better Auth para la versión instalada. Migración a mano con permisos explícitos por tabla para `capaz_auth`. **Ningún permiso para `capaz_app`.**
3. `core/auth/auth.ts`: instancia con `drizzleAdapter` sobre el grupo de conexiones de autenticación, correo y contraseña, plugin `organization`, caché de sesión en cookie (5 minutos), limitador de intentos activado, `basePath: '/api/auth'`, orígenes de confianza = `ORIGENES_PERMITIDOS`. Portar el `databaseHooks.session.create.before` que fija la empresa activa (la más antigua del usuario). Sin la parte de bcrypt: aquí no hay usuarios heredados.
4. `main.ts`: crear la aplicación con `bodyParser: false`, montar el manejador de Better Auth en `/api/auth/*` **antes** de los analizadores de cuerpo, y luego activar el analizador JSON para el resto (límite 256 KB). La sintaxis exacta de rutas comodín de Express 5 y de `useBodyParser` se verifica en la documentación instalada.
5. **Lista blanca de rutas de `/api/auth`**, delante del manejador: solo pasan registrarse, iniciar y cerrar sesión, leer la sesión, cambiar la propia contraseña, usar un enlace de restablecimiento, listar las organizaciones propias, fijar la organización activa y aceptar una invitación. Todo lo demás responde `no_encontrado`: crear, editar o borrar organizaciones, invitar, expulsar, cambiar roles, cambiar el correo, borrar la cuenta y **pedir** un restablecimiento. Esas operaciones existen solo como herramientas (fases 5a y 6b) o como comandos de plataforma. Los nombres exactos de las rutas se toman de la versión instalada.
6. `core/auth/guardia.ts` (guardia global): obtiene la sesión con `auth.api.getSession({ headers })`; sin sesión responde `no_autenticado`, salvo rutas marcadas `@Publica()`. Con sesión, **comprueba en cada petición** que el usuario sigue siendo miembro de la empresa activa y lee su rol de la base (grupo de autenticación); si ya no es miembro, la petición sigue como «sin empresa». Llena el contexto (`usuarioId`, `empresaId`, `rol`, `canal: 'ui'`). Decorador `@RequiereEmpresa()`: sin empresa responde `sin_empresa`.
7. Vista `core.v_miembros` (del dueño, sin `security_invoker`; las tablas de `auth` no llevan RLS): miembros **de la empresa actual** con `usuario_id`, `nombre`, `correo`, `rol`, filtrando por `nullif(current_setting('app.tenant_id', true), '')`. `grant select` a `capaz_app`.
8. `core/empresas/aprovisionar.ts`: deja lista una empresa (siembra `core.empresa_config` dentro de `conEmpresa`; en la fase 4 activará además los módulos por defecto). Es **idempotente**. Como autenticación y negocio usan conexiones distintas, la creación no es atómica: el guardia, si la empresa activa no tiene fila en `core.empresa_config`, vuelve a aprovisionar.
9. `POST /api/v1/empresas`: con `ALTA_DE_EMPRESAS=abierta` crea la organización con la API de servidor de Better Auth, la deja activa y aprovisiona. Con `plataforma` responde `sin_permiso`: la empresa la crea el operador (comando de la fase 4). `.env.example` usa `abierta`; el valor por defecto del esquema es `plataforma`.
10. `GET /api/v1/yo`: usuario, empresa activa, rol, lista de empresas del usuario y si puede crear empresas. Contrato Zod en `@capaz/shared`.
11. Pruebas de integración, **por HTTP real** (servidor en un puerto libre, `fetch` con cookies): registrarse, iniciar sesión, crear empresa y leer `yo`; el gancho de sesión fija la empresa activa; `yo` sin sesión devuelve `no_autenticado`; dos usuarios de empresas distintas obtienen contextos distintos; desde la empresa A, `v_miembros` no muestra miembros de la B; **un miembro expulsado pierde el acceso en la siguiente petición aunque su sesión siga viva**; las rutas cerradas del paso 5 responden `no_encontrado`; con `ALTA_DE_EMPRESAS=plataforma` no se puede crear empresa; una empresa a medio aprovisionar se repara sola.

**Hecho cuando:** las pruebas pasan y la prueba de permisos confirma que `capaz_app` no lee `auth`.
**Parar y preguntar si:** Better Auth no acepta tablas en un esquema distinto de `public`; o si alguna pantalla necesita una ruta de `/api/auth` que no está en la lista blanca.

---

### Fase 3b · Pantallas de acceso (M) · primera pantalla

**Fuentes para portar:** pantallas de `cotizin/src/app/(auth)/`.

**Pasos**
1. Dependencias en `apps/web`: `better-auth` (cliente de React con el plugin de organización) y `@tanstack/react-query`.
2. `shared/api/cliente.ts`: `fetch` con `credentials: 'include'`, valida la respuesta con el esquema compartido y devuelve `Respuesta<T>`; una caída de red se vuelve el rechazo `sin_conexion`, nunca una excepción.
3. Pantallas `/registro`, `/iniciar-sesion`, `/nueva-empresa`; cierre de sesión. Si el usuario no puede crear empresas, `/nueva-empresa` muestra «Tu cuenta aún no tiene empresa: acepta una invitación o pide a Capaz que la cree».
4. Guardas de ruta: sin sesión → `/iniciar-sesion`; sin empresa → `/nueva-empresa`; con todo → `/inicio` (por ahora, un saludo con el nombre de la empresa).
5. Pruebas unitarias de las guardas de ruta (son funciones puras sobre la respuesta de `yo`).

**Revisión visual (persona, a 390 y 1280 px):** registrarse, crear empresa, cerrar sesión, volver a entrar y caer en `/inicio` con la empresa correcta.
**Hecho cuando:** `pnpm check` en verde y la lista de revisión visual entregada en el informe.
**Parar y preguntar si:** la cookie de sesión no viaja por el proxy de Vite.

---

### Fase 4 · Módulos, contratación y permisos (M)

**Objetivo:** que el acceso dependa de lo que la empresa contrató y de lo que su administrador asignó, y que la base lo haga cumplir.

**Fuentes para portar:** `cotizin/src/shared/db/esquema/modulos.ts`, `cotizin/drizzle/0016_registro_y_modulos.sql` (funciones `modulo_activo`, `activar_modulo`, `dar_baja_modulo` y el disparador del historial), `cotizin/src/shared/modulos/*` (`navegacion.ts`, `tipos.ts` y sus pruebas), `cotizin/tests/db/registro-y-modulos.test.ts`.

**Pasos**
1. `packages/shared/src/modulos.ts`: tipo `ManifiestoDeModulo` = `{ codigo, nombre, descripcion, version, dependeDe[], permisos[], permisosPorNivel: { completo[], lectura[] }, secciones[], acento, icono, porDefecto?: { pruebaDias } }`. `packages/shared/src/permisos.ts`: los permisos son cadenas `recurso:accion`.
2. Manifiestos: `core` (siempre activo, no se contrata), `registro` y `cotizador` (por ahora con `secciones` vacías y marcados «en construcción»). Decisión comercial provisional, editable como dato: toda empresa nueva recibe `registro` en prueba de 30 días.
3. `core/modulos/catalogo.ts`: al arrancar valida que no haya códigos repetidos, dependencias inexistentes ni ciclos, y que cada permiso pertenezca a un solo módulo. Si falla, el servidor no arranca. Sincroniza el catálogo con `core.modulos`.
4. Tablas y sus permisos:

   | Tabla | `capaz_app` | `capaz_sistema` (lista de plataforma) |
   |---|---|---|
   | `core.modulos`, `core.planes`, `core.plan_modulos` (catálogos, sin `tenant_id`) | lectura | lectura y escritura |
   | `core.empresa_modulos`: estado `prueba \| activo \| suspendido \| baja`, `alta_en`, `prueba_hasta`, `baja_en`, `motivo`, `plan`, `precio_acordado_centimos`, `vigente_hasta`, `max_usuarios` | `aplicar_aislamiento(…, 'lectura')` | `abrir_a_plataforma(…, 'insert, update')` |
   | `core.empresa_modulos_eventos`: historial de solo inserción, escrito por disparador | `'lectura'` | `abrir_a_plataforma(…, 'insert')` |
   | `core.usuario_modulos`: `tenant_id`, `usuario_id`, `modulo`, `nivel` (`completo \| lectura`) | `'completo'` (lo administra la empresa) | ninguno |
   | `core.solicitudes_modulo`: `tenant_id`, `modulo`, `usuario_id`, `nota`, `estado` | `'insercion'` | `abrir_a_plataforma(…, 'update')` |
   | `core.plataforma_admins`: `usuario_id` (sin `tenant_id`) | ninguno | lectura y escritura |

5. Funciones SQL, **todas con los permisos de quien llama** (regla 18) y `search_path` fijado:
   - `core.modulo_activo(tenant, modulo) returns boolean`: activo, o en prueba sin vencer. `grant execute` a `capaz_app` y `capaz_sistema`.
   - `core.exigir_modulo(modulo)`: lanza excepción si el módulo no está activo para la empresa de la transacción. `grant execute` a `capaz_app`. La usarán los disparadores de escritura de `registro` y `cotizador`.
   - `core.activar_modulo`, `core.suspender_modulo`, `core.dar_baja_modulo`, `core.reactivar_modulo`: `grant execute` **solo** a `capaz_sistema`. Activar valida `dependeDe`; dar de baja valida que ningún módulo activo dependa de él. El disparador del historial también corre como quien llama.
6. Regla de acceso de usuario: `owner` y `admin` entran a todo módulo contratado con nivel completo; `member` solo a los que tenga en `core.usuario_modulos`. Sin asignación, no entra.
7. `core/modulos/acceso.ts` (función pura, portar `navegacion.ts` con sus pruebas): dado estado de contratación, rol y asignación devuelve `{ visible, puedeEntrar, puedeEscribir, motivo }` con motivos `activo | prueba | baja_solo_lectura | suspendido | no_contratado | sin_asignar`.
8. El guardia añade al contexto `modulos` y `permisos`, leídos **en una sola consulta** dentro de `conEmpresa`. Decoradores `@RequiereModulo('x')` y `@RequierePermiso('y')`: responden `modulo_no_disponible` o `sin_permiso`.
9. `GET /api/v1/yo` incluye ahora los módulos con su estado, días de prueba restantes y secciones.
10. `scripts/plataforma.ts` (usa `DATABASE_URL_SISTEMA` y, para lo de cuentas, `DATABASE_URL_AUTH`). Es el modo de operar durante el piloto, hasta que exista la consola:
    - `pnpm plataforma activar|suspender|baja|reactivar --empresa <id> --modulo <codigo> [--prueba-dias N] [--motivo "…"]`
    - `pnpm plataforma crear-empresa --nombre "…" --correo <correo del dueño ya registrado>`
    - `pnpm plataforma admin --correo <correo>`
    - `pnpm plataforma restablecer --correo <correo>`: genera un enlace de restablecimiento de un solo uso y con vencimiento (mecanismo de Better Auth, capturando el enlace en lugar de enviarlo por correo) y lo imprime. Quien opera la plataforma lo entrega a esa persona por un canal que ya conoce.
11. `aprovisionar` (fase 3a, paso 8) activa ahora los módulos `porDefecto` con el grupo de conexiones de sistema.

**Pruebas de integración:** un `member` sin asignación recibe `modulo_no_disponible`; con asignación entra; módulo en baja o suspendido: `puedeEscribir` es falso y `core.exigir_modulo` lanza; prueba vencida equivale a baja; `capaz_app` no puede ejecutar `activar_modulo` ni escribir en `empresa_modulos`; cada cambio deja una fila en el historial; el arranque falla con un ciclo de dependencias; **lista de plataforma:** una prueba recorre el catálogo y comprueba que los permisos de `capaz_sistema` son exactamente los de la tabla del paso 4 (más los que agreguen las fases 8 y 9) y nada más.
**Hecho cuando:** las pruebas pasan y `pnpm plataforma activar` cambia lo que devuelve `yo`.
**Parar y preguntar si:** hace falta que la empresa se active un módulo sola (no debe poder).

---

### Fase 5a · Herramientas, auditoría e idempotencia en el servidor (M)

**Objetivo:** la única puerta a las operaciones, lista para pantalla, voz, agente y MCP.

**Fuentes para portar (con sus pruebas):** todo `cotizin/src/shared/herramientas/` (`ejecutar.ts`, `registro.ts`, `confirmacion.ts`, `tipos.ts`, `auditoria*.ts`, `errores-de-zod.ts`) y `cotizin/src/app/api/herramientas/route.ts` (comprobación de origen y tamaño).

**Pasos**
1. Portar a `core/herramientas/`. Cambios frente a Cotizín:
   - cada herramienta declara `modulo` y `permiso`, y el permiso debe estar en el manifiesto de ese módulo;
   - `canal` admite `ui | agente | mcp | sistema`;
   - puede declarar `idempotente: true` y `auditar` (qué campos de entrada o salida son seguros para el resumen de auditoría, y qué entidad afecta).
2. Orden de comprobaciones en `ejecutar()`: existe la herramienta → argumentos reservados → módulo (**las de `criticidad: 'lectura'` piden `puedeEntrar`; las demás, `puedeEscribir`, y si no responden `modulo_solo_lectura`**) → permiso → esquema de entrada → idempotencia → confirmación (si es crítica) → ejecución → esquema de salida → auditoría. Conservar `ARGUMENTOS_DE_CONTEXTO` y la regla de que la confirmación solo vale con `canal: 'ui'`.
3. **Una transacción por llamada:** idempotencia, reserva de la confirmación, ejecución y auditoría del éxito ocurren dentro del mismo `conEmpresa`. Si la herramienta rechaza o lanza, la transacción se revierte **entera** y la auditoría del rechazo se escribe en una transacción propia. Así no existe un cambio sin auditar ni una auditoría de algo que no ocurrió.
4. `core.auditoria` (solo inserción; un disparador rechaza `update` y `delete`): `id`, `tenant_id`, `usuario_id`, `modulo`, `herramienta`, `canal`, `resultado`, `codigo`, `hash_args`, `entidad_tipo`, `entidad_id`, `resumen jsonb`, `request_id`, `duracion_ms`, `creado_en`. Sin argumentos en claro, salvo lo que la herramienta declare en `auditar`. `aplicar_aislamiento(…, 'insercion')`.
5. `core.confirmaciones_usadas`: `tenant_id`, `jti`, `usado_en`, clave primaria (`tenant_id`, `jti`). El `jti` se inserta dentro de la transacción de la operación; si ya existe, `confirmacion_ya_usada`. (En Cotizín esto vivía en la tabla de auditoría, que allí sí admitía actualizaciones.)
6. `core.idempotencia`: `tenant_id`, `clave`, `herramienta`, `hash_args`, `respuesta jsonb`, `creado_en`, con clave primaria (`tenant_id`, `clave`). Para herramientas con `idempotente: true` y cabecera `Idempotency-Key`: se inserta la clave al empezar la transacción (`on conflict do nothing`); si ya existía con los mismos argumentos se devuelve la respuesta guardada, y con otros argumentos se responde `conflicto`. Dos peticiones simultáneas con la misma clave: la segunda espera a la primera y recibe su respuesta. Las filas de más de 30 días se borran en una tarea de mantenimiento (fase 8).
7. `POST /api/v1/herramientas/:nombre`: cuerpo `{ args, confirmacion? }`; responde `Respuesta` con `Cache-Control: no-store`. Rechaza si la cabecera `Origin` no está en `ORIGENES_PERMITIDOS` (`origen_invalido`) y si el cuerpo supera 256 KB.
8. `packages/shared/src/contratos/`: por módulo, un objeto `nombre → { entrada, salida }` (esquemas Zod). El servidor registra cada herramienta **a partir de ese contrato**, de modo que no puedan divergir.
9. Herramientas de ejemplo en `core`: `empresa_ver_configuracion` (lectura) y `empresa_actualizar_configuracion` (crítica, con confirmación; recibe solo lo que cambia y fusiona con la fila bloqueada `for update`; declara en `auditar` los campos cambiados).

**Pruebas:** las de Cotizín, adaptadas a estos cambios: **cada caso queda portado o anotado como «no aplica» con su motivo; no se borran casos en silencio.** Más: toda herramienta registrada tiene contrato y viceversa, y su permiso está en el manifiesto de su módulo; argumento reservado rechazado y auditado; confirmación con otro usuario, otra empresa u otros argumentos rechazada; confirmación con `canal: 'agente'` rechazada; el mismo token usado dos veces a la vez solo vale una; idempotencia (repetición, conflicto y dos peticiones simultáneas); herramienta de escritura sobre módulo en baja responde `modulo_solo_lectura` y la de lectura funciona; una herramienta que falla a medias no deja cambios y sí deja auditoría del rechazo; la auditoría no admite `update` ni `delete`.
**Hecho cuando:** las pruebas pasan y una herramienta nueva se puede agregar tocando solo su contrato y su archivo.

---

### Fase 5b · Herramientas en la pantalla (S)

**Fuentes para portar:** `cotizin/src/shared/hooks/use-llamador.tsx`, `cotizin/src/shared/utils/estado-del-llamador.ts` (con sus pruebas).

**Pasos**
1. Web `shared/api/herramientas.ts`: `llamar(nombre, args)` tipado por el mapa de contratos, con cola en serie para escrituras (portar `use-llamador`), generación de `Idempotency-Key` (la misma clave en los reintentos de una misma acción) y el indicador «Guardando… / Guardado».
2. Flujo de confirmación en dos pasos con un diálogo: muestra el `resumen`, reenvía con el `token`, y si venció vuelve a pedirlo.
3. Pantalla mínima `/ajustes/empresa`: ver y cambiar zona horaria.

**Revisión visual (persona):** cambiar la zona horaria pide confirmación y queda auditado.
**Hecho cuando:** `pnpm check` en verde, con pruebas unitarias del estado del llamador y de la confirmación.

---

### Fase 6a · Carcasa: navegación (M-L)

**Objetivo:** la estructura visible del ERP, según la interfaz de referencia descrita en `PLAN-CIMIENTOS.md` (sección 7).

**Fuentes para portar:** `cotizin/.claude/design-systems/pliego/pliego.md`, `cotizin/tailwind.config.ts` (tokens), `cotizin/src/shared/components/erp/` (barra lateral, tarjeta de módulo, kit), `cotizin/docs/diseno/kit-erp.md`.

**Pasos**
1. Tokens Pliego en `shared/estilos` con `@theme` de Tailwind 4, en claro y oscuro (automático, con opción manual guardada por dispositivo). Fuentes Bricolage Grotesque, Instrument Sans y JetBrains Mono, servidas desde el propio proyecto (`@fontsource`).
2. Portar el kit mínimo: botón, campo, diálogo, hoja inferior, insignia de estado, estado vacío, esqueleto de carga, avisos. Cambiar `next/link` y `next/navigation` por React Router.
3. Layout con sesión: encabezado delgado (Inicio, migas, selector de empresa, usuario) y barra lateral con las secciones del módulo abierto. Móvil: barra inferior con cuatro destinos y «Más». Tableta: barra lateral solo con íconos.
4. `/inicio`: saludo y una tarjeta por módulo del catálogo, con su estado tomado de `yo`: activo, prueba (días restantes), baja (solo lectura), suspendido, no contratado (botón «Solicitar», herramienta `modulo_solicitar`, que crea una fila en `core.solicitudes_modulo`), sin asignar («pide acceso a tu administrador»).
5. Rutas de módulo generadas desde los manifiestos; un módulo sin acceso redirige a `/inicio` con aviso. `registro` y `cotizador` muestran «En construcción».
6. Selector de empresa: cambia la empresa activa con Better Auth y recarga `yo`.
7. `shared/formato`: fechas y horas en `es-PE` con la zona horaria de la empresa; soles con `dinero.ts`. Con pruebas unitarias.

**Revisión visual (persona):** todas las pantallas a 390 y 1280 px, claro y oscuro; texto sin cortes; foco visible; nada se desborda en horizontal.
**Hecho cuando:** `pnpm check` en verde y, con dos módulos en estados distintos puestos por `pnpm plataforma`, `yo` y las tarjetas coinciden.
**Parar y preguntar si:** el usuario entrega la imagen de la interfaz de referencia y difiere de lo descrito.

---

### Fase 6b · Carcasa: usuarios y accesos (M)

**Pasos**
1. Herramientas en `core`: `miembros_listar`, `miembro_asignar_modulo`, `miembro_cambiar_rol`, `miembro_quitar`, `invitacion_crear`, `invitacion_anular`. Usan la API de servidor de Better Auth por dentro (sus rutas públicas están cerradas, fase 3a). Reglas: respetan `max_usuarios` del módulo; no se puede quitar ni degradar al último `owner`; un `admin` no cambia a un `owner`; **ninguna toca el correo ni la contraseña de otra persona** (regla 19). Todas críticas o auditadas con `auditar`.
2. `/ajustes/usuarios` (solo `owner` y `admin`): lista de miembros (por `core.v_miembros`), cambio de rol, y por cada miembro los módulos contratados con un selector `sin acceso | lectura | completo`.
3. Invitar: genera un **enlace de invitación** que el administrador copia (sin correo). Pantalla de aceptación del enlace: pide iniciar sesión o registrarse con el correo invitado.

**Pruebas de integración:** un `member` no puede usar estas herramientas; no se quita al último `owner`; `max_usuarios` se respeta; una invitación de la empresa A no sirve para entrar a la B; una invitación anulada o vencida no funciona.
**Revisión visual (persona):** a 390 y 1280 px, claro y oscuro.
**Hecho cuando:** un `member` sin módulos ve las tarjetas bloqueadas, el administrador le asigna uno con nivel `lectura` y, al recargar, entra y no puede escribir.

---

### Fase 7 · Corte de referencia: Clientes (M)

**Objetivo:** el primer recorrido completo, que sirve de plantilla para todo módulo, de base del CRM y de **contactos del Registro** (clientes y proveedores).

**Fuentes de referencia:** `cotizin/src/shared/db/esquema/clientes.ts` y la migración `0020`, `cotizin/src/features/clientes/`, la tabla `contactos` de Tairos.RC, y para ideas de modelo `odoo/addons/base/models/res_partner.py` (solo lectura).

**Pasos**
1. `core.clientes`: `id`, `tenant_id`, `tipo` (`cliente | proveedor | ambos`, por defecto `cliente`: una sola tabla de personas para todos los módulos, como en Cotizín), `clase` (`persona | empresa`), `nombre`, `nombre_normalizado` (sin tildes ni mayúsculas, calculado por el dominio), `documento_tipo` (`dni | ruc | ce | pasaporte | otro`, dato fiscal mínimo para la etapa final), `documento_numero`, `telefono`, `correo`, `notas`, `datos_extra jsonb` (campos personalizados a futuro, ADR-013), `fusionado_en` (a qué cliente se fusionó), `archivado_en`, `creado_por`, `creado_en`, `actualizado_en`. Índices que empiezan por `tenant_id`.
   - `unique (tenant_id, id)`: destino de las llaves compuestas de los módulos.
   - Único por (`tenant_id`, `nombre_normalizado`) entre los no fusionados. Un cliente archivado conserva su nombre; uno fusionado lo libera (regla ya probada en Cotizín).
   - Índice de parecido (`gin_trgm_ops`) sobre `nombre_normalizado` entre los no archivados.
   - Con `aplicar_aislamiento`.
2. Capas, cada una en su carpeta: `domain` (normalización de nombre y teléfono, reglas puras con pruebas), `repositories`, `herramientas`, contratos en `@capaz/shared`:
   - `clientes_listar`, `clientes_ver`, `clientes_crear` (idempotente), `clientes_editar`, `clientes_archivar`;
   - `clientes_buscar`: por parecido del nombre; devuelve los mejores candidatos. Es la que usará la voz para resolver «le pagué a Juan», y la que alimenta `candidatas` cuando hay más de uno.

   Fusionar clientes queda para el plan del Registro (hay que mover sus referencias); aquí solo se deja la columna.
3. Permisos `clientes:ver` y `clientes:editar` en el manifiesto de `core`.
4. Web `core/clientes`: lista con búsqueda y estado vacío, alta en hoja inferior (móvil) o diálogo (escritorio), ficha con edición y archivado.
5. Escribir `docs/COMO-CREAR-UN-MODULO.md`: la lista de pasos seguida aquí, como receta para Registro y Cotizador, incluidas las pruebas de catálogo y la llave compuesta hacia `core.clientes`.
6. **Productos mínimos** (`core.productos`: `id`, `tenant_id`, `nombre`, `nombre_normalizado`, `tipo` (`producto | servicio`), `unidad`, `precio_centimos`, `afecto_igv`, `datos_extra`, `archivado_en`; `unique (tenant_id, id)`), con las mismas capas y herramientas que Clientes. Es lo que el Cotizador y el Registro compartirán (ADR-013); las listas de precios y `core.sucursales` llegan en la ola 2.

**Pruebas:** dominio (unitarias); herramientas contra base real con dos empresas; nombre duplicado responde `conflicto`; «Jose Perez» encuentra a «José Pérez»; un `member` con nivel `lectura` no puede crear; otra empresa no ve el cliente.
**Revisión visual (persona):** crear un cliente desde el celular.
**Hecho cuando:** las pruebas pasan y la receta está escrita.

---

### Fase 8 · Eventos entre módulos y correlativos (M) · después del corte de voz

**Objetivo:** que un módulo avise a otro sin conocerlo y sin perder avisos.

**Pasos**
1. `core.eventos_salida`: `id`, `tenant_id`, `tipo`, `carga jsonb`, `creado_en`, `disponible_en`, `procesado_en`, `intentos`, `ultimo_error`. `aplicar_aislamiento(…, 'insercion')` para `capaz_app`. Para `capaz_sistema`: `abrir_a_plataforma(…, 'update', 'id, tenant_id, tipo, creado_en, disponible_en, procesado_en, intentos')`: **el relevo no puede leer `carga`**.
2. `core.eventos_procesados`: `tenant_id`, `evento_id`, `consumidor`, única (`evento_id`, `consumidor`). Garantiza que cada consumidor procese una sola vez. Con `aplicar_aislamiento(…, 'insercion')`.
3. `core/eventos`: `emitir(tx, tipo, carga)` exige la transacción activa (falla sin ella). Contratos de eventos con Zod en `@capaz/shared`. Registro de consumidores declarado en cada manifiesto.
4. Relevo dentro del mismo proceso:
   - **Despierta por señal:** `emitir` avisa al relevo cuando su transacción se confirma. Además hay un barrido de respaldo (60 s por defecto, configurable) que solo sigue activo mientras queden eventos pendientes. No hay sondeo fijo cada segundo.
   - **Reserva corta:** con el grupo de sistema toma un lote (`for update skip locked`), les pone `disponible_en` unos minutos adelante y suma un intento, y confirma. No mantiene una transacción abierta mientras corren los consumidores.
   - **Entrega:** por cada evento y consumidor abre `conEmpresa` con `canal: 'sistema'`, lee ahí la `carga` (como `capaz_app`), inserta en `eventos_procesados` y ejecuta el consumidor en esa misma transacción. Si el módulo del consumidor no está activo para esa empresa, se marca como procesado sin ejecutar.
   - Reintentos con espera creciente; tras 8 intentos queda marcado como fallido y se registra.
   - Se detiene limpio al apagar el servidor. En las pruebas no arranca solo: se llama a `procesarLote()`.
5. `core.contadores` (`tenant_id`, `clave`, `anio`, `ultimo`) y `siguienteNumero(tx, clave, anio)` con bloqueo de fila.
6. **Disparadores por tiempo** (`core.reglas_automaticas` con `disparador = 'tiempo'`): el relevo evalúa cada minuto, solo si hay reglas, las condiciones «N días después de una fecha» (deuda vencida, prueba por vencer, cotización sin respuesta) y emite el evento correspondiente. Se prueban con reloj controlado.
7. Tarea de mantenimiento diaria en el mismo relevo: borra filas de `core.idempotencia` de más de 30 días y eventos procesados de más de 90.
8. Ejemplo real: `clientes_crear` emite `cliente.creado`; un consumidor de demostración en `core` lo registra.

**Pruebas:** si la transacción se revierte, no hay evento; el mismo evento entregado dos veces se procesa una vez; un consumidor que falla se reintenta y no bloquea a los demás; `capaz_sistema` no puede leer `carga`; dos llamadas simultáneas a `siguienteNumero` dan números distintos y consecutivos.
**Hecho cuando:** las pruebas pasan. Queda preparado el puente cotización → orden.

---

### Fase 9 · Consola de plataforma (L, en dos partes) · antes del segundo cliente

**Objetivo:** operar empresas, módulos, planes y precios desde la pantalla. Detalle en `PLATAFORMA-Y-PLANES.md`.

**9a · Servidor**
1. Guardia `@SoloPlataforma()`: el usuario debe estar en `core.plataforma_admins`. Registro de herramientas **aparte** (`/api/v1/plataforma/herramientas/:nombre`), que ejecuta con el grupo de conexiones de sistema y audita en `core.auditoria_plataforma`.
2. Lectura para la consola **sin `security definer`**: se amplía la lista de plataforma con permisos por columna, solo para contar. Por ejemplo `core.auditoria (tenant_id, creado_en)` para la última actividad, y una vista de `auth` con empresa, fecha de alta y número de miembros. La consola muestra nombre de la empresa, fecha de alta, número de usuarios, módulos con estado, plan, precio, vencimientos y última actividad. Nunca filas de negocio.
3. Herramientas: listar empresas, ver ficha, crear empresa, activar, suspender, dar de baja y reactivar módulo, fijar plan, precio acordado, vigencia y límite de usuarios, gestionar planes y sus precios, listar y atender solicitudes, generar enlace de restablecimiento.

**Pruebas 9a:** un usuario normal recibe `sin_permiso` en toda ruta de plataforma; **la prueba de la lista de plataforma sigue pasando con lo agregado, y confirma que `capaz_sistema` no puede leer ninguna tabla de `registro` ni `cotizador`, ni `core.clientes`, ni la carga de los eventos**; bajar un módulo deja a esa empresa en solo lectura; todo cambio queda auditado con el actor.

**9b · Pantallas**
4. Web `/plataforma`: empresas, ficha con un interruptor por módulo e historial, planes y precios, solicitudes y vencimientos, resumen.
5. Al atender una solicitud se crea o enlaza el cliente correspondiente en el CRM de la empresa operadora (la empresa de Datayros dentro de Capaz).

**Hecho cuando:** se puede dar a una empresa el Cotizador sin el Registro, con precio y vigencia, desde la pantalla.
**Parar y preguntar si:** se pide «entrar como la empresa» o ver sus datos: no está en el alcance y requiere una decisión aparte.

---

### Fase 11 · Conectores y automatizaciones (L, en tres partes) · ola 2 · requiere aprobar ADR-014

**Objetivo:** «conecta tu empresa»: que Capaz hable con otros sistemas y automatice trabajo repetitivo, sin que los módulos sepan de conectores. Detalle y razones en `docs/adr/ADR-014-conectores-y-automatizaciones.md`.

**11a · Marco**
1. Migraciones (receta de `MODULOS-Y-MERCADO.md` sección 6; todas con `tenant_id`, RLS y la lista de plataforma al día): `core.conectores` (catálogo), `core.conexiones` (credenciales cifradas), `core.referencias_externas`, `core.sincronizaciones`, `core.webhooks_entrantes`, `core.webhooks_salientes`, `core.reglas_automaticas` y su historial de ejecuciones. `capaz_sistema` no recibe acceso a las credenciales.
2. `core/conectores/`: manifiesto de conector (`packages/shared/src/conectores.ts`), registro validado al arrancar, cifrado AES-256-GCM con `CONEXIONES_CLAVE` (variable nueva en `infra/config`, 32 bytes en base64, con identificador de versión).
3. Ejecución en el trabajador desde la tabla de eventos: reintentos con espera creciente, límite de velocidad por conexión, cola de fallidos, y toda acción sobre Capaz por `ejecutar()` con `canal: 'sistema'`.
4. Webhooks entrantes con verificación de firma e idempotencia; claves de API por empresa (se guardan con hash, se muestran una sola vez, se revocan).
5. Motor de reglas: disparadores (evento, tiempo, webhook, manual), condiciones declarativas, acciones = herramientas registradas, modo `borrador | pide_aprobacion | automatico` (lo que mueve dinero nunca es automático), límites por empresa y por día, ejecución «qué haría».

**11b · Primeros conectores:** importar y exportar (Excel/CSV) de clientes, productos y movimientos; webhooks genéricos; WhatsApp Business. Cada uno con pruebas contra un servidor simulado local (sin llamar al servicio real sin orden del usuario, regla 14).
**11c · Pantallas:** `/conecta` (lista de conectores, estado, configurar, cola de errores con reintento) y `/automatizaciones` (reglas, historial, probar).

**Pruebas:** las credenciales nunca salen en respuestas ni registros; una empresa no ve la conexión de otra; `capaz_sistema` no lee credenciales; un webhook repetido se procesa una vez; una regla que mueve dinero no puede quedar en `automatico`; el límite diario corta la ejecución; un conector que falla no bloquea a los demás.
**Hecho cuando:** una empresa importa clientes desde Excel, activa un webhook de salida y una regla por tiempo genera un borrador de aviso de deuda, todo auditado.
**Parar y preguntar si:** hay que llamar a un servicio externo real (WhatsApp, proveedor de facturación) o elegir proveedor: lo decide el usuario.

---

### Fase 10a · Despliegue del piloto (M) · antes de datos reales · necesita decisiones del usuario

1. Alojamiento decidido (ADR-003): Base en Neon; **host del servidor por decidir** (Hetzner Ashburn es un candidato entre otros: comparar opciones con región cercana a la de Neon). Medir desde Perú la latencia a la región elegida y el arranque en frío de Neon; confirmar región y plan con los números. Servidor y base en la misma región. Configurar límite de gasto y alertas en Neon.
2. Comprobar en Neon: PostgreSQL 18, `uuidv7()`, `pg_trgm`, y que los cuatro roles se pueden crear **por SQL** sin `BYPASSRLS` (los creados desde la consola de algunos proveedores lo traen). Correr ahí las pruebas de catálogo y de roles de la fase 2.
3. `Dockerfile` de varias etapas: compila `shared`, `web` y `api`; la API sirve la web compilada (mismo origen) con `useStaticAssets` de `@nestjs/platform-express` (sin dependencias nuevas) y responde `index.html` a las rutas que no empiezan por `/api`.
4. Migraciones como paso de despliegue separado del arranque; el contenedor en ejecución no recibe `DATABASE_URL_OWNER`.
5. Dominio con HTTPS; cookies `Secure` y `SameSite=Lax`; `ORIGENES_PERMITIDOS` y `BETTER_AUTH_URL` con el dominio real; `ALTA_DE_EMPRESAS=plataforma`.
6. Copias de seguridad y **una prueba real de restauración** antes del primer dato del taller.
7. Crear la empresa del piloto y sus usuarios con `pnpm plataforma`.

**Hecho cuando:** el dueño entra desde su celular por HTTPS, crea un cliente, y una restauración de prueba lo recupera.

### Fase 10b · Endurecer (M) · antes del primer cliente externo

1. Cabeceras de seguridad y límite de peticiones por usuario y por empresa.
2. Monitoreo de errores (si el usuario lo aprueba) con datos personales ocultos.
3. Exportar y borrar datos por empresa (Ley 29733).
4. Proveedor de correo: verificación de correo, invitaciones y restablecimiento por correo; reabrir el cambio de correo.
5. Segundo factor para los administradores de plataforma.
6. Lista de salida: variables, roles, restauración probada, alta de empresas cerrada o abierta según se decida.

---

### Después de los cimientos (cada uno con su propio plan)

Antes de escribir cada plan de módulo se estudia el área equivalente de Odoo según la tabla de `REFERENCIAS.md`. Los agentes siguen `ARQUITECTURA-DE-IA.md`.

1. **Registro, corte de voz** (empieza al cerrar las fases 7 y 10a): captura, borradores, bandeja de revisión, movimientos, deudas y abonos, con equivalencia contra las funciones SQL de Tairos.RC (ADR-008). Incluye el primer agente y el registro de uso por empresa. **Las metas del piloto se miden con datos, no a ojo:** cada borrador guarda su origen (voz o teclado), cuándo empezó el dictado, cuándo se aprobó y si se corrigió antes de aprobar; de ahí salen el 70 % sin corregir y los 30 segundos.
2. **Medición con los audios de la pista V** y luego con el uso real del taller.
3. **Cotizador** completo, portado de Cotizín.
4. **Resto del Registro** y **puente** cotización → orden → cobro (necesita la fase 8).

## 7. Tablero de avance

| Fase | Entrega | Tamaño | Antes del piloto | Estado |
|---|---|---|---|---|
| 0 | Fuentes a salvo, reglas, `pnpm check`, prueba de arquitectura, documentos al día | S | sí | **hecha 2026-11-14** (sin commit: falta permiso) |
| 1 | Configuración, registros, errores, contexto, contrato y dinero | S | sí | **hecha 2026-11-14** (sin commit) |
| 2 | Base, roles sin superusuario, aislamiento, pruebas de catálogo | M | sí | **hecha 2026-11-14** (sin commit) |
| 3a | Identidad y empresas en el servidor; rutas de autenticación cerradas | M | sí | **hecha 2026-11-14** (sin commit; 21 pruebas por HTTP real) |
| 3b | Pantallas de acceso | M | sí | pendiente |
| 4 | Módulos, contratación, permisos, comandos de plataforma | M | sí | **hecha 2026-11-14** (sin commit): tablas y funciones, manifiestos, catálogo validado, regla de acceso, guardas `@RequiereModulo` y `@RequierePermiso`, activación por defecto y `pnpm plataforma`. Pendiente: `restablecer` (necesita correo o consola) |
| 5a | Herramientas, auditoría, confirmación, idempotencia | M | sí | pendiente |
| 5b | Herramientas en la pantalla | S | sí | pendiente |
| 6a | Carcasa: navegación | M-L | sí | pendiente |
| 6b | Carcasa: usuarios y accesos | M | sí | pendiente |
| 7 | Clientes (corte de referencia) y Productos mínimos | M | sí | pendiente |
| 10a | Despliegue del piloto | M | sí | pendiente |
| 8 | Eventos y correlativos | M | no | pendiente |
| 9a | Consola de plataforma: servidor | M | no | pendiente |
| 9b | Consola de plataforma: pantallas | M | no | pendiente |
| 11 | Conectores y automatizaciones (11a marco, 11b primeros conectores, 11c pantallas) | L | no (ola 2) | pendiente · requiere aprobar ADR-014 |
| 12 | **Etapa final:** facturación electrónica SUNAT como conector de un proveedor OSE/PSE (ver `MODULOS-Y-MERCADO.md`, fila «Final») | M | no | pendiente · al final, con todo estable |
| 10b | Endurecer | M | no | pendiente |
| V | Audios reales y línea base (usuario) | — | en paralelo | pendiente |

Las fases 0 a 4 ya dejan una base segura.

## 8. Lo que debe decidir el usuario

Antes de empezar (bloquean la fase 0):
1. **Aprobar las decisiones ADR-009 a ADR-012** como quedan en la sección 2.5.
2. **Permiso para hacer commits** en este repositorio: uno base y uno por fase.
3. **Fuentes de Cotizín sin confirmar en git:** autorizar un commit en Cotizín, o que el constructor haga una copia de referencia (fase 0, paso 1). Recomendado: el commit; es trabajo que hoy no tiene respaldo.

Con recomendación ya puesta en el plan (se construye así salvo que digas otra cosa):
4. **Alta de empresas:** cerrada; las crea la plataforma. La alternativa es registro abierto con prueba gratis automática.
5. **Restablecer contraseña:** solo la plataforma, hasta tener proveedor de correo.
6. **Empresa nueva recibe el Registro en prueba de 30 días** (provisional desde la versión 1).

Más adelante:
7. **Imagen de la interfaz de referencia** (se necesita en la fase 6a).
8. ~~Alojamiento~~ **Decidido 2026-11-14: Neon** (ADR-003). Falta crear el proyecto (orden tuya, regla 14) y medir región en la fase 10a, **antes del piloto**.
9. **Pista V:** grabar los audios del taller y cronometrar 10 registros actuales. Cuanto antes, mejor.
