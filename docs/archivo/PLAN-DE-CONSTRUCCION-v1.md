# [SUSTITUIDO por la versión 2, 2026-11-14] Plan de construcción de los cimientos de Capaz ERP (versión 1)

**Versión 1 · 2026-11-11 · Para: el agente que construye (por ejemplo Sonnet) y quien lo supervisa.**
Este documento dice **cómo** construir, paso a paso. El **qué y el porqué** están en `PLAN-CIMIENTOS.md`, `ARQUITECTURA-DE-MODULOS.md`, `PLATAFORMA-Y-PLANES.md` y `docs/adr/`. Si algo choca, **manda este documento**.

---

## 0. Cómo usar este plan

1. Se trabaja **una fase por sesión**, en orden. No se empieza una fase si la anterior no cumple su «Hecho cuando».
2. Al abrir la sesión: leer este archivo completo, la fase que toca y los archivos que esa fase menciona. Nada más.
3. Al cerrar la fase: correr `pnpm check`, pegar el resultado en el informe, actualizar la casilla de la fase en la sección 6 y hacer un commit (`fase-N: resumen`). Sin permiso de commit del usuario, dejar los cambios sin confirmar y decirlo.
4. Informe de cierre, siempre con este formato: **qué se hizo · qué se verificó (comando y resultado) · qué no se hizo y por qué · desviaciones del plan · qué necesita el usuario**.
5. Si un paso no se puede cumplir como está escrito, **se para y se pregunta**; no se inventa un rodeo. Cada fase trae su lista de «Parar y preguntar si».

## 1. Reglas del constructor (no negociables)

1. **Las versiones instaladas son más nuevas que tu memoria.** NestJS 12, React Router 8, Tailwind 4, Zod 4, TypeScript 6, Vitest 4, Better Auth 1.7, Drizzle 0.45. Antes de usar una API, léela en `node_modules/<paquete>` o en su documentación oficial (NestJS: `https://docs.nestjs.com/llms.txt`). No escribas de memoria.
2. **Una sola puerta a la base:** el código de negocio solo toca la base dentro de `conEmpresa(ctx, fn)`. Ningún otro archivo crea conexiones ni lee `process.env`.
3. **Una sola puerta a las operaciones:** toda operación de negocio es una herramienta registrada y pasa por `ejecutar()`.
4. **La empresa, el usuario y los permisos salen de la sesión del servidor.** Nunca de argumentos, cabeceras propias ni del cuerpo.
5. **Toda tabla con `tenant_id` se protege** con `select core.aplicar_aislamiento('esquema.tabla')` en su migración. Una prueba lo exige.
6. **Nunca `drizzle-kit push`.** Solo `generate` más migraciones SQL a mano (`generate --custom`).
7. **Un módulo no importa a otro.** `core` no importa de `modules`. `infra` no importa de nadie. Una prueba lo exige.
8. **Sin e2e** (ni Playwright ni pruebas de navegador). Vitest unitarias y de integración contra PostgreSQL real.
9. **Dinero:** céntimos enteros (`bigint`) en el Registro y el núcleo; nunca `number` con decimales. Formato de salida `S/ 1,234.50` (locale `es-PE`).
10. **Nombres:** dominio y módulos en español sin tildes en identificadores (`conEmpresa`, `herramientas`, `clientes`), como en Cotizín, para portar sin renombrar. Infraestructura técnica (`infra/`) en inglés. Archivos en `kebab-case`. Textos de pantalla y mensajes de error en español.
11. **Archivos de más de 500 líneas se dividen.** Funciones de más de 50, también.
12. **No se copia ni se traduce código de Odoo.** Se puede leer en `/home/datayros/Documentos/work/referencias/odoo-20.0`.
13. **Cotizín y Tairos.RC son de solo lectura.** Se copia desde `/home/datayros/Documentos/work/modules/cotizin` y `…/SF-registro-conversacional`; no se modifica nada allí.
14. **No se activan servicios externos ni de pago** (NestJS Observe, Sentry, Neon, correo) sin orden del usuario.
15. **No se agregan dependencias fuera de las que nombra este plan** sin preguntar. En particular, no se adoptan paquetes con versión 0.x de NestJS (ver sección 2).
16. **Secretos:** solo en `.env` (ignorado por git). `.env.example` lleva los nombres con valores de desarrollo.
17. **Pantallas:** móvil primero. Cada pantalla nueva se revisa a mano a 390 px y 1280 px, en claro y oscuro, antes de darla por hecha, y se dice en el informe.

## 2. Qué cambió frente al plan anterior, y por qué

Verificado el 2026-11-11, con comandos en esta máquina y documentación oficial:

| Hallazgo | Evidencia | Decisión |
|---|---|---|
| Los paquetes «oficiales» de NestJS para datos y fiabilidad son muy nuevos | `npm view`: `@nestjs/drizzle` 0.0.2, `@nestjs/idempotency` 0.0.4, `@nestjs/outbox` 0.1.4, `@nestjs/authentication` 0.1.5, `@nestjs/authorization` 0.1.3 | **No se adoptan.** Módulo de base propio (ya existe), salida de eventos propia (≈150 líneas) e idempotencia propia (≈50 líneas). Se reevalúan cuando lleguen a 1.0 |
| `@nestjs/idempotency` no trae almacén para PostgreSQL | Su documentación: hay que implementar la interfaz | Refuerza lo anterior |
| `drizzle-kit` genera `ENABLE ROW LEVEL SECURITY` pero **no** `FORCE`, ni `GRANT` | Prueba local con dos esquemas y una política | La seguridad va en SQL a mano, con una función `core.aplicar_aislamiento()` y una prueba de catálogo. No se declaran políticas en el esquema de Drizzle |
| Varios esquemas y claves foráneas entre esquemas funcionan en `drizzle-kit` | Misma prueba | Se mantiene un esquema por módulo |
| `uuidv7()` existe en PostgreSQL 18 | `select uuidv7()` en el contenedor local | Identificadores `uuid` con `default uuidv7()` (ordenados por tiempo). Confirmar que el proveedor de producción lo soporte; si no, `gen_random_uuid()` |
| La variable de empresa vuelve a cadena vacía, no a nulo | Plantilla de Cotizín (`0001_aislamiento_y_roles.sql`) | La política compara con `NULLIF(current_setting('app.tenant_id', true), '')` |
| Better Auth: el paquete comunitario para NestJS declara compatibilidad con NestJS 12 | `npm view @thallesp/nestjs-better-auth peerDependencies` | Aun así **no se usa**: el guardia propio hace falta de todos modos para armar el contexto. Integración directa con `toNodeHandler` y `auth.api.getSession` |
| Validación con Zod en rutas | Documentación de NestJS: `StandardSchemaValidationPipe` de `@nestjs/common`, `@Body({ schema })` | Se usa para las pocas rutas REST; las herramientas validan en `ejecutar()` |
| Hetzner tiene centro en Ashburn, Virginia | Documentación de Hetzner | Candidato de alojamiento: servidor en Ashburn y base en la región de Virginia del proveedor, en la misma zona. **Sin medir todavía** |

Decisiones nuevas de esta revisión (el usuario debe aprobarlas; al aprobarlas, la fase 0 las convierte en ADR 009 a 012):

- **ADR-009. La puerta HTTP son las herramientas.** `POST /api/v1/herramientas/:nombre` ejecuta una herramienta registrada. El paquete `@capaz/shared` exporta el mapa de contratos (entrada y salida Zod por herramienta) y el cliente web queda tipado por ese mapa, sin generar código. Las rutas REST clásicas se agregan solo cuando un tercero las necesite, como envoltorios de las mismas herramientas.
- **ADR-010. Sin paquetes 0.x de NestJS en los cimientos.** Salida de eventos e idempotencia propias, sobre PostgreSQL.
- **ADR-011. Cuatro roles de base y un esquema técnico `auth`.**
  - `capaz_owner`: dueño de todo; solo corre migraciones.
  - `capaz_auth`: solo el esquema `auth` (tablas de Better Auth). Lo usa únicamente la librería de autenticación.
  - `capaz_app`: negocio. Sin `BYPASSRLS`, sin propiedad de tablas, **sin acceso a las tablas de `auth`** (no puede leer contraseñas ni sesiones). Ve a los miembros de su empresa por la vista `core.v_miembros`.
  - `capaz_sistema`: tareas que cruzan empresas (consola de plataforma y relevo de eventos). Solo tablas de contratación, planes y eventos de salida, y las funciones de plataforma. **Sin acceso a `registro`, `cotizador` ni `core.clientes`.**
  - Los esquemas de negocio siguen siendo los tres aprobados: `core`, `registro`, `cotizador`. `auth` es solo para la librería.
- **ADR-012. Convenciones de datos.** `tenant_id text` (id de organización de Better Auth), `uuid` con `uuidv7()`, `timestamptz` siempre, zona horaria por empresa (`America/Lima` por defecto) para cortes de día, correlativos por empresa con bloqueo de fila en `core.contadores`, y los movimientos de dinero se anulan, no se editan ni se borran.

Otros cambios de orden: las pantallas ya no esperan al final. Desde la fase 3 cada fase deja algo visible en el navegador.

## 3. Puntos ciegos revisados

| Punto | Decisión |
|---|---|
| Código de negocio leyendo contraseñas o sesiones | Rol y esquema aparte para la autenticación (ADR-011) |
| La plataforma viendo datos de sus clientes | `capaz_sistema` no tiene permiso sobre datos de negocio; lo comprueba una prueba |
| Correo para invitaciones y recuperación de contraseña | Fuera de los cimientos. La invitación genera un **enlace** que el administrador copia y envía por WhatsApp. Recuperar contraseña: la restablece el administrador de la empresa. Proveedor de correo: después |
| Costo de IA y de voz por empresa | Tabla `core.uso` (empresa, módulo, tipo, cantidad, costo) al construir la voz, con tope por empresa. No en los cimientos |
| El micrófono exige HTTPS | Para probar la voz en un celular hará falta un túnel o un dominio con certificado. Se resuelve en el plan de voz |
| Dinero con decimales en el Cotizador | El motor del Cotizador conserva `NUMERIC` con `big.js`; el Registro usa céntimos. La conversión vive en un único adaptador al construir el puente |
| «Caja de hoy» y cortes de día | Zona horaria por empresa (ADR-012) |
| Numeración de órdenes y proformas | `core.contadores` con bloqueo de fila; sin huecos por reintentos |
| Reintentos desde el celular con mala señal | Idempotencia por clave en las herramientas que crean dinero (fase 5) |
| Guardar un cambio y no avisar al otro módulo | Salida de eventos en la misma transacción (fase 8) |
| Protección de datos personales (Ley 29733) | El audio no se guarda por defecto; exportar y borrar datos por empresa antes del primer cliente externo; inventario de datos en `docs/DATOS-PERSONALES.md` al construir la voz |
| Copias de seguridad | Antes de datos reales: recuperación a un punto en el tiempo del proveedor y una exportación periódica. Fase 10 |
| Dos agentes editando a la vez | Una fase por sesión y un commit por fase. No se trabaja en paralelo sobre el mismo repositorio sin ramas |
| Sin e2e | Contratos compartidos, pruebas de integración y revisión visual manual obligatoria (regla 17) |
| Ataques por texto dictado o por datos de contactos | Los argumentos reservados se rechazan en `ejecutar()`; la confirmación solo vale desde la pantalla; el agente no aprueba |
| Límite de intentos de inicio de sesión | Activar el limitador propio de Better Auth en la fase 3 |
| Proveedor de producción sin `uuidv7()` o sin PostgreSQL 18 | Comprobar en la fase 10; alternativa `gen_random_uuid()` |

## 4. Estructura de carpetas objetivo

```
apps/api/
  drizzle/                    migraciones (generadas y SQL a mano)
  scripts/                    migrar.ts, plataforma.ts
  src/
    main.ts  app.module.ts
    infra/                    config/ logger/ database/ http/ health/
    db/                       esquema/ (un archivo por esquema: auth, core, registro, cotizador)
    core/
      auth/                   instancia de Better Auth, guardia, contexto
      empresas/               crear empresa, configuración, miembros
      modulos/                manifiestos, catálogo, guardas, contratación
      herramientas/           ejecutar, registro, confirmación, idempotencia
      auditoria/
      eventos/                salida de eventos y relevo
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
  respuesta.ts  permisos.ts  modulos.ts  dinero.ts
  contratos/                  un archivo por módulo: nombre de herramienta → { entrada, salida }
```

## 5. Fases

Tamaños: **S** corto, **M** medio, **L** largo. Estado en la sección 6.

---

### Fase 0 · Preparar el repositorio (S)

**Objetivo:** que cualquier agente trabaje con las mismas reglas y un solo comando de verificación.

**Pasos**
1. Crear `AGENTS.md` en la raíz con las 17 reglas de la sección 1, la tabla de documentos y el formato de informe. Crear `CLAUDE.md` con una sola línea que remita a `AGENTS.md`.
2. Reemplazar `apps/api/AGENTS.md` (generado por NestJS) por una nota corta: «Lee `/AGENTS.md`. Documentación de NestJS: https://docs.nestjs.com/llms.txt». Quitar toda mención a NestJS Observe.
3. Redactar ADR-009 a ADR-012 (sección 2) con el formato de los existentes.
4. Mover lo existente a la estructura de la sección 4: `src/config`, `src/database`, `src/health` → `src/infra/…`. Ajustar imports.
5. Pruebas: unitarias `*.spec.ts`; de integración `*.int.spec.ts` con `apps/api/vitest.int.config.ts`. La configuración unitaria debe excluir `*.int.spec.ts`.
6. Prueba de arquitectura `apps/api/src/arquitectura.spec.ts`: lee los `import` de `src/**` y falla si (a) `modules/X` importa `modules/Y`, (b) `core` importa `modules`, (c) `infra` importa `core` o `modules`, (d) un archivo supera 500 líneas. Lo mismo para `apps/web/src` (`modules`, `core`, `shared`).
7. Script raíz `pnpm check` = `build` de `shared` + `typecheck` + `lint` + pruebas unitarias + pruebas de integración.
8. Borrar el directorio de la prueba de concepto si quedó algo dentro del repositorio (no debería).

**Verificación:** `pnpm check` en verde. Meter a mano un import prohibido, ver que la prueba falla, y quitarlo.
**Hecho cuando:** existe `AGENTS.md`, `pnpm check` pasa y la prueba de arquitectura detecta una violación de ejemplo.
**Parar y preguntar si:** el usuario no ha aprobado las decisiones ADR-009 a 012.

---

### Fase 1 · Infraestructura del servidor (S)

**Objetivo:** configuración validada, registros útiles y errores con un solo formato.

**Pasos**
1. `infra/config`: esquema Zod de variables (`DATABASE_URL_OWNER`, `DATABASE_URL_APP`, `DATABASE_URL_AUTH`, `DATABASE_URL_SISTEMA`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CONFIRMACION_SECRET`, `PORT`, `NODE_ENV`). Se valida al arrancar y el proceso termina con un mensaje claro si falta algo. Es el **único** archivo que lee `process.env`. Actualizar `.env.example`.
2. `infra/logger`: registros en JSON con `pino` (dependencia permitida: `pino`, `pino-http`). Campos: `requestId`, `tenantId`, `userId`, ruta, estado, duración. Ocultar `authorization`, `cookie`, contraseñas y cuerpos.
3. `infra/http/contexto.ts`: `AsyncLocalStorage` con `{ requestId, tenantId, userId, rol, permisos, modulos, canal }`. Un middleware asigna `requestId` (cabecera `x-request-id` o `randomUUID()`); el resto lo llena el guardia en la fase 3.
4. `packages/shared/src/respuesta.ts`: tipo `Respuesta<T>` = `{ ok: true, datos: T } | { ok: false, error: { codigo, mensaje, detalles? } }` y su esquema Zod. Copiar la forma de `cotizin/src/shared/herramientas/tipos.ts` (función `rechazo`).
5. `infra/http/filtro-de-errores.ts`: filtro global que convierte cualquier excepción en `Respuesta` con `codigo` estable (`no_autenticado`, `sin_permiso`, `modulo_no_disponible`, `entrada_invalida`, `no_encontrado`, `conflicto`, `error_interno`) y su estado HTTP. Nunca devuelve trazas.
6. `StandardSchemaValidationPipe` global, con `exceptionFactory` que produzca `entrada_invalida`.

**Verificación:** arrancar sin `BETTER_AUTH_SECRET` falla con mensaje claro; `curl -i localhost:3001/api/nada` devuelve 404 con la forma `Respuesta`; el registro de esa petición trae `requestId`.
**Hecho cuando:** lo anterior se cumple y hay pruebas unitarias del esquema de configuración y del filtro.

---

### Fase 2 · Base de datos, roles y aislamiento (M)

**Objetivo:** que sea imposible, desde el código de negocio, leer datos de otra empresa.

**Fuentes para portar:** `cotizin/src/shared/db/con-empresa.ts`, `cotizin/drizzle/0001_aislamiento_y_roles.sql`, `cotizin/scripts/db/migrar.ts`, `cotizin/tests/db/aislamiento.test.ts`.

**Pasos**
1. `apps/api/drizzle.config.ts` con `schemaFilter: ['auth','core','registro','cotizador']` y `out: './drizzle'`. Esquema en `src/db/esquema/` con `pgSchema()` por esquema.
2. `scripts/migrar.ts` (se ejecuta con `DATABASE_URL_OWNER`):
   - crea los esquemas si no existen;
   - crea o actualiza los roles `capaz_auth`, `capaz_app` y `capaz_sistema` con `LOGIN`, contraseña tomada de variables de entorno y **sin** `BYPASSRLS`, `SUPERUSER` ni `CREATEROLE`; falla si alguno tiene `BYPASSRLS`;
   - aplica las migraciones en orden.
3. Primera migración a mano (`drizzle-kit generate --custom`), con esta función y permisos base:

```sql
create or replace function core.aplicar_aislamiento(tabla regclass) returns void
language plpgsql as $$
begin
  execute format('alter table %s enable row level security', tabla);
  execute format('alter table %s force row level security', tabla);
  execute format('drop policy if exists aislamiento on %s', tabla);
  execute format($p$create policy aislamiento on %s to capaz_app
      using      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
      with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''))$p$, tabla);
  execute format('grant select, insert, update, delete on %s to capaz_app', tabla);
end $$;

grant usage on schema core, registro, cotizador to capaz_app;
grant usage on schema auth to capaz_auth;
grant usage on schema core to capaz_sistema;
```

4. Primera tabla real: `core.empresa_config` (`tenant_id` clave primaria, `zona_horaria` por defecto `America/Lima`, `moneda` `PEN`, `locale` `es-PE`, `creado_en`). Su migración termina con `select core.aplicar_aislamiento('core.empresa_config');`.
5. `infra/database`: tres grupos de conexiones (`pg.Pool`): aplicación, autenticación y sistema. `conEmpresa(ctx, fn)` portado: abre transacción en el grupo de aplicación, hace `set_config('app.tenant_id', …, true)` y `set_config('app.user_id', …, true)`, guarda la transacción en `AsyncLocalStorage`, reutiliza la transacción si ya hay una y **lanza error** si se pide otra empresa dentro de la misma. `DatabaseService.ping()` usa el grupo de aplicación.
6. Base de pruebas: segunda base `capaz_test` en el mismo contenedor. `vitest.int.config.ts` con `globalSetup` que la crea si falta y corre `migrar.ts` sobre ella. Las pruebas **no vacían tablas**: cada una crea empresas con ids únicos.
7. Pruebas de integración (con el rol `capaz_app`, nunca con el dueño):
   - **Catálogo:** toda tabla de `core`, `registro` y `cotizador` que tenga columna `tenant_id` tiene `relrowsecurity` y `relforcerowsecurity` en verdadero y una política llamada `aislamiento`. La prueba falla si aparece una tabla nueva sin protección.
   - **Aislamiento:** la empresa A no ve, no modifica y no borra filas de la B; insertar con el `tenant_id` de otra empresa falla; sin `app.tenant_id` no se ve ninguna fila.
   - **Roles:** ningún rol de ejecución tiene `rolbypassrls`; `capaz_app` no puede hacer `select` en ninguna tabla de `auth`.
   - **`conEmpresa`:** anida bien y rechaza el cambio de empresa.
8. Scripts: `pnpm db:generar` (`drizzle-kit generate`), `pnpm db:migrar`.

**Verificación:** `pnpm db:migrar` dos veces seguidas no falla; `pnpm check` en verde; quitar a mano la llamada a `aplicar_aislamiento` hace fallar la prueba de catálogo (y se repone).
**Hecho cuando:** las cuatro pruebas pasan con `capaz_app`.
**Parar y preguntar si:** `drizzle-kit` intenta borrar o recrear objetos creados a mano; o si hace falta `BYPASSRLS` para que algo funcione (no hace falta: es señal de un diseño equivocado).

---

### Fase 3 · Identidad y empresas (M-L) · primera pantalla

**Objetivo:** registrarse, iniciar sesión, crear una empresa y que cada petición lleve su contexto.

**Fuentes para portar:** `cotizin/src/shared/auth/*`, `cotizin/src/shared/db/esquema/auth.ts`, pantallas de `cotizin/src/app/(auth)/`.

**Pasos**
1. Dependencia: `better-auth` en `apps/api` y `apps/web`. Antes de escribir, leer su documentación de la versión instalada sobre: adaptador de Drizzle, plugin `organization`, `toNodeHandler`, cliente de React.
2. Tablas de Better Auth en el esquema `auth`: copiar `esquema/auth.ts` de Cotizín, cambiar `pgTable` por `auth.table` y compararlo con lo que genera el CLI de Better Auth para la versión instalada. Migración a mano con los permisos: `grant select, insert, update, delete on all tables in schema auth to capaz_auth`. **Ningún permiso para `capaz_app`.**
3. `core/auth/auth.ts`: instancia con `drizzleAdapter` sobre el grupo de conexiones de autenticación, correo y contraseña, plugin `organization`, caché de sesión en cookie (5 minutos), limitador de intentos activado, `basePath: '/api/auth'`. Portar el `databaseHooks.session.create.before` que fija la empresa activa (la más antigua del usuario). Sin la parte de bcrypt: aquí no hay usuarios heredados.
4. `main.ts`: crear la aplicación con `bodyParser: false`, montar el manejador de Better Auth en `/api/auth/*` **antes** de los analizadores de cuerpo, y luego activar el analizador JSON para el resto. La sintaxis exacta de rutas comodín de Express 5 y de `useBodyParser` se verifica en la documentación instalada.
5. `core/auth/guardia.ts` (guardia global): obtiene la sesión con `auth.api.getSession({ headers })`; sin sesión responde `no_autenticado`, salvo rutas marcadas `@Publica()`. Con sesión llena el contexto (`userId`, `tenantId` = empresa activa, `rol`, `canal: 'ui'`). Decorador `@RequiereEmpresa()` para rutas que exigen empresa activa.
6. Vista `core.v_miembros` (creada por el dueño, sin `security_invoker`): miembros **de la empresa actual** con `usuario_id`, `nombre`, `correo`, `rol`, filtrando por `nullif(current_setting('app.tenant_id', true), '')`. `grant select` a `capaz_app`. Prueba: desde la empresa A no aparecen miembros de la B.
7. `POST /api/v1/empresas`: crea la organización con la API de servidor de Better Auth, la deja activa y, en una transacción `conEmpresa`, siembra `core.empresa_config`. La siembra es idempotente.
8. `GET /api/v1/yo`: usuario, empresa activa, rol y lista de empresas del usuario. Contrato Zod en `@capaz/shared`.
9. Web:
   - `shared/api/cliente.ts`: `fetch` con `credentials: 'include'`, valida la respuesta con el esquema compartido y devuelve `Respuesta<T>`. Dependencia: `@tanstack/react-query`.
   - Cliente de Better Auth para React, con el plugin de organización.
   - Pantallas `/registro`, `/iniciar-sesion`, `/nueva-empresa`; cierre de sesión.
   - Guardas de ruta: sin sesión → `/iniciar-sesion`; sin empresa → `/nueva-empresa`; con todo → `/inicio` (por ahora, un saludo con el nombre de la empresa).
10. Pruebas de integración: el gancho de sesión fija la empresa activa; crear empresa siembra la configuración; `yo` sin sesión devuelve `no_autenticado`; dos usuarios de empresas distintas obtienen contextos distintos.

**Verificación (manual, en el navegador, a 390 y 1280 px):** registrarse, crear empresa, cerrar sesión, volver a entrar y caer en `/inicio` con la empresa correcta. `pnpm check` en verde.
**Hecho cuando:** el recorrido funciona y la prueba de permisos confirma que `capaz_app` no lee `auth`.
**Parar y preguntar si:** Better Auth no acepta tablas en un esquema distinto de `public`; o si la cookie de sesión no viaja por el proxy de Vite.

---

### Fase 4 · Módulos, contratación y permisos (M)

**Objetivo:** que el acceso dependa de lo que la empresa contrató y de lo que su administrador asignó, y que la base lo haga cumplir.

**Fuentes para portar:** `cotizin/src/shared/db/esquema/modulos.ts`, `cotizin/drizzle/0016_registro_y_modulos.sql` (funciones `modulo_activo`, `activar_modulo`, `dar_baja_modulo` y el disparador del historial), `cotizin/src/shared/modulos/*` (`navegacion.ts` y sus pruebas).

**Pasos**
1. `packages/shared/src/modulos.ts`: tipo `ManifiestoDeModulo` = `{ codigo, nombre, descripcion, version, dependeDe[], permisos[], permisosPorNivel: { completo[], lectura[] }, secciones[], acento, icono, porDefecto?: { pruebaDias } }`. `packages/shared/src/permisos.ts`: los permisos son cadenas `recurso:accion`.
2. Manifiestos: `core` (siempre activo, no se contrata), `registro` y `cotizador` (por ahora con `secciones` vacías y marcados «en construcción»). Decisión comercial provisional, editable como dato: toda empresa nueva recibe `registro` en prueba de 30 días.
3. `core/modulos/catalogo.ts`: al arrancar valida que no haya códigos repetidos, dependencias inexistentes ni ciclos, y que cada permiso pertenezca a un solo módulo. Si falla, el servidor no arranca. Sincroniza el catálogo con `core.modulos`.
4. Tablas (todas con `tenant_id` llaman a `aplicar_aislamiento`, pero `capaz_app` solo tiene **lectura** sobre las de contratación: quitarle `insert`, `update` y `delete` tras aplicar la plantilla):
   - `core.modulos`, `core.planes`, `core.plan_modulos` (catálogos sin `tenant_id`; lectura para `capaz_app`).
   - `core.empresa_modulos`: estado `prueba | activo | suspendido | baja`, `alta_en`, `prueba_hasta`, `baja_en`, `motivo`, `plan`, `precio_acordado_centimos`, `vigente_hasta`, `max_usuarios`.
   - `core.empresa_modulos_eventos`: historial de solo inserción, escrito por disparador.
   - `core.usuario_modulos`: `tenant_id`, `usuario_id`, `modulo`, `nivel` (`completo | lectura`). Lectura y escritura para `capaz_app` (lo administra la empresa).
   - `core.solicitudes_modulo`: `tenant_id`, `modulo`, `usuario_id`, `nota`, `estado`.
   - `core.plataforma_admins`: `usuario_id`. Sin acceso para `capaz_app`.
5. Funciones SQL (`security definer`, dueño `capaz_owner`, `search_path` fijado):
   - `core.modulo_activo(tenant, modulo) returns boolean`: activo, o en prueba sin vencer. `grant execute` a `capaz_app`.
   - `core.activar_modulo`, `core.suspender_modulo`, `core.dar_baja_modulo`, `core.reactivar_modulo`: `grant execute` **solo** a `capaz_sistema`. Activar valida `dependeDe`.
   - `core.exigir_modulo(modulo)`: lanza excepción si el módulo no está activo para la empresa de la transacción. La usarán los disparadores de escritura de `registro` y `cotizador`.
6. Regla de acceso de usuario: `owner` y `admin` entran a todo módulo contratado con nivel completo; `member` solo a los que tenga en `core.usuario_modulos`. Sin asignación, no entra.
7. `core/modulos/acceso.ts` (función pura, portar `navegacion.ts` con sus pruebas): dado estado de contratación, rol y asignación devuelve `{ visible, puedeEntrar, puedeEscribir, motivo }` con motivos `activo | prueba | baja_solo_lectura | suspendido | no_contratado | sin_asignar`.
8. El guardia añade al contexto `modulos` y `permisos`. Decoradores `@RequiereModulo('x')` y `@RequierePermiso('y')`: responden `modulo_no_disponible` o `sin_permiso`.
9. `GET /api/v1/yo` incluye ahora los módulos con su estado, días de prueba restantes y secciones.
10. `scripts/plataforma.ts` (usa `DATABASE_URL_SISTEMA`): `pnpm plataforma activar|suspender|baja|reactivar --empresa <id> --modulo <codigo> [--prueba-dias N] [--motivo "…"]` y `pnpm plataforma admin --correo <correo>`. Es el modo de operar durante el piloto, hasta que exista la consola.
11. Al crear empresa (fase 3, paso 7) se activan los módulos `porDefecto` llamando a la función con el grupo de conexiones de sistema.

**Pruebas de integración:** un `member` sin asignación recibe `modulo_no_disponible`; con asignación entra; módulo en baja: `puedeEscribir` es falso y `core.exigir_modulo` lanza; prueba vencida equivale a baja; `capaz_app` no puede ejecutar `activar_modulo` ni escribir en `empresa_modulos`; cada cambio deja una fila en el historial; el arranque falla con un ciclo de dependencias; **`capaz_sistema` no puede leer `core.empresa_config` de datos de negocio ni nada de `registro` o `cotizador`**.
**Hecho cuando:** las pruebas pasan y `pnpm plataforma activar` cambia lo que devuelve `yo`.
**Parar y preguntar si:** hace falta que la empresa se active un módulo sola (no debe poder).

---

### Fase 5 · Herramientas, auditoría e idempotencia (M)

**Objetivo:** la única puerta a las operaciones, lista para pantalla, voz, agente y MCP.

**Fuentes para portar (con sus pruebas):** todo `cotizin/src/shared/herramientas/` (`ejecutar.ts`, `registro.ts`, `confirmacion.ts`, `tipos.ts`, `auditoria*.ts`, `errores-de-zod.ts`) y `cotizin/src/shared/hooks/use-llamador.tsx`.

**Pasos**
1. Portar a `core/herramientas/`. Cambios: cada herramienta declara `modulo` y `permiso`; `canal` admite `ui | agente | mcp | sistema`; `ejecutar()` comprueba, en este orden, argumentos reservados, módulo disponible, permiso, esquema de entrada, confirmación (si es crítica), ejecución dentro de `conEmpresa`, esquema de salida y auditoría. Conservar la lista `ARGUMENTOS_DE_CONTEXTO` y la regla de que la confirmación solo vale con `canal: 'ui'`.
2. `core.auditoria` (solo inserción; un disparador rechaza `update` y `delete`): `id`, `tenant_id`, `usuario_id`, `modulo`, `herramienta`, `canal`, `resultado`, `codigo`, `hash_args`, `request_id`, `duracion_ms`, `creado_en`. Sin argumentos en claro.
3. `core.idempotencia`: `tenant_id`, `clave`, `herramienta`, `hash_args`, `respuesta jsonb`, `creado_en`, con clave única (`tenant_id`, `clave`). En `ejecutar()`, para herramientas con `idempotente: true` y cabecera `Idempotency-Key`: misma clave y mismos argumentos devuelve la respuesta guardada; misma clave y otros argumentos responde `conflicto`. Se guarda **en la misma transacción** que la operación.
4. `POST /api/v1/herramientas/:nombre`: cuerpo `{ args, confirmacion? }`; responde `Respuesta`. Comprueba la cabecera `Origin`.
5. `packages/shared/src/contratos/`: por módulo, un objeto `nombre → { entrada, salida }` (esquemas Zod). El servidor registra cada herramienta **a partir de ese contrato**, de modo que no puedan divergir. Una prueba comprueba que toda herramienta registrada tiene contrato y viceversa.
6. Web `shared/api/herramientas.ts`: `llamar(nombre, args)` tipado por el mapa de contratos, con cola en serie para escrituras (portar `use-llamador`), generación de `Idempotency-Key` y flujo de confirmación en dos pasos con un diálogo.
7. Herramientas de ejemplo en `core`: `empresa_ver_configuracion` (lectura) y `empresa_actualizar_configuracion` (crítica, con confirmación; recibe solo lo que cambia y fusiona con la fila bloqueada `for update`).
8. Guardar el contexto en la auditoría también cuando la llamada se rechaza.

**Pruebas:** las portadas de Cotizín en verde; más: argumento reservado rechazado y auditado; confirmación con otro usuario, otra empresa u otros argumentos rechazada; confirmación con `canal: 'agente'` rechazada; idempotencia (repetición y conflicto); la auditoría no admite `update` ni `delete`.
**Verificación manual:** en la pantalla de ajustes de empresa, cambiar la zona horaria pide confirmación y queda auditado.
**Hecho cuando:** las pruebas pasan y una herramienta nueva se puede agregar tocando solo su contrato y su archivo.

---

### Fase 6 · Carcasa de pantalla (L; se puede partir en 6a y 6b)

**Objetivo:** la estructura visible del ERP, según la interfaz de referencia de `PLAN-CIMIENTOS.md`.

**Fuentes para portar:** `cotizin/.claude/design-systems/pliego/pliego.md`, `cotizin/tailwind.config.ts` (tokens), `cotizin/src/shared/components/erp/` (barra lateral, tarjeta de módulo, kit), `cotizin/docs/diseno/kit-erp.md`.

**6a · Navegación**
1. Tokens Pliego en `shared/estilos` con `@theme` de Tailwind 4, en claro y oscuro (automático, con opción manual guardada por dispositivo). Fuentes Bricolage Grotesque, Instrument Sans y JetBrains Mono, servidas desde el propio proyecto (`@fontsource`).
2. Portar el kit mínimo: botón, campo, diálogo, hoja inferior, insignia de estado, estado vacío, esqueleto de carga, avisos. Cambiar `next/link` y `next/navigation` por React Router.
3. Layout con sesión: encabezado delgado (Inicio, migas, selector de empresa, usuario) y barra lateral con las secciones del módulo abierto. Móvil: barra inferior con cuatro destinos y «Más». Tableta: barra lateral solo con íconos.
4. `/inicio`: saludo y una tarjeta por módulo del catálogo, con su estado tomado de `yo`: activo, prueba (días restantes), baja (solo lectura), suspendido, no contratado (botón «Solicitar», que crea una fila en `core.solicitudes_modulo`), sin asignar («pide acceso a tu administrador»).
5. Rutas de módulo generadas desde los manifiestos; un módulo sin acceso redirige a `/inicio` con aviso. `registro` y `cotizador` muestran «En construcción».
6. Selector de empresa: cambia la empresa activa con Better Auth y recarga `yo`.
7. `shared/formato`: soles, fechas y horas en `es-PE` con la zona horaria de la empresa. Con pruebas unitarias.

**6b · Usuarios y accesos**
8. `/ajustes/usuarios` (solo `owner` y `admin`): lista de miembros (por `core.v_miembros`), cambio de rol, y por cada miembro los módulos contratados con un selector `sin acceso | lectura | completo`.
9. Invitar: genera un **enlace de invitación** de Better Auth que el administrador copia (sin correo). Pantalla de aceptación del enlace.
10. Herramientas: `miembros_listar`, `miembro_asignar_modulo`, `miembro_cambiar_rol`, `invitacion_crear`. Respeta `max_usuarios` del módulo.

**Verificación manual obligatoria:** todas las pantallas a 390 y 1280 px, claro y oscuro; texto sin cortes; foco visible; nada se desborda en horizontal.
**Hecho cuando:** un `member` sin módulos ve las tarjetas bloqueadas, el administrador le asigna uno y, al recargar, entra.
**Parar y preguntar si:** el usuario entrega la imagen de la interfaz de referencia y difiere de lo descrito.

---

### Fase 7 · Corte de referencia: Clientes (M)

**Objetivo:** el primer recorrido completo, que sirve de plantilla para todo módulo y de base del CRM.

**Fuentes de referencia:** `cotizin/src/shared/db/esquema/clientes.ts`, `cotizin/src/features/clientes/`, y para ideas de modelo `odoo/addons/base/models/res_partner.py` (solo lectura).

**Pasos**
1. `core.clientes`: `id`, `tenant_id`, `tipo` (`persona | empresa`), `nombre`, `documento_tipo`, `documento_numero`, `telefono`, `correo`, `notas`, `archivado_en`, `creado_en`, `actualizado_en`. Único por (`tenant_id`, nombre normalizado) entre los no archivados. Con `aplicar_aislamiento`.
2. Capas, cada una en su carpeta: `domain` (normalización de nombre y teléfono, reglas puras con pruebas), `repositories`, `herramientas` (`clientes_listar`, `clientes_ver`, `clientes_crear`, `clientes_editar`, `clientes_archivar`; crear es idempotente), contratos en `@capaz/shared`.
3. Permisos `clientes:ver` y `clientes:editar` en el manifiesto de `core`.
4. Web `core/clientes`: lista con búsqueda y estado vacío, alta en hoja inferior (móvil) o diálogo (escritorio), ficha con edición y archivado.
5. Escribir `docs/COMO-CREAR-UN-MODULO.md`: la lista de pasos seguida aquí, como receta para Registro y Cotizador.

**Pruebas:** dominio (unitarias); herramientas contra base real con dos empresas; nombre duplicado responde `conflicto`; un `member` con nivel `lectura` no puede crear.
**Hecho cuando:** se crea un cliente desde el celular, otra empresa no lo ve, y la receta está escrita.

---

### Fase 8 · Eventos entre módulos y correlativos (M)

**Objetivo:** que un módulo avise a otro sin conocerlo y sin perder avisos.

**Pasos**
1. `core.eventos_salida`: `id`, `tenant_id`, `tipo`, `carga jsonb`, `creado_en`, `disponible_en`, `procesado_en`, `intentos`, `ultimo_error`. Políticas: `capaz_app` solo inserta filas de su empresa; `capaz_sistema` lee y actualiza todas.
2. `core.eventos_procesados`: (`evento_id`, `consumidor`) única. Garantiza que cada consumidor procese una sola vez.
3. `core/eventos`: `emitir(tx, tipo, carga)` exige la transacción activa (falla sin ella). Contratos de eventos con Zod en `@capaz/shared`. Registro de consumidores declarado en cada manifiesto.
4. Relevo dentro del mismo proceso: cada segundo toma un lote con `for update skip locked` (grupo de conexiones de sistema), y por cada evento y consumidor abre `conEmpresa` con `canal: 'sistema'`, inserta en `eventos_procesados` y ejecuta el consumidor en esa misma transacción. Reintentos con espera creciente; tras 8 intentos queda marcado como fallido y se registra. Si el módulo del consumidor no está activo para esa empresa, se marca como procesado sin ejecutar.
5. `core.contadores` (`tenant_id`, `clave`, `anio`, `ultimo`) y `siguienteNumero(tx, clave, anio)` con bloqueo de fila.
6. Ejemplo real: `clientes_crear` emite `cliente.creado`; un consumidor de demostración en `core` lo registra.

**Pruebas:** si la transacción se revierte, no hay evento; el mismo evento entregado dos veces se procesa una vez; un consumidor que falla se reintenta y no bloquea a los demás; dos llamadas simultáneas a `siguienteNumero` dan números distintos y consecutivos.
**Hecho cuando:** las pruebas pasan. Queda preparado el puente cotización → orden.

---

### Fase 9 · Consola de plataforma (L) · antes del segundo cliente

**Objetivo:** operar empresas, módulos, planes y precios desde la pantalla. Detalle en `PLATAFORMA-Y-PLANES.md`.

**Pasos**
1. Guardia `@SoloPlataforma()`: el usuario debe estar en `core.plataforma_admins`. Registro de herramientas **aparte** (`/api/v1/plataforma/herramientas/:nombre`), que ejecuta con el grupo de conexiones de sistema y audita en `core.auditoria_plataforma`.
2. Funciones SQL de lectura para la consola, `security definer`, que devuelven **solo** contratos y cifras agregadas: nombre de la empresa, fecha de alta, número de usuarios, módulos con estado, plan, precio, vencimientos, última actividad. Nunca filas de negocio.
3. Herramientas: listar empresas, ver ficha, activar, suspender, dar de baja y reactivar módulo, fijar plan, precio acordado, vigencia y límite de usuarios, gestionar planes y sus precios, listar y atender solicitudes.
4. Web `/plataforma`: empresas, ficha con un interruptor por módulo e historial, planes y precios, solicitudes y vencimientos, resumen.
5. Al atender una solicitud se crea o enlaza el cliente correspondiente en el CRM de la empresa operadora (la empresa de Datayros dentro de Capaz).

**Pruebas:** un usuario normal recibe `sin_permiso` en toda ruta de plataforma; **una prueba recorre el catálogo y confirma que `capaz_sistema` no tiene `select` sobre ninguna tabla de `registro`, `cotizador` ni `core.clientes`**; bajar un módulo desde la consola deja a esa empresa en solo lectura; todo cambio queda auditado con el actor.
**Hecho cuando:** se puede dar a una empresa el Cotizador sin el Registro, con precio y vigencia, desde la pantalla.
**Parar y preguntar si:** se pide «entrar como la empresa» o ver sus datos: no está en el alcance y requiere una decisión aparte.

---

### Fase 10 · Preparar producción (M) · necesita decisiones del usuario

1. Medir desde Perú la latencia a las regiones candidatas y el arranque en frío de la base. Proponer región y alojamiento con los números.
2. `Dockerfile` de varias etapas: compila `shared`, `web` y `api`; la API sirve la web compilada (mismo origen) y responde `index.html` a las rutas que no empiezan por `/api`.
3. Migraciones como paso de despliegue separado del arranque.
4. Cabeceras de seguridad, cookies `Secure` y `SameSite=Lax`, comprobación de `Origin`, límite de peticiones.
5. Copias de seguridad y una prueba real de restauración.
6. Monitoreo de errores (si el usuario lo aprueba) con datos personales ocultos.
7. Lista de salida: variables, roles sin `BYPASSRLS` en producción (los roles creados desde la consola del proveedor pueden traerlo: crearlos siempre por SQL), `uuidv7()` disponible, restauración probada.

---

### Después de los cimientos (cada uno con su propio plan)

Antes de escribir cada plan de módulo se estudia el área equivalente de Odoo según la tabla de `REFERENCIAS.md`. Los agentes siguen `ARQUITECTURA-DE-IA.md`.

1. **Registro, corte de voz:** captura, borradores, bandeja de revisión, movimientos, deudas y abonos, con equivalencia contra las funciones SQL de Tairos.RC (ADR-008). Incluye el primer agente y el registro de uso por empresa.
2. **Medición con audios reales** del taller: 70 % sin corregir y 30 segundos por registro.
3. **Cotizador** completo, portado de Cotizín.
4. **Resto del Registro** y **puente** cotización → orden → cobro.

## 6. Tablero de avance

| Fase | Entrega | Tamaño | Estado |
|---|---|---|---|
| 0 | Repositorio, reglas, `pnpm check`, prueba de arquitectura | S | pendiente |
| 1 | Configuración, registros, errores, contexto | S | pendiente |
| 2 | Base, roles, aislamiento | M | pendiente |
| 3 | Identidad y empresas; pantallas de acceso | M-L | pendiente |
| 4 | Módulos, contratación, permisos | M | pendiente |
| 5 | Herramientas, auditoría, idempotencia | M | pendiente |
| 6 | Carcasa; usuarios y accesos | L | pendiente |
| 7 | Clientes (corte de referencia) | M | pendiente |
| 8 | Eventos y correlativos | M | pendiente |
| 9 | Consola de plataforma | L | pendiente |
| 10 | Preparar producción | M | pendiente |

Las fases 0 a 4 ya dejan una base segura. La 9 puede ir antes de la 8 si el segundo cliente llega pronto.

## 7. Lo que debe decidir el usuario antes de empezar

1. Aprobar las decisiones ADR-009 a ADR-012 (sección 2).
2. Permiso permanente para hacer un commit por fase en este repositorio.
3. Confirmar la decisión comercial provisional: empresa nueva recibe el Registro en prueba de 30 días.
4. Enviar la imagen de la interfaz de referencia (se necesita en la fase 6).
5. Alojamiento: se decide en la fase 10 con mediciones; no bloquea el inicio.
