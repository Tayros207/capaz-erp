# Fichas congeladas de la ola 2 · Clásicos I (Finanzas ligeras, CRM, Pedidos)

**Versión 1 · 2026-11-15 · Estado: CONGELADA en la puerta entre olas (`PLAN-PARALELO.md` §6.3). Para: los agentes de carril de la ola 2 (Sonnet, esfuerzo medio) y el integrador.**

Este documento sustituye a la tabla «fichas versión 1» de las fases 14, 15 y 16 de `PLAN-DE-CONSTRUCCION.md`. Se escribió leyendo el código real que dejó la ola 1. **Si este documento y el código se contradicen, el carril para y pregunta.** Un cambio a lo que aquí está escrito lo hace solo el integrador (regla 23).

## 0. Cómo leerlo

- **Agente de carril:** lee la sección 1 (reglas comunes), y **solo** la sección de tu carril (el brief te dice cuál). Tu ficha corta, con propiedad de archivos y verificación, está en `PLAN-PARALELO.md` §5.
- Búscala con `grep -n '^## \|^### ' docs/FICHAS-OLA-2.md` y lee solo ese tramo.

| § | Contenido | Carril |
|---|---|---|
| 1 | Reglas comunes de todo módulo clásico | todos |
| 2 | Paso previo de servidor | C1 |
| 3 | Datos: migraciones `0013` a `0016` | DB2a, DB2b |
| 4 | Módulo `registro` (Finanzas ligeras) | M-registro-s1, s2, s3 · M-registro-w1, w2 |
| 5 | Módulo `crm` | M-crm-s1, s2 · M-crm-w |
| 6 | Módulo `ordenes` (Pedidos) | M-ordenes-s1, s2 · M-ordenes-w |
| 7 | Kit y base web de la ola | K1a, K1b |
| 8 | Inicio y bandeja con pendientes | N1 |
| 9 | Cierre de la ola | X2 |

## 1. Reglas comunes de todo módulo clásico

Valen además de `AGENTS.md` y de `docs/COMO-CREAR-UN-MODULO.md` (la receta; estas reglas la precisan para módulos que **no** son del núcleo).

**R1 · Carpeta y capas.** `apps/api/src/modules/<codigo>/` con `domain/` (puro, con pruebas unitarias), `repositories/` (reciben `tx` y `{ empresaId, usuarioId }`), `herramientas/` (una por operación, archivos de lectura y de escritura aparte, mapeo fila→DTO en su archivo), `consumidores.ts`, `fuentes.ts` y `<codigo>.module.ts` con **un** proveedor `HerramientasDe<Codigo>` que en `onModuleInit` registra herramientas (`RegistroDeHerramientas.agregar`), consumidores (`RegistroDeConsumidores.agregar`) y fuentes de tiempo (`RegistroDeFuentesDeTiempo.agregar`). Los tres registros son globales: se inyectan con `@Inject(...)`, sin importar sus módulos de Nest.

**R2 · `modulo` y permisos.** Toda herramienta declara `modulo: '<codigo>'` (nunca `'core'`) y un permiso del manifiesto del módulo. Consecuencias que ya hace el ejecutor (`core/herramientas/ejecutor.ts`, `comprobarAcceso`), **no las repitas en la herramienta**:
- sin acceso al módulo → `modulo_no_disponible`;
- herramienta `normal` o `critica` con el módulo en baja, suspendido, prueba vencida o con nivel `lectura` → `modulo_solo_lectura` (la exención de `puedeEscribir` es **solo** del módulo `core`);
- sin el permiso → `sin_permiso`.

**R3 · Solo lectura también en la base.** Cada tabla del módulo lleva el disparador `core.exigir_modulo_en_escritura('<codigo>')` (lo crea DB2; §3). Si una prueba siembra filas con SQL directo, primero activa el módulo de esa empresa (`activarModulo`, §2 paso 7).

**R4 · Alcance «propios».** `alcanceDe(ctx, '<codigo>')` (`core/modulos/alcance.ts`, lo crea C1) devuelve `'todos'` o `'propios'`. Con `'propios'`, las herramientas de documentos (movimientos, deudas, oportunidades, actividades, pedidos) solo ven y cambian las filas donde `creado_por = ctx.usuarioId` **o** `responsable_id = ctx.usuarioId` (cuando la tabla tiene responsable). Una fila ajena responde `no_encontrado`. Los catálogos del módulo (cuentas, categorías, etapas) no tienen alcance. Las herramientas `<codigo>_resumen` y `caja_del_dia` exigen alcance `'todos'`; con `'propios'` responden `sin_permiso` con el mensaje «Tu acceso es solo a tus propios registros.».

**R5 · Un consumidor de eventos nunca ejecuta herramientas.** El relevo le entrega un contexto de sistema con permisos de administrador (`core/eventos/relevo.ts`, `contextoDeSistema`). Por eso un consumidor de módulo **solo** puede: leer sus propias tablas y llamar a `proponerBorrador(tx, …)` con `origen: 'modulo'`, `propuestoPor: 'sistema'` y `origenRef: '<entidad>:<id>'`. Prohibido en `consumidores.ts`: importar `EjecutorDeHerramientas`, llamar a `ejecutarDentro`, escribir en tablas del módulo. Lo que otro módulo debería registrar llega a la bandeja; lo aprueba una persona.

**R6 · Entre módulos no hay llaves foráneas ni imports.** Un módulo referencia un documento de otro con el par blando `origen_tipo text` + `origen_id text` (sin llave foránea). Sí hay llaves foráneas compuestas hacia el núcleo (`core.clientes`, `core.productos`, `core.sucursales`).

**R7 · Fechas y cortes de día.** Las columnas `date` son el día contable en la zona horaria de la empresa. El servidor calcula «hoy» con `hoyDeLaEmpresa(tx)` (`core/empresas/hoy.ts`, lo crea C1): devuelve `{ zona, dia: 'AAAA-MM-DD', anio }`. Nunca `new Date()` para decidir el día ni el año de un correlativo. En contratos: `z.iso.date()` para días y `z.iso.datetime()` para instantes.

**R8 · Correlativos.** `siguienteNumero(tx, clave, { serie?, anio })` (`core/correlativos/siguiente-numero.ts`): **`anio` es obligatorio** (el plan decía opcional; manda el código). Funciona dentro de `ejecutar` y de `ejecutarDentro`. Las claves están fijadas en cada módulo. El código visible (`MOV-2026-000123`) se arma en `domain/` con una función pura probada; en la base se guardan `numero`, `anio` y, si aplica, `serie`.

**R9 · Dinero.** Céntimos enteros para importes, milésimas enteras para cantidades y precios unitarios; `importe(cantidad, precio)` de `@capaz/shared` es la única multiplicación permitida. En contratos: `z.number().int().safe()` con su mínimo. Los movimientos de dinero se anulan; no se editan ni se borran.

**R10 · Catálogos por defecto.** Un módulo con catálogos (cuentas, categorías, etapas) trae una función `asegurarCatalogos(tx, ctx)` idempotente (`insert … on conflict do nothing`) que: (a) expone la herramienta `<codigo>_iniciar`; (b) se llama al empezar toda herramienta de escritura que necesite un valor por defecto. Las herramientas de lectura **no** siembran (con el módulo en baja la base rechazaría la escritura).

**R11 · Listados.** Entrada `paginaSchema.shape` más filtros; salida `listadoSchema(item)`. Orden y cursor por `(creado_en, id)` descendente, salvo que la ficha diga otro; modelo de cursor por instante: `core/borradores/repositorio.ts` (el instante viaja como texto de PostgreSQL para no perder microsegundos). Cursor inválido → `argumentos_invalidos`.

**R12 · Eventos.** Los esquemas de los eventos de la ola están ya en `packages/shared/src/contratos/<codigo>.ts` (los puso C1, copiados de este documento). El carril **no** los cambia; si no alcanzan, solicitud de cambio. `emitir(tx, …)` va después de que el cambio ocurrió y solo si cambió algo.

**R13 · Auditoría.** `auditar` devuelve `entidadTipo`, `entidadId` y, en `resumen`, solo números, estados y códigos de documento. Nunca nombres de personas, documentos, teléfonos ni notas libres.

**R14 · Herramientas críticas.** Llevan `resumir` con una `huella` (`hashCanonico`) del estado que se confirma. Modelo: `core/sucursales/herramientas/sucursales-herramientas.ts` (`sucursal_marcar_principal`). Una crítica no se puede ejecutar por `canal: 'sistema'`.

**R15 · Tamaño de sesión.** Ninguna sesión registra más de 13 herramientas. Los carriles vienen partidos (s1, s2, s3) y **cada parte se integra por separado**. El servidor no arranca si un contrato no tiene herramienta: cada parte agrega al archivo de contratos **solo** las herramientas que implementa.

**R16 · Nombres en Drizzle.** Las constantes exportadas de las tablas llevan el prefijo del módulo (`registroMovimientos`, `crmEtapas`, `ordenesPedidos`): `src/db/esquema/index.ts` reexporta todo con `export *` y dos tablas con el mismo nombre de constante chocan.

**R17 · Pruebas mínimas de todo módulo** (además de las de su sección):
1. dominio, unitarias;
2. por HTTP real con dos empresas (`levantarApp`, `abrirSesion`, `crearEmpresa`, `activarModulo`, `agregarMiembro`): alta correcta y su evento en `core.eventos_salida`; validación (`argumentos_invalidos` por campo inválido y por campo de más);
3. otra empresa no ve nada, ni por id (`no_encontrado`) ni en listados;
4. un `member` con nivel `lectura` lee y recibe `modulo_solo_lectura` al escribir; un `member` sin el módulo asignado recibe `modulo_no_disponible`;
5. un `member` con alcance `propios` no ve lo de otra persona;
6. módulo dado de baja (`select core.dar_baja_modulo(...)` con el grupo `sistema`): la lectura funciona, la escritura responde `modulo_solo_lectura`, **y un `insert` directo con `capaz_app` falla** con «no está activo» (disparador);
7. idempotencia con `Idempotency-Key` en las herramientas marcadas idempotentes;
8. cada crítica pide confirmación y no cambia nada hasta confirmar;
9. paginación con cursor.

**R18 · Pantallas.** Rutas bajo `m/<codigo>/…` en `apps/web/src/modules/<codigo>/rutas.tsx`. Solo piezas del kit (`shared/ui`), sin colores, tamaños ni sombras sueltas (las clases de distribución —`flex`, `grid`, `gap-*`— sí). Lecturas con `@tanstack/react-query` usando el proveedor global (lo pone K1a): **no** crees un `QueryClient` propio. Modelo de pantallas: `apps/web/src/core/clientes/`. Botones de escritura visibles solo si `puedeEscribirEn(yo, '<codigo>')` y `puede(yo, '<permiso>')`. Móvil primero: alta en `HojaInferior`; listas con `Lista`; revisión a 390 y 1280 px, claro y oscuro (lista en el informe). Ningún nombre de pantalla, texto, icono ni disposición tomado de otro ERP (regla 12).

## 2. C1 · Paso previo de servidor

Deja listo lo compartido para que ningún carril de módulo toque archivos ajenos. Lo hace el integrador o un solo Sonnet; mientras dura, nadie más trabaja en `apps/api` ni en `packages/shared` (DB2a sí puede: sus archivos son otros).

1. **Eventos de la ola 2** en `packages/shared/src/contratos/{registro,crm,ordenes}.ts`: copiar tal cual los bloques `eventosDe…` de §4.3, §5.3 y §6.3. `contratosDe…` sigue `{}`.
2. **Origen `modulo` en borradores:** agregar `'modulo'` a `ORIGENES_DE_BORRADOR` (`contratos/borradores.ts`); en `core/borradores/proponer.ts` el tipo de `origen` pasa a `(typeof ORIGENES_DE_BORRADOR)[number]`; en `apps/web/src/core/bandeja/logica.ts`, `ETIQUETA_DE_ORIGEN.modulo = 'Otro módulo'`. (El `CHECK` de la base lo cambia DB2a en `0013`; hasta entonces nadie propone con ese origen.)
3. `apps/api/src/modules/registro/registro.module.ts` vacío (como `crm.module.ts`) e importarlo en `app.module.ts`. Hoy `registro` solo tiene manifiesto.
4. `apps/api/src/core/modulos/alcance.ts`: `export function alcanceDe(ctx: ContextoDeHerramienta, modulo: string): 'todos' | 'propios'` (`'propios'` solo si el acceso de ese módulo en `ctx.modulos` dice `alcance: 'propios'`; en cualquier otro caso `'todos'`). Prueba unitaria.
5. `apps/api/src/core/empresas/hoy.ts`: `export async function hoyDeLaEmpresa(tx: Transaccion): Promise<{ zona: string; dia: string; anio: number }>` (lee `core.empresa_config.zona_horaria`; sin fila, `America/Lima`; usa `diaLocal` de `core/automatizaciones/condiciones.ts`) y `export const instanteDeDia = (dia: string): Date => new Date(`${dia}T12:00:00Z`)` (mediodía UTC: el día local coincide en cualquier zona entre UTC−11 y UTC+11; lo usan las fuentes de tiempo). Pruebas con reloj fijo y dos zonas.
6. `apps/api/src/pruebas/app-de-pruebas.ts`: `AppDePruebas` gana `obtener<T>(token: Type<T> | symbol): T` (devuelve `app.get(token)`), para que una prueba llame a `Relevo.procesarLote()`.
7. `apps/api/src/core/herramientas/http-de-pruebas.ts`: `activarModulo(empresaId, codigo)` (grupo `sistema`: `select core.activar_modulo($1, $2, null, 'pruebas')`), `darDeBajaModulo(empresaId, codigo)` y `agregarMiembro(app, empresaId, sesion, { modulo, nivel, alcance })` (inserta en `auth.member` con el grupo `auth` y en `core.usuario_modulos` con `comoEmpresa`, y fija la empresa activa de esa sesión).
8. **Arreglo de la ola 1 que se cuela aquí porque bloquea el uso real** (`core/conectores/enviar.ts`): el `lookup` propio debe responder en la forma que Node 24 pide cuando llega `{ all: true }` (`cb(null, [{ address, family }])`); hoy un destino con nombre de host falla con `ERR_INVALID_IP_ADDRESS`. Prueba nueva con un nombre de host y resolver inyectado. Ver `PLAN-PARALELO.md` §10.

**Pruebas exigidas:** las de los pasos 4, 5 y 8; `pnpm check` completo en verde. **Hecho cuando:** un carril de módulo puede escribir un consumidor de `pedido.confirmado` que compila, y una prueba puede activar un módulo y crear un miembro con una línea cada cosa.

## 3. Datos de la ola 2 (DB2a y DB2b)

Convenciones (las de `PLAN-DE-CONSTRUCCION.md` §6.4, más estas): un archivo de esquema por módulo (`src/db/esquema/{registro,crm,ordenes}.ts`, con `pgSchema('<codigo>')`) exportado en `index.ts`; constantes con prefijo (R16); llaves hacia el núcleo importando `clientes`, `productos` y `sucursales` de `./core-maestros.js`. **`capaz_sistema` no recibe nada** en ninguna tabla de esta ola: `PERMITIDO` y `PERMITIDO_POR_COLUMNA` no cambian. En todas las tablas: `id uuid primary key default uuidv7()`, `tenant_id text not null`, `creado_en timestamptz not null default now()`; donde se diga `actualizado_en`, es `timestamptz not null default now()` con el disparador `core.tocar_actualizado_en`. «→» es una llave foránea **compuesta** `(tenant_id, x)` → `(tenant_id, id)`. Todo índice empieza por `tenant_id`.

Bloque de seguridad a mano, por tabla, en este orden: `select core.aplicar_aislamiento('<esquema>.<tabla>', '<modo>');` · disparador de `actualizado_en` si aplica · `create trigger <tabla>_modulo before insert or update or delete on <esquema>.<tabla> for each row execute function core.exigir_modulo_en_escritura('<codigo>');` · lo particular de la tabla.

### 3.1 Tanda DB2a

**`0013_modulos_clasicos_base`** (generada + a mano)
1. `core-maestros.ts`: agregar `unique('productos_empresa_id').on(t.tenantId, t.id)` en `productos` y `unique('sucursales_empresa_id').on(t.tenantId, t.id)` en `sucursales` (hoy solo `clientes` lo tiene, y los módulos las van a referenciar).
2. `core-automatizaciones.ts`: el `CHECK` `borrador_origen` admite además `'modulo'`.
3. `pnpm db:generar --name=modulos_clasicos_base`; al final, a mano:
```sql
create schema if not exists crm;
--> statement-breakpoint
create schema if not exists ordenes;
--> statement-breakpoint
grant usage on schema crm, ordenes to capaz_app;
--> statement-breakpoint
-- Disparador genérico de «módulo en baja = solo lectura». El código del módulo llega como argumento.
create or replace function core.exigir_modulo_en_escritura() returns trigger
language plpgsql set search_path = core, pg_temp as $$
begin
  perform core.exigir_modulo(tg_argv[0]);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
```
   Sin `grant execute` (igual que `core.tocar_actualizado_en`: una función de disparador no se ejecuta por permiso de quien escribe); adentro llama a `core.exigir_modulo`, que `capaz_app` ya puede ejecutar. El esquema `registro` ya existe y `capaz_app` ya tiene `usage` (migración `0000`).
4. `drizzle.config.ts`: `schemaFilter: ['auth', 'core', 'registro', 'cotizador', 'crm', 'ordenes']`.
5. Listas de esquemas de las tres pruebas: agregar `'crm'` y `'ordenes'` en `catalogo.int.spec.ts` (`ESQUEMAS` **y** la lista de esquemas vedados a `capaz_sistema`), `aislamiento.int.spec.ts` (consulta de cobertura) y `contratacion.int.spec.ts` (las dos consultas de la lista de plataforma).
6. `aislamiento.int.spec.ts`, `beforeAll`: antes de sembrar `EJEMPLOS`, con el rol dueño: `insert into core.modulos (codigo, nombre) values ('registro','Registro'), ('crm','CRM'), ('ordenes','Pedidos') on conflict do nothing`, y para las empresas A y B (con `comoEmpresa(owner, emp, …, { confirmar: true })`): `insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1,'registro','activo'), ($1,'crm','activo'), ($1,'ordenes','activo') on conflict do nothing`. Sin esto, el disparador R3 rechaza los ejemplos.
7. En `EJEMPLOS`, las tablas van en orden de dependencia (la tabla referida antes que la que la referencia: `registro.cuentas` y `registro.deudas` antes que `registro.movimientos`): la siembra recorre las claves en el orden en que están escritas. Los ids fijos se arman como ya hace el archivo (`md5($1::text || 'x')::uuid`).

**`0014_registro`** · `src/db/esquema/registro.ts` · en el SQL generado, **quitar** la línea `CREATE SCHEMA "registro";` (ya existe; dejar un comentario, como hizo `0001` con `core`).

`registro.cuentas` (`registroCuentas`) · modo `completo` · `EJEMPLOS`: `completo`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `nombre` | text | no | | |
| `nombre_normalizado` | text | no | | |
| `tipo` | text | no | | `CHECK in ('caja','banco','billetera')` |
| `sucursal_id` | uuid | sí | | → `core.sucursales` |
| `es_principal` | boolean | no | `false` | |
| `saldo_inicial_centimos` | bigint (`mode: 'number'`) | no | `0` | |
| `archivado_en` | timestamptz | sí | | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`unique (tenant_id, id)` (`registro_cuentas_empresa_id`) · único parcial `(tenant_id, nombre_normalizado) where archivado_en is null` · único parcial `(tenant_id) where es_principal`.

`registro.categorias` (`registroCategorias`) · modo `completo`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `nombre` | text | no | | |
| `nombre_normalizado` | text | no | | |
| `tipo` | text | no | | `CHECK in ('ingreso','egreso')` |
| `archivado_en` | timestamptz | sí | | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`unique (tenant_id, id)` · único parcial `(tenant_id, tipo, nombre_normalizado) where archivado_en is null`.

`registro.deudas` (`registroDeudas`) · modo `completo` · además `create trigger deudas_sin_borrado before delete on registro.deudas for each row execute function core.rechazar_cambio();`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `numero` | integer | no | | |
| `anio` | integer | no | | |
| `tipo` | text | no | | `CHECK in ('por_cobrar','por_pagar')` |
| `contacto_id` | uuid | no | | → `core.clientes` |
| `concepto` | text | no | | |
| `total_centimos` | bigint | no | | `CHECK > 0` |
| `abonado_centimos` | bigint | no | `0` | `CHECK >= 0 and <= total_centimos` |
| `fecha` | date | no | | |
| `vence_en` | date | sí | | `CHECK vence_en is null or vence_en >= fecha` |
| `estado` | text | no | `'pendiente'` | `CHECK in ('pendiente','parcial','pagada','anulada')` |
| `origen_tipo` | text | sí | | |
| `origen_id` | text | sí | | `CHECK (origen_tipo is null) = (origen_id is null)` |
| `sucursal_id` | uuid | sí | | → `core.sucursales` |
| `notas` | text | sí | | |
| `datos_extra` | jsonb | no | `'{}'` | |
| `anulado_en` | timestamptz | sí | | `CHECK (estado = 'anulada') = (anulado_en is not null)` |
| `anulado_por` | text | sí | | |
| `motivo_anulacion` | text | sí | | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`CHECK` de coherencia (`deuda_estado_y_abonado`): `estado = 'anulada' or (estado = 'pendiente' and abonado_centimos = 0) or (estado = 'parcial' and abonado_centimos > 0 and abonado_centimos < total_centimos) or (estado = 'pagada' and abonado_centimos = total_centimos)`.
`unique (tenant_id, id)` · `unique (tenant_id, tipo, anio, numero)` · único parcial `(tenant_id, origen_tipo, origen_id) where origen_id is not null and estado <> 'anulada'` (un documento de origen genera a lo sumo una deuda viva) · índices `(tenant_id, tipo, estado, vence_en)`, `(tenant_id, contacto_id, estado)`, `(tenant_id, creado_por, creado_en desc)`.

`registro.movimientos` (`registroMovimientos`) · **modo `insercion`** y, después, `grant update (estado, anulado_en, anulado_por, motivo_anulacion) on registro.movimientos to capaz_app;` (lo demás es inmutable por permisos: ADR-012) · `EJEMPLOS`: `insercion`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `numero` | integer | no | | |
| `anio` | integer | no | | |
| `tipo` | text | no | | `CHECK in ('ingreso','egreso')` |
| `fecha` | date | no | | |
| `monto_centimos` | bigint | no | | `CHECK > 0` |
| `cuenta_id` | uuid | no | | → `registro.cuentas` |
| `categoria_id` | uuid | sí | | → `registro.categorias` |
| `contacto_id` | uuid | sí | | → `core.clientes` |
| `medio_de_pago` | text | no | `'efectivo'` | `CHECK in ('efectivo','transferencia','yape','plin','tarjeta','otro')` |
| `descripcion` | text | sí | | |
| `deuda_id` | uuid | sí | | → `registro.deudas` (un abono) |
| `sucursal_id` | uuid | sí | | → `core.sucursales` |
| `origen` | text | no | `'teclado'` | `CHECK in ('teclado','voz','agente','regla','conector','importacion','modulo')` |
| `origen_ref` | text | sí | | |
| `estado` | text | no | `'activo'` | `CHECK in ('activo','anulado')` |
| `anulado_en` | timestamptz | sí | | `CHECK (estado = 'anulado') = (anulado_en is not null)` |
| `anulado_por` | text | sí | | |
| `motivo_anulacion` | text | sí | | |
| `datos_extra` | jsonb | no | `'{}'` | |
| `creado_por` | text | no | | |

Sin `actualizado_en`. `unique (tenant_id, id)` · `unique (tenant_id, anio, numero)` · índices `(tenant_id, fecha desc, id desc)`, `(tenant_id, cuenta_id, fecha desc)`, `(tenant_id, deuda_id) where deuda_id is not null`, `(tenant_id, contacto_id, fecha desc) where contacto_id is not null`, `(tenant_id, creado_por, fecha desc)`.

**Pruebas de DB2a:** catálogo, aislamiento y plataforma en verde con lo nuevo; `capaz_app` no puede `update registro.movimientos set monto_centimos = 1` (permiso denegado) y sí puede anular; `capaz_app` no puede borrar una deuda (disparador); con el módulo `registro` en baja, un `insert` en `registro.categorias` falla con «no está activo»; `capaz_sistema` no puede leer ninguna tabla de `registro`.

### 3.2 Tanda DB2b

**`0015_crm`** · `src/db/esquema/crm.ts` · quitar `CREATE SCHEMA "crm";` del SQL generado (lo creó `0013`).

`crm.etapas` (`crmEtapas`) · modo `completo`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `nombre` | text | no | | |
| `nombre_normalizado` | text | no | | |
| `orden` | integer | no | | `CHECK >= 0` |
| `tipo` | text | no | `'abierta'` | `CHECK in ('abierta','ganada','perdida')` |
| `archivado_en` | timestamptz | sí | | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`unique (tenant_id, id)` · único parcial `(tenant_id, nombre_normalizado) where archivado_en is null` · únicos parciales `(tenant_id) where tipo = 'ganada' and archivado_en is null` y `(tenant_id) where tipo = 'perdida' and archivado_en is null` (una sola etapa de cada cierre).

`crm.oportunidades` (`crmOportunidades`) · modo `completo`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `numero` | integer | no | | |
| `anio` | integer | no | | |
| `titulo` | text | no | | |
| `cliente_id` | uuid | no | | → `core.clientes` |
| `etapa_id` | uuid | no | | → `crm.etapas` |
| `estado` | text | no | `'abierta'` | `CHECK in ('abierta','ganada','perdida')` |
| `monto_estimado_centimos` | bigint | sí | | `CHECK is null or >= 0` |
| `fecha_esperada` | date | sí | | |
| `responsable_id` | text | sí | | |
| `motivo_perdida` | text | sí | | `CHECK estado = 'perdida' or motivo_perdida is null` |
| `cerrada_en` | timestamptz | sí | | `CHECK (estado = 'abierta') = (cerrada_en is null)` |
| `ultima_actividad_en` | timestamptz | no | `now()` | |
| `notas` | text | sí | | |
| `sucursal_id` | uuid | sí | | → `core.sucursales` |
| `datos_extra` | jsonb | no | `'{}'` | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`unique (tenant_id, id)` · `unique (tenant_id, anio, numero)` · índices `(tenant_id, estado, etapa_id, ultima_actividad_en desc)`, `(tenant_id, cliente_id)`, `(tenant_id, responsable_id, estado)`, `(tenant_id, creado_por, creado_en desc)`.

`crm.actividades` (`crmActividades`) · modo `completo`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `oportunidad_id` | uuid | no | | → `crm.oportunidades` |
| `tipo` | text | no | | `CHECK in ('llamada','reunion','mensaje','tarea','nota')` |
| `asunto` | text | no | | |
| `nota` | text | sí | | |
| `vence_el` | date | sí | | |
| `hecha_en` | timestamptz | sí | | |
| `hecha_por` | text | sí | | `CHECK (hecha_en is null) = (hecha_por is null)` |
| `responsable_id` | text | sí | | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

Índices `(tenant_id, oportunidad_id, creado_en desc)` y `(tenant_id, vence_el) where hecha_en is null`.

**`0016_ordenes`** · `src/db/esquema/ordenes.ts` · quitar `CREATE SCHEMA "ordenes";`.

`ordenes.pedidos` (`ordenesPedidos`) · modo `completo` · además disparador `core.rechazar_cambio` en `before delete`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `numero` | integer | sí | | |
| `serie` | text | sí | | |
| `anio` | integer | sí | | `CHECK (numero is null) = (serie is null) and (numero is null) = (anio is null)` |
| `cliente_id` | uuid | no | | → `core.clientes` |
| `estado` | text | no | `'borrador'` | `CHECK in ('borrador','confirmado','en_proceso','listo','entregado','cancelado')` · `CHECK estado in ('borrador','cancelado') or numero is not null` |
| `fecha` | date | no | | |
| `entrega_el` | date | sí | | |
| `responsable_id` | text | sí | | |
| `igv_porcentaje` | smallint | no | `18` | `CHECK between 0 and 100` |
| `subtotal_centimos` | bigint | no | `0` | `CHECK >= 0` |
| `igv_centimos` | bigint | no | `0` | `CHECK >= 0` |
| `total_centimos` | bigint | no | `0` | `CHECK total_centimos = subtotal_centimos + igv_centimos` |
| `notas` | text | sí | | |
| `sucursal_id` | uuid | sí | | → `core.sucursales` |
| `origen_tipo` | text | sí | | |
| `origen_id` | text | sí | | `CHECK (origen_tipo is null) = (origen_id is null)` |
| `confirmado_en` | timestamptz | sí | | |
| `entregado_en` | timestamptz | sí | | |
| `cancelado_en` | timestamptz | sí | | `CHECK (estado = 'cancelado') = (cancelado_en is not null)` |
| `cancelado_por` | text | sí | | |
| `motivo_cancelacion` | text | sí | | |
| `datos_extra` | jsonb | no | `'{}'` | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`unique (tenant_id, id)` · único parcial `(tenant_id, serie, anio, numero) where numero is not null` · único parcial `(tenant_id, origen_tipo, origen_id) where origen_id is not null and estado <> 'cancelado'` · índices `(tenant_id, estado, entrega_el)`, `(tenant_id, cliente_id, creado_en desc)`, `(tenant_id, responsable_id, estado)`, `(tenant_id, creado_por, creado_en desc)`.

`ordenes.pedido_lineas` (`ordenesPedidoLineas`) · modo `completo` (las líneas de un borrador se reemplazan)

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `pedido_id` | uuid | no | | → `ordenes.pedidos` |
| `posicion` | integer | no | | `CHECK >= 0` |
| `producto_id` | uuid | sí | | → `core.productos` |
| `descripcion` | text | no | | |
| `unidad` | text | no | `'unidad'` | |
| `cantidad_milesimas` | bigint | no | | `CHECK > 0` |
| `precio_unitario_milesimas` | bigint | no | | `CHECK >= 0` |
| `afecto_igv` | boolean | no | `true` | |
| `importe_centimos` | bigint | no | | `CHECK >= 0` |

`unique (tenant_id, pedido_id, posicion)`.

`ordenes.pedido_eventos` (`ordenesPedidoEventos`) · modo `insercion` · disparador `core.rechazar_cambio` en `before update or delete` · `EJEMPLOS`: `insercion`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `pedido_id` | uuid | no | | → `ordenes.pedidos` |
| `tipo` | text | no | | `CHECK in ('creado','editado','confirmado','estado','cancelado','nota')` |
| `estado_anterior` | text | sí | | |
| `estado_nuevo` | text | sí | | |
| `nota` | text | sí | | |
| `usuario_id` | text | no | | |

Índice `(tenant_id, pedido_id, creado_en desc)`.

**Pruebas de DB2b:** las tres de catálogo en verde; `capaz_sistema` no lee `crm.*` ni `ordenes.*`; `ordenes.pedido_eventos` no admite `update` ni `delete`.
**Parar y preguntar (DB2a y DB2b):** lo de la fase D; `drizzle-kit` genera algo que borra o recrea una restricción escrita a mano; el disparador R3 hace fallar una prueba de `aislamiento` que no sea por falta de activar el módulo; una columna no está en estas tablas.

## 4. Módulo `registro` · Finanzas ligeras (fase 14)

Caja, movimientos, cuentas por cobrar y por pagar, abonos. Captura **tecleada** (la voz llega en la ola 4 sobre estas mismas herramientas). Familia `finanzas`, orden 1.

### 4.1 Manifiesto (lo edita M-registro-s1)

`permisos`: `registro:ver`, `registro:editar`, `registro:anular`, `registro:configurar`, `registro:reportes` (se quita `registro:aprobar`: la bandeja es del núcleo). `permisosPorNivel.completo`: los cinco; `lectura`: `registro:ver`, `registro:reportes`. `dependeDe: []`. `descripcion`: «Caja, ingresos, egresos y cuentas por cobrar y por pagar.». `secciones` (todas `construida: true`): `movimientos` «Movimientos» `/m/registro/movimientos` · `por-cobrar` «Por cobrar» `/m/registro/por-cobrar` · `por-pagar` «Por pagar» `/m/registro/por-pagar` · `caja` «Caja del día» `/m/registro/caja` · `ajustes` «Cuentas y categorías» `/m/registro/ajustes`. **No se tocan** `enConstruccion` ni `porDefecto` (los cambia el integrador en X2).

### 4.2 Reglas de dinero (dominio; cada una con su prueba unitaria)

1. `codigoDeMovimiento(anio, numero)` → `MOV-2026-000123` (6 cifras). `codigoDeDeuda(tipo, anio, numero)` → `CXC-2026-0001` (por cobrar) o `CXP-2026-0001` (por pagar). Claves de correlativo, sin serie, con `anio = hoyDeLaEmpresa().anio`: `registro.movimiento`, `registro.deuda_por_cobrar`, `registro.deuda_por_pagar`.
2. `estadoDeDeuda(total, abonado)` → `pendiente` (0), `parcial` (entre 0 y el total), `pagada` (igual al total). Saldo = total − abonado.
3. **Abonar:** se bloquea la deuda (`for update`) **antes** de leer su saldo. Deuda `anulada` o `pagada` → `conflicto`. `monto > saldo` → `conflicto` con el mensaje «El abono (S/ x) supera el saldo pendiente (S/ y).». El abono es un movimiento con `deuda_id`: `ingreso` si la deuda es por cobrar, `egreso` si es por pagar; hereda el contacto de la deuda.
4. **Anular un movimiento:** solo `activo`; si ya está anulado → `conflicto` «Ese movimiento ya está anulado.». Si tiene `deuda_id`: se bloquea la deuda, se resta el monto de `abonado_centimos` y se recalcula su estado.
5. **Anular una deuda:** solo si `abonado_centimos = 0`. Con abonos vivos → `conflicto` «Anula primero sus N abonos.». (Desviación deliberada frente a Tairos.RC, que preguntaba «devuelto o retenido»: decisión D16.)
6. Fecha de un movimiento: por defecto hoy (R7); una fecha futura → `argumentos_invalidos`. Fecha de una deuda: por defecto hoy; `venceEn` no puede ser anterior a `fecha`.
7. Cuenta: si no llega, la principal; una cuenta archivada → `conflicto`. Categoría: si llega, su `tipo` debe ser el del movimiento (`argumentos_invalidos`). Contacto: debe existir y no estar fusionado (`no_encontrado`).
8. Un egreso que deja la cuenta en negativo **se permite** y la respuesta lleva el aviso `{ codigo: 'saldo_negativo', nivel: 'comercial', mensaje: 'La cuenta «…» queda con saldo negativo.' }`.
9. Saldo de una cuenta = `saldo_inicial_centimos` + ingresos activos − egresos activos. Saldo inicial de un día = lo mismo contando solo movimientos con `fecha` anterior.
10. Catálogos por defecto (`asegurarCatalogos`, R10): cuenta «Caja» (`caja`, principal) si la empresa no tiene ninguna; categorías de ingreso «Ventas», «Cobros», «Otros ingresos»; de egreso «Compras», «Pagos», «Servicios», «Sueldos», «Otros egresos». Un abono sin `categoriaId` usa «Cobros» (ingreso) o «Pagos» (egreso).

**Casos de referencia** (sustituyen a ejecutar el SQL de Tairos.RC; D15). Archivo `domain/casos-de-referencia.spec.ts` y su par por HTTP; cada caso es una secuencia y el saldo esperado:
a. deuda 100.00 → abono 30.00 → abono 70.00 ⇒ `pagada`, saldo 0, evento `deuda.pagada` una sola vez;
b. deuda 100.00 → abono 100.01 ⇒ `conflicto`, sin movimiento;
c. deuda 100.00 → abono 40.00 → anular ese movimiento ⇒ `pendiente`, saldo 100.00;
d. deuda 100.00 → abonos 60.00 y 40.00 → anular el de 40.00 ⇒ `parcial`, saldo 40.00;
e. dos abonos simultáneos de 60.00 sobre una deuda de 100.00 ⇒ uno entra, el otro `conflicto` (el bloqueo impide cobrar de más);
f. el mismo abono con la misma `Idempotency-Key` dos veces ⇒ un solo movimiento y la misma respuesta, aunque la deuda ya esté pagada;
g. deuda con un abono → `deuda_anular` ⇒ `conflicto`; tras anular el abono, se anula;
h. céntimos: 0.01 + 0.02 + 99.97 sobre 100.00 ⇒ `pagada` exacta.

### 4.3 Contratos (`packages/shared/src/contratos/registro.ts`)

```ts
export const TIPOS_DE_CUENTA = ['caja', 'banco', 'billetera'] as const;
export const TIPOS_DE_MOVIMIENTO = ['ingreso', 'egreso'] as const;
export const MEDIOS_DE_PAGO = ['efectivo', 'transferencia', 'yape', 'plin', 'tarjeta', 'otro'] as const;
export const ORIGENES_DE_MOVIMIENTO = ['teclado', 'voz', 'agente', 'regla', 'conector', 'importacion', 'modulo'] as const;
export const TIPOS_DE_DEUDA = ['por_cobrar', 'por_pagar'] as const;
export const ESTADOS_DE_DEUDA = ['pendiente', 'parcial', 'pagada', 'anulada'] as const;

const texto = (max: number) => z.string().trim().max(max);
const soloId = z.strictObject({ id: z.uuid() });
const dia = z.iso.date();
const positivo = z.number().int().safe().min(1, { error: 'El monto debe ser mayor que cero.' });
const motivo = texto(300).min(1, { error: 'Indica el motivo.' });

export const cuentaSchema = z.strictObject({
  id: z.string(), nombre: z.string(), tipo: z.enum(TIPOS_DE_CUENTA), sucursalId: z.string().nullable(), esPrincipal: z.boolean(),
  saldoInicialCentimos: z.number().int(), saldoCentimos: z.number().int(),
  archivadoEn: z.iso.datetime().nullable(), creadoEn: z.iso.datetime(), actualizadoEn: z.iso.datetime(),
});
export const categoriaSchema = z.strictObject({ id: z.string(), nombre: z.string(), tipo: z.enum(TIPOS_DE_MOVIMIENTO), archivadoEn: z.iso.datetime().nullable() });
export const movimientoSchema = z.strictObject({
  id: z.string(), codigo: z.string(), numero: z.number().int(), anio: z.number().int(), tipo: z.enum(TIPOS_DE_MOVIMIENTO), fecha: dia,
  montoCentimos: z.number().int(), cuentaId: z.string(), cuentaNombre: z.string(),
  categoriaId: z.string().nullable(), categoriaNombre: z.string().nullable(), contactoId: z.string().nullable(), contactoNombre: z.string().nullable(),
  medioDePago: z.enum(MEDIOS_DE_PAGO), descripcion: z.string().nullable(), deudaId: z.string().nullable(), sucursalId: z.string().nullable(),
  origen: z.enum(ORIGENES_DE_MOVIMIENTO), estado: z.enum(['activo', 'anulado']), anuladoEn: z.iso.datetime().nullable(), motivoAnulacion: z.string().nullable(),
  creadoPor: z.string(), creadoEn: z.iso.datetime(),
});
export const deudaSchema = z.strictObject({
  id: z.string(), codigo: z.string(), numero: z.number().int(), anio: z.number().int(), tipo: z.enum(TIPOS_DE_DEUDA),
  contactoId: z.string(), contactoNombre: z.string(), concepto: z.string(),
  totalCentimos: z.number().int(), abonadoCentimos: z.number().int(), saldoCentimos: z.number().int(),
  fecha: dia, venceEn: dia.nullable(), vencida: z.boolean(), estado: z.enum(ESTADOS_DE_DEUDA),
  origenTipo: z.string().nullable(), origenId: z.string().nullable(), sucursalId: z.string().nullable(), notas: z.string().nullable(),
  anuladoEn: z.iso.datetime().nullable(), motivoAnulacion: z.string().nullable(),
  creadoPor: z.string(), creadoEn: z.iso.datetime(), actualizadoEn: z.iso.datetime(),
});
```

`vencida` = abierta (`pendiente` o `parcial`) y `venceEn` anterior a hoy (R7).

| Herramienta | Entrada (`z.strictObject`) | Salida | Parte |
|---|---|---|---|
| `registro_iniciar` | `{}` | `{ cuentasCreadas: int, categoriasCreadas: int }` | s1 |
| `cuentas_listar` | `{ incluirArchivadas: boolean = false }` | `listadoSchema(cuentaSchema)` (`siguiente` siempre nulo) | s1 |
| `cuenta_crear` | `{ nombre: texto(80).min(1), tipo, sucursalId?: uuid \| null, saldoInicialCentimos: int = 0 }` | `cuentaSchema` | s1 |
| `cuenta_editar` | `{ id, nombre?, tipo?, sucursalId?: uuid \| null }` · al menos un cambio | `cuentaSchema` | s1 |
| `cuenta_archivar` | `soloId` | `cuentaSchema` | s1 |
| `cuenta_marcar_principal` | `soloId` | `cuentaSchema` | s1 |
| `categorias_listar` | `{ tipo?: enum, incluirArchivadas: boolean = false }` | `listadoSchema(categoriaSchema)` | s1 |
| `categoria_crear` | `{ nombre: texto(80).min(1), tipo }` | `categoriaSchema` | s1 |
| `categoria_editar` | `{ id, nombre: texto(80).min(1) }` | `categoriaSchema` | s1 |
| `categoria_archivar` | `soloId` | `categoriaSchema` | s1 |
| `movimiento_registrar` | `{ tipo, montoCentimos: positivo, fecha?: dia, cuentaId?: uuid, categoriaId?: uuid \| null, contactoId?: uuid \| null, medioDePago = 'efectivo', descripcion?: texto(500) \| null, sucursalId?: uuid \| null, origen = 'teclado', origenRef?: texto(200) }` | `movimientoSchema` | s1 |
| `movimiento_ver` | `soloId` | `movimientoSchema` | s1 |
| `movimientos_listar` | `{ ...paginaSchema.shape, desde?: dia, hasta?: dia, tipo?, cuentaId?: uuid, categoriaId?: uuid, contactoId?: uuid, deudaId?: uuid, estado: enum('activos','anulados','todos') = 'activos' }` | `listadoSchema(movimientoSchema)` · orden `(fecha, id)` descendente | s1 |
| `movimiento_anular` | `{ id, motivo }` | `movimientoSchema` | s2 |
| `deuda_crear` | `{ tipo, contactoId: uuid, concepto: texto(200).min(1), totalCentimos: positivo, fecha?: dia, venceEn?: dia \| null, sucursalId?: uuid \| null, notas?: texto(2000) \| null, origenTipo?: texto(40), origenId?: texto(100) }` · `origenTipo` y `origenId` van juntos o ninguno | `deudaSchema` | s2 |
| `deuda_ver` | `soloId` | `z.strictObject({ ...deudaSchema.shape, abonos: z.array(movimientoSchema) })` | s2 |
| `deudas_listar` | `{ ...paginaSchema.shape, tipo, estado: enum('abiertas','vencidas','pagadas','anuladas','todas') = 'abiertas', contactoId?: uuid }` | `listadoSchema(deudaSchema)` | s2 |
| `deuda_editar` | `{ id, concepto?, venceEn?: dia \| null, notas?: texto(2000) \| null }` · al menos un cambio | `deudaSchema` | s2 |
| `deuda_abonar` | `{ id, montoCentimos: positivo, fecha?: dia, cuentaId?: uuid, medioDePago = 'efectivo', descripcion?: texto(500) \| null }` | `{ deuda: deudaSchema, movimiento: movimientoSchema }` | s2 |
| `deuda_anular` | `{ id, motivo }` | `deudaSchema` | s2 |
| `caja_del_dia` | `{ fecha?: dia, cuentaId?: uuid }` | `{ fecha: dia, cuentas: [{ cuentaId, nombre, saldoInicialCentimos, ingresosCentimos, egresosCentimos, saldoFinalCentimos, movimientos: int }], totalIngresosCentimos, totalEgresosCentimos }` | s3 |
| `registro_resumen` | `{ desde: dia, hasta: dia }` · `hasta >= desde`, máximo 366 días | `{ desde, hasta, ingresosCentimos, egresosCentimos, netoCentimos, porCobrarCentimos, porPagarCentimos, vencidasPorCobrar: int, vencidasPorCobrarCentimos, vencidasPorPagar: int, porCategoria: [{ categoriaId: string \| null, nombre, tipo, totalCentimos }] }` | s3 |

Eventos (los pone C1; no se cambian):

```ts
export const eventosDeRegistro = {
  'movimiento.registrado': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['ingreso', 'egreso']), montoCentimos: z.number().int(), fecha: z.iso.date(), cuentaId: z.string(), contactoId: z.string().nullable(), deudaId: z.string().nullable() }),
  'movimiento.anulado': z.strictObject({ id: z.string(), codigo: z.string(), deudaId: z.string().nullable() }),
  'deuda.creada': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['por_cobrar', 'por_pagar']), contactoId: z.string(), totalCentimos: z.number().int(), venceEn: z.iso.date().nullable(), origenTipo: z.string().nullable(), origenId: z.string().nullable() }),
  'deuda.abonada': z.strictObject({ id: z.string(), codigo: z.string(), movimientoId: z.string(), montoCentimos: z.number().int(), saldoCentimos: z.number().int() }),
  'deuda.pagada': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['por_cobrar', 'por_pagar']), contactoId: z.string(), totalCentimos: z.number().int() }),
  'deuda.anulada': z.strictObject({ id: z.string(), codigo: z.string() }),
} as const;
```

### 4.4 Herramientas: permiso, criticidad y marcas

| Herramienta | Permiso | Criticidad | Marcas | Emite |
|---|---|---|---|---|
| `registro_iniciar` | `registro:editar` | normal | idempotente | — |
| `cuentas_listar`, `categorias_listar`, `movimiento_ver`, `movimientos_listar`, `deuda_ver`, `deudas_listar` | `registro:ver` | lectura | | — |
| `cuenta_crear`, `cuenta_editar`, `cuenta_archivar`, `cuenta_marcar_principal`, `categoria_crear`, `categoria_editar`, `categoria_archivar` | `registro:configurar` | normal | | — |
| `movimiento_registrar` | `registro:editar` | normal | idempotente · **`mueveDinero`** | `movimiento.registrado` |
| `movimiento_anular` | `registro:anular` | **crítica** | | `movimiento.anulado` |
| `deuda_crear` | `registro:editar` | normal | idempotente | `deuda.creada` |
| `deuda_editar` | `registro:editar` | normal | | — |
| `deuda_abonar` | `registro:editar` | normal | idempotente · **`mueveDinero`** | `movimiento.registrado`, `deuda.abonada` y, si queda en cero, `deuda.pagada` |
| `deuda_anular` | `registro:anular` | **crítica** | | `deuda.anulada` |
| `caja_del_dia`, `registro_resumen` | `registro:reportes` | lectura | alcance `todos` (R4) | — |

Detalles: `cuenta_archivar` rechaza la principal (`conflicto`); `cuenta_marcar_principal` rechaza una archivada. `cuenta_crear` y `categoria_crear` con nombre repetido → `conflicto` con `candidatas`. `deuda_crear` con un `origenId` que ya tiene deuda viva → `conflicto` con esa deuda en `candidatas`. Huella de `movimiento_anular`: `hashCanonico({ estado, deudaId, abonado })`; de `deuda_anular`: `hashCanonico({ estado, abonadoCentimos })`. Resumen para confirmar, p. ej.: «Anularás el ingreso MOV-2026-000123 de S/ 150.00. La deuda CXC-2026-0007 volverá a tener S/ 150.00 de saldo.».

### 4.5 Consumidores y fuente de tiempo (s3)

- Consumidor `registro_pedido_confirmado` · `modulo: 'registro'` · `evento: 'pedido.confirmado'`: valida la carga con `EVENTOS['pedido.confirmado']`; si `totalCentimos = 0`, o ya existe una deuda viva con `origen_tipo = 'pedido'` y ese `origen_id`, no hace nada; si no, `proponerBorrador(tx, { herramienta: 'deuda_crear', args: { tipo: 'por_cobrar', contactoId: carga.clienteId, concepto: `Pedido ${carga.codigo}`, totalCentimos: carga.totalCentimos, venceEn: carga.entregaEl ?? undefined, origenTipo: 'pedido', origenId: carga.id }, resumen: `Cobrar ${formatearSoles(carga.totalCentimos)} por el pedido ${carga.codigo}`, origen: 'modulo', origenRef: `pedido:${carga.id}`, propuestoPor: 'sistema' })`.
- Consumidor `registro_pedido_cancelado` · `evento: 'pedido.cancelado'`: si existe una deuda viva con ese origen, propone `deuda_anular` con `{ id, motivo: `Pedido ${carga.codigo} cancelado` }` y prioridad `alta`; si no, nada.
- Fuente de tiempo `registro.deuda_vence` · `modulo: 'registro'` · candidatos: deudas `pendiente` o `parcial` con `vence_en`; `entidadTipo: 'deuda'`, `fecha: instanteDeDia(vence_en)`, `datos: { id, codigo, tipo, contactoId, saldoCentimos, venceEn }`. No escribe.

### 4.6 Carriles de servidor

- **M-registro-s1:** manifiesto; dominio (reglas 1, 6 a 10); repositorios de cuentas, categorías y movimientos; las 13 herramientas «s1»; pruebas R17 sobre ellas. *Hecho cuando:* se registra un ingreso por HTTP sin haber creado nada antes (los catálogos se siembran solos), sale su evento, y el informe dice **«camino de módulo no núcleo validado»** (R2 y R3 funcionan como están escritos) o lista lo que falló.
- **M-registro-s2:** dominio (reglas 2 a 5); repositorio de deudas; las 7 herramientas «s2»; casos de referencia a–h por HTTP. *Hecho cuando:* los ocho casos pasan.
- **M-registro-s3:** `caja_del_dia`, `registro_resumen`, los dos consumidores y la fuente de tiempo. Pruebas: el consumidor llamado dos veces con el mismo evento deja un solo borrador; aprobar ese borrador por HTTP crea la deuda con su origen; con `propios`, `caja_del_dia` responde `sin_permiso`; el día se corta en la zona de la empresa (reloj fijo a las 23:30 de Lima). *Hecho cuando:* un evento `pedido.confirmado` emitido en la prueba termina, tras `Relevo.procesarLote()`, como borrador pendiente en `borradores_listar`.
- **Parar y preguntar (las tres):** una regla de dinero no está en §4.2; hace falta una columna; el ejecutor responde algo distinto de R2 para un `member`.

### 4.7 Pantallas (`apps/web/src/modules/registro/`)

Rutas: `m/registro` (redirige a `movimientos`) con marco propio (`NavegacionDeSeccion` con las secciones de `yo`) y, dentro: `movimientos`, `movimientos/:id`, `por-cobrar`, `por-pagar`, `deudas/:id`, `caja`, `ajustes`. Al entrar al marco: si `cuentas_listar` viene vacío y la persona puede editar, llamar una vez a `registro_iniciar`.

- **M-registro-w1** (tras s1 y K1b):
  - *Movimientos:* `EncabezadoDePagina` con «Nuevo ingreso» y «Nuevo egreso»; filtros (rango de fechas con `Campo type="date"`, tipo, cuenta) y `Lista` (fecha, código, descripción o contacto, categoría, cuenta, monto alineado a la derecha con signo y tono, insignia «Anulado»); `CargarMas`.
  - *Hoja de alta* (`HojaInferior`): `CampoMonto` primero y con foco, fecha (hoy), cuenta (`CampoSelect`, la principal elegida), categoría (`CampoSelect` filtrado por tipo), contacto (`SelectorDeRegistro` sobre `clientes_buscar`), medio de pago, descripción (`CampoTextarea`). Tras guardar, la hoja queda abierta para el siguiente con el aviso «Registrado»; si llega el aviso `saldo_negativo`, se muestra.
  - *Ficha de movimiento:* datos en lectura. («Anular» lo agrega w2: su herramienta llega con s2.)
  - *Cuentas y categorías:* `Pestanas`; lista, alta y edición en hoja, archivar, marcar principal; el saldo de cada cuenta.
- **M-registro-w2** (tras s3):
  - *Por cobrar* y *Por pagar:* la misma pantalla con `tipo` distinto: `GrupoDeCifras` arriba (saldo abierto, vencido), filtro de estado, `Lista` (código, contacto, concepto, vence, total, saldo, insignia de estado y «Vencida»).
  - *Ficha de deuda:* cabecera con `BarraDeEstado` (`Pendiente`, `Parcial`, `Pagada`), cifras (total, abonado, saldo), lista de abonos, «Registrar abono» (hoja con `CampoMonto` precargado con el saldo), «Editar», «Anular».
  - *Caja del día:* fecha (hoy), una tarjeta por cuenta con saldo inicial, ingresos, egresos y saldo final (`Cifra`), y debajo los movimientos del día.
  - *Anular movimiento:* botón «Anular» en la ficha de movimiento que dejó w1 (`llamarConfirmando`; pide el motivo antes).
- **Pruebas (ambos):** lógica pura (`logica.ts`): validación de formularios, armado de argumentos, signo y tono de montos, textos de estado, mensajes por código de error.
- **Hecho cuando:** desde 390 px se registra un egreso en menos de cinco toques después de escribir el monto, y se cobra un abono de una deuda.

## 5. Módulo `crm` (fase 15)

Oportunidades por etapas y actividades de seguimiento. Familia `ventas`, orden 1.

### 5.1 Manifiesto (M-crm-s1)

`permisos`: `crm:ver`, `crm:editar`, `crm:configurar`. `completo`: los tres; `lectura`: `crm:ver`. `secciones`: `tablero` «Tablero» `/m/crm` · `lista` «Oportunidades» `/m/crm/lista` · `actividades` «Actividades» `/m/crm/actividades` · `ajustes` «Etapas» `/m/crm/ajustes`.

### 5.2 Reglas (dominio)

1. `codigoDeOportunidad(anio, numero)` → `OPO-2026-0001`; clave `crm.oportunidad`.
2. Etapas por defecto (`asegurarCatalogos`): «Nuevo» (0), «Contactado» (1), «Propuesta enviada» (2), «Negociación» (3), «Ganada» (`ganada`, 4), «Perdida» (`perdida`, 5). Siempre hay exactamente una etapa `ganada` y una `perdida`: no se archivan ni cambian de tipo; sí de nombre.
3. Una oportunidad nueva entra en la primera etapa `abierta` por `orden` salvo que llegue `etapaId` (que debe ser `abierta`).
4. `oportunidad_mover`: solo oportunidades `abierta` y solo hacia etapas `abierta`. Para cerrar se usan `oportunidad_ganar` y `oportunidad_perder` (esta exige `motivo`), que mueven a la etapa de cierre, fijan `estado` y `cerrada_en`. `oportunidad_reabrir`: vuelve a `abierta` en la primera etapa abierta y limpia `motivo_perdida` y `cerrada_en`.
5. Toda escritura sobre una oportunidad o sus actividades actualiza `ultima_actividad_en = now()`.
6. `etapa_archivar`: rechaza (`conflicto`) si quedan oportunidades abiertas en ella, o si es la última etapa `abierta`. `etapas_ordenar` recibe **todas** las etapas abiertas vivas en el orden nuevo (si falta o sobra una → `argumentos_invalidos`); las de cierre quedan siempre al final.
7. `responsableId`, si llega, debe ser un miembro de la empresa: se comprueba leyendo `core.v_miembros` (como hace `miembros_listar`); si no, `argumentos_invalidos`.

### 5.3 Contratos (`contratos/crm.ts`)

```ts
export const TIPOS_DE_ETAPA = ['abierta', 'ganada', 'perdida'] as const;
export const ESTADOS_DE_OPORTUNIDAD = ['abierta', 'ganada', 'perdida'] as const;
export const TIPOS_DE_ACTIVIDAD = ['llamada', 'reunion', 'mensaje', 'tarea', 'nota'] as const;

export const etapaSchema = z.strictObject({ id: z.string(), nombre: z.string(), orden: z.number().int(), tipo: z.enum(TIPOS_DE_ETAPA), archivadoEn: z.iso.datetime().nullable() });
export const oportunidadSchema = z.strictObject({
  id: z.string(), codigo: z.string(), titulo: z.string(), clienteId: z.string(), clienteNombre: z.string(),
  etapaId: z.string(), etapaNombre: z.string(), estado: z.enum(ESTADOS_DE_OPORTUNIDAD),
  montoEstimadoCentimos: z.number().int().nullable(), fechaEsperada: z.iso.date().nullable(), responsableId: z.string().nullable(),
  motivoPerdida: z.string().nullable(), cerradaEn: z.iso.datetime().nullable(), ultimaActividadEn: z.iso.datetime(),
  notas: z.string().nullable(), sucursalId: z.string().nullable(), actividadesPendientes: z.number().int(),
  creadoPor: z.string(), creadoEn: z.iso.datetime(), actualizadoEn: z.iso.datetime(),
});
export const actividadSchema = z.strictObject({
  id: z.string(), oportunidadId: z.string(), oportunidadCodigo: z.string(), oportunidadTitulo: z.string(), tipo: z.enum(TIPOS_DE_ACTIVIDAD), asunto: z.string(), nota: z.string().nullable(),
  venceEl: z.iso.date().nullable(), vencida: z.boolean(), hechaEn: z.iso.datetime().nullable(), hechaPor: z.string().nullable(), responsableId: z.string().nullable(),
  creadoPor: z.string(), creadoEn: z.iso.datetime(),
});
```

| Herramienta | Entrada | Salida | Permiso · criticidad · marcas | Parte |
|---|---|---|---|---|
| `crm_iniciar` | `{}` | `{ etapasCreadas: int }` | `crm:editar` · normal · idempotente | s1 |
| `etapas_listar` | `{ incluirArchivadas: boolean = false }` | `listadoSchema(etapaSchema)` (por `orden`) | `crm:ver` · lectura | s1 |
| `etapa_crear` | `{ nombre: texto(60).min(1) }` (queda última de las abiertas) | `etapaSchema` | `crm:configurar` · normal | s1 |
| `etapa_editar` | `{ id, nombre: texto(60).min(1) }` | `etapaSchema` | `crm:configurar` · normal | s1 |
| `etapas_ordenar` | `{ ids: z.array(z.uuid()).min(1).max(30) }` | `listadoSchema(etapaSchema)` | `crm:configurar` · normal | s1 |
| `etapa_archivar` | `soloId` | `etapaSchema` | `crm:configurar` · normal | s1 |
| `oportunidad_crear` | `{ titulo: texto(160).min(1), clienteId: uuid, etapaId?: uuid, montoEstimadoCentimos?: int>=0 \| null, fechaEsperada?: dia \| null, responsableId?: texto(100) \| null, notas?: texto(4000) \| null, sucursalId?: uuid \| null }` | `oportunidadSchema` | `crm:editar` · normal · idempotente | s1 |
| `oportunidad_ver` | `soloId` | `{ ...oportunidadSchema.shape, actividades: z.array(actividadSchema) }` | `crm:ver` · lectura | s1 |
| `oportunidades_listar` | `{ ...paginaSchema.shape, estado: enum('abiertas','ganadas','perdidas','todas') = 'abiertas', etapaId?: uuid, clienteId?: uuid, responsableId?: texto(100), buscar?: texto(100) }` (`buscar` por título, sin distinguir tildes ni mayúsculas) | `listadoSchema(oportunidadSchema)` · orden `(ultima_actividad_en, id)` descendente | `crm:ver` · lectura | s1 |
| `oportunidad_editar` | `{ id, titulo?, clienteId?, montoEstimadoCentimos?, fechaEsperada?, responsableId?, notas?, sucursalId? }` · al menos un cambio | `oportunidadSchema` | `crm:editar` · normal | s1 |
| `oportunidad_mover` | `{ id, etapaId: uuid }` | `oportunidadSchema` | `crm:editar` · normal | s1 |
| `oportunidad_ganar` | `soloId` | `oportunidadSchema` | `crm:editar` · normal | s2 |
| `oportunidad_perder` | `{ id, motivo: texto(300).min(1) }` | `oportunidadSchema` | `crm:editar` · normal | s2 |
| `oportunidad_reabrir` | `soloId` | `oportunidadSchema` | `crm:editar` · normal | s2 |
| `actividad_crear` | `{ oportunidadId: uuid, tipo, asunto: texto(160).min(1), nota?: texto(4000) \| null, venceEl?: dia \| null, responsableId?: texto(100) \| null }` | `actividadSchema` | `crm:editar` · normal · idempotente | s2 |
| `actividad_completar` | `{ id, nota?: texto(4000) \| null }` (ya hecha → `conflicto`) | `actividadSchema` | `crm:editar` · normal | s2 |
| `actividades_listar` | `{ ...paginaSchema.shape, oportunidadId?: uuid, estado: enum('pendientes','vencidas','hechas','todas') = 'pendientes', responsableId?: texto(100) }` | `listadoSchema(actividadSchema)` | `crm:ver` · lectura | s2 |
| `crm_resumen` | `{ desde: dia, hasta: dia }` | `{ desde, hasta, abiertas: int, montoAbiertoCentimos, porEtapa: [{ etapaId, nombre, cantidad: int, montoCentimos }], ganadas: int, montoGanadoCentimos, perdidas: int, actividadesVencidas: int }` (ganadas y perdidas, por `cerrada_en` en el período) | `crm:ver` · lectura · alcance `todos` | s2 |

```ts
export const eventosDeCrm = {
  'oportunidad.creada': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), etapaId: z.string(), montoEstimadoCentimos: z.number().int().nullable() }),
  'oportunidad.movida': z.strictObject({ id: z.string(), codigo: z.string(), etapaId: z.string(), etapaAnteriorId: z.string() }),
  'oportunidad.ganada': z.strictObject({ id: z.string(), codigo: z.string(), titulo: z.string(), clienteId: z.string(), montoEstimadoCentimos: z.number().int().nullable() }),
  'oportunidad.perdida': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string() }),
} as const;
```
(`oportunidad.perdida` no lleva el motivo: es texto libre. `oportunidad.movida` no se emite si la etapa no cambió.)

Fuentes de tiempo (s2), ambas `modulo: 'crm'`: `crm.actividad_vence` (actividades sin hacer con `vence_el`; `entidadTipo: 'actividad'`, `fecha: instanteDeDia(vence_el)`, `datos: { id, oportunidadId, oportunidadCodigo, asunto, tipo }`) y `crm.oportunidad_sin_movimiento` (oportunidades abiertas; `entidadTipo: 'oportunidad'`, `fecha: ultima_actividad_en`, `datos: { id, codigo, titulo, clienteId, etapaId }`). El módulo no consume eventos en esta ola.

### 5.4 Carriles

- **M-crm-s1:** manifiesto, dominio, repositorios y las 11 herramientas «s1». *Hecho cuando:* se crea una oportunidad sin etapas previas, se mueve dos etapas y el listado por etapa la refleja.
- **M-crm-s2:** las 7 herramientas «s2», eventos de cierre y las dos fuentes. *Hecho cuando:* ganar emite `oportunidad.ganada` una vez; una actividad vencida aparece en `actividades_listar` con `estado: 'vencidas'`; un `member` con `propios` solo ve sus oportunidades y sus actividades.
- **M-crm-w** (tras s2 y K1b) · rutas `m/crm` (tablero), `m/crm/lista`, `m/crm/oportunidades/:id`, `m/crm/actividades`, `m/crm/ajustes`:
  - *Tablero:* `Tablero` con una columna por etapa abierta (nombre, cantidad y monto); cada tarjeta: título, cliente, monto, insignia de actividades pendientes y un `MenuDeAcciones` con «Mover a…» (una entrada por etapa), «Ganada», «Perdida». **Sin arrastrar.** En móvil, una etapa a la vez (lo resuelve la pieza).
  - *Lista:* búsqueda, filtro de estado, `Lista`.
  - *Ficha:* `BarraDeEstado` con las etapas abiertas, `Ficha` editable, actividades (alta en hoja, «Hecha»), «Ganada», «Perdida» (pide motivo), «Reabrir».
  - *Actividades:* pendientes y vencidas de todas las oportunidades, con «Hecha».
  - *Etapas:* lista con «Subir» y «Bajar» (llama a `etapas_ordenar`), renombrar, archivar, crear.
  - *Hecho cuando:* desde 390 px se crea una oportunidad para un cliente existente y se la lleva hasta «Ganada».
- **Parar y preguntar:** se pide arrastrar tarjetas, probabilidad, embudos múltiples o correo: no están en esta ola.

## 6. Módulo `ordenes` · Pedidos (fase 16)

Pedido de un cliente con líneas, de borrador a entregado. Nombre visible «Pedidos». Familia `ventas`, orden 2.

### 6.1 Manifiesto (M-ordenes-s1)

`permisos`: `ordenes:ver`, `ordenes:editar`, `ordenes:cancelar`. `completo`: los tres; `lectura`: `ordenes:ver`. `secciones`: `lista` «Pedidos» `/m/ordenes` · `tablero` «Por estado» `/m/ordenes/tablero` · `entregas` «Entregas» `/m/ordenes/entregas`.

### 6.2 Reglas (dominio)

1. **Totales:** función pura `calcularTotalesDePedido(lineas, igvPorcentaje)` exportada desde `packages/shared/src/contratos/ordenes.ts` (la usan el servidor y la pantalla; su prueba unitaria va en `packages/shared/src/contratos/ordenes.spec.ts`, archivo que también es de este carril): `importe_centimos` de cada línea = `importe(cantidadMilesimas, precioUnitarioMilesimas)`. **Los precios unitarios incluyen IGV** (D17). Por línea afecta: `base = redondear(importe × 100 / (100 + igvPorcentaje))` (mitad hacia arriba, con `BigInt`), `igv = importe − base`; línea no afecta: `base = importe`, `igv = 0`. `subtotal = Σ base`, `igv = Σ igv`, `total = subtotal + igv = Σ importe`. Pruebas: una línea de 118.00 da 100.00 + 18.00; tres líneas de 0.10; cantidades con tres decimales; mezcla de afectas y no afectas; `igvPorcentaje = 0`.
2. `codigoDePedido(serie, anio, numero)` → `PED-PRI-2026-0007`; un borrador muestra «Borrador». Clave `ordenes.pedido`, `serie` = código de la sucursal del pedido (si no tiene, el de la principal), `anio` de `hoyDeLaEmpresa`. **El número se asigna al confirmar**, nunca antes.
3. Un pedido solo se edita en `borrador`. `pedido_editar` con `lineas` reemplaza **todas** las líneas (borra e inserta) y recalcula totales. Entre 1 y 100 líneas para confirmar; un borrador puede guardarse sin líneas.
4. Al agregar una línea con `productoId`: el producto debe existir y no estar archivado; `descripcion`, `unidad`, `precioUnitarioMilesimas` y `afectoIgv` que no lleguen se toman del producto.
5. Transiciones (`domain/estados.ts`, tabla pura con prueba): `borrador → confirmado` solo con `pedido_confirmar`; con `pedido_cambiar_estado`: `confirmado → en_proceso | listo | entregado`, `en_proceso → listo | entregado | confirmado`, `listo → entregado | en_proceso`; `entregado` es final. `pedido_cancelar` desde `borrador`, `confirmado`, `en_proceso` o `listo`. Cualquier otra → `conflicto` con el mensaje «Un pedido «x» no puede pasar a «y».».
6. Cada cambio deja una fila en `pedido_eventos` (`creado`, `editado`, `confirmado`, `estado`, `cancelado`, `nota`) en la misma transacción.
7. `entregaEl` no puede ser anterior a `fecha`. `responsableId` como en CRM (§5.2.7).

### 6.3 Contratos (`contratos/ordenes.ts`)

```ts
export const ESTADOS_DE_PEDIDO = ['borrador', 'confirmado', 'en_proceso', 'listo', 'entregado', 'cancelado'] as const;

const lineaDeEntrada = z.strictObject({
  productoId: z.uuid().nullish(), descripcion: z.string().trim().max(300).optional(), unidad: z.string().trim().max(20).optional(),
  cantidadMilesimas: z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' }),
  precioUnitarioMilesimas: z.number().int().safe().min(0).optional(), afectoIgv: z.boolean().optional(),
}).refine((l) => l.productoId || (l.descripcion && l.precioUnitarioMilesimas !== undefined), { error: 'Una línea sin producto necesita descripción y precio.' });

export const lineaDePedidoSchema = z.strictObject({
  id: z.string(), posicion: z.number().int(), productoId: z.string().nullable(), descripcion: z.string(), unidad: z.string(),
  cantidadMilesimas: z.number().int(), precioUnitarioMilesimas: z.number().int(), afectoIgv: z.boolean(), importeCentimos: z.number().int(),
});
export const pedidoSchema = z.strictObject({
  id: z.string(), codigo: z.string(), numero: z.number().int().nullable(), serie: z.string().nullable(), anio: z.number().int().nullable(),
  clienteId: z.string(), clienteNombre: z.string(), estado: z.enum(ESTADOS_DE_PEDIDO), fecha: z.iso.date(), entregaEl: z.iso.date().nullable(), atrasado: z.boolean(),
  responsableId: z.string().nullable(), igvPorcentaje: z.number().int(), subtotalCentimos: z.number().int(), igvCentimos: z.number().int(), totalCentimos: z.number().int(),
  notas: z.string().nullable(), sucursalId: z.string().nullable(), origenTipo: z.string().nullable(), origenId: z.string().nullable(),
  confirmadoEn: z.iso.datetime().nullable(), entregadoEn: z.iso.datetime().nullable(), canceladoEn: z.iso.datetime().nullable(), motivoCancelacion: z.string().nullable(),
  lineas: z.number().int(), creadoPor: z.string(), creadoEn: z.iso.datetime(), actualizadoEn: z.iso.datetime(),
});
export const eventoDePedidoSchema = z.strictObject({ id: z.string(), tipo: z.string(), estadoAnterior: z.string().nullable(), estadoNuevo: z.string().nullable(), nota: z.string().nullable(), usuarioId: z.string(), creadoEn: z.iso.datetime() });
export const pedidoCompletoSchema = z.strictObject({ ...pedidoSchema.shape, detalle: z.array(lineaDePedidoSchema), historial: z.array(eventoDePedidoSchema) });
```
`pedidoSchema.lineas` es la cantidad de líneas; `atrasado` = estado `confirmado`, `en_proceso` o `listo` con `entregaEl` anterior a hoy.

| Herramienta | Entrada | Salida | Permiso · criticidad · marcas | Parte |
|---|---|---|---|---|
| `pedido_crear` | `{ clienteId: uuid, fecha?: dia, entregaEl?: dia \| null, responsableId?: texto(100) \| null, notas?: texto(4000) \| null, sucursalId?: uuid \| null, lineas: z.array(lineaDeEntrada).max(100).default([]), origenTipo?: texto(40), origenId?: texto(100) }` | `pedidoCompletoSchema` | `ordenes:editar` · normal · idempotente | s1 |
| `pedido_editar` | `{ id, clienteId?, entregaEl?, responsableId?, notas?, sucursalId?, lineas?: z.array(lineaDeEntrada).max(100) }` · al menos un cambio | `pedidoCompletoSchema` | `ordenes:editar` · normal | s1 |
| `pedido_ver` | `soloId` | `pedidoCompletoSchema` | `ordenes:ver` · lectura | s1 |
| `pedidos_listar` | `{ ...paginaSchema.shape, estado: enum('abiertos','borrador','confirmado','en_proceso','listo','entregado','cancelado','todos') = 'abiertos', clienteId?: uuid, responsableId?: texto(100), entregaDesde?: dia, entregaHasta?: dia }` (`abiertos` = todo menos `entregado` y `cancelado`) | `listadoSchema(pedidoSchema)` | `ordenes:ver` · lectura | s1 |
| `pedido_anotar` | `{ id, nota: texto(1000).min(1) }` | `pedidoCompletoSchema` | `ordenes:editar` · normal | s1 |
| `pedido_confirmar` | `soloId` | `pedidoCompletoSchema` | `ordenes:editar` · normal | s2 |
| `pedido_cambiar_estado` | `{ id, estado: enum('confirmado','en_proceso','listo','entregado') }` | `pedidoCompletoSchema` | `ordenes:editar` · normal | s2 |
| `pedido_cancelar` | `{ id, motivo: texto(300).min(1) }` | `pedidoCompletoSchema` | `ordenes:cancelar` · **crítica** | s2 |
| `ordenes_resumen` | `{ desde: dia, hasta: dia }` | `{ desde, hasta, porEstado: [{ estado, cantidad: int, totalCentimos }], confirmados: int, totalConfirmadoCentimos, entregados: int, atrasados: int, entregasDeHoy: int }` (confirmados y entregados por su fecha de confirmación o entrega en el período) | `ordenes:ver` · lectura · alcance `todos` | s2 |

```ts
export const eventosDeOrdenes = {
  'pedido.confirmado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), totalCentimos: z.number().int(), entregaEl: z.iso.date().nullable(), sucursalId: z.string().nullable() }),
  'pedido.entregado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string() }),
  'pedido.cancelado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), teniaNumero: z.boolean() }),
} as const;
```
`pedido.cancelado` se emite solo si el pedido ya estaba confirmado (`teniaNumero: true`); cancelar un borrador no emite. `pedido_confirmar` dos veces: la segunda responde `conflicto` y no emite. Huella de `pedido_cancelar`: `hashCanonico({ estado, totalCentimos })`.

Fuente de tiempo (s2): `ordenes.entrega_vence` · pedidos `confirmado`, `en_proceso` o `listo` con `entrega_el`; `entidadTipo: 'pedido'`, `fecha: instanteDeDia(entrega_el)`, `datos: { id, codigo, clienteId, estado, totalCentimos }`. El módulo no consume eventos en esta ola.

### 6.4 Carriles

- **M-ordenes-s1:** manifiesto, `calcularTotalesDePedido` (en `@capaz/shared`), `domain/estados.ts`, repositorios y las 5 herramientas «s1». *Hecho cuando:* un borrador con tres líneas (una sin producto, una no afecta) devuelve los totales de la prueba unitaria y se puede reemplazar sus líneas.
- **M-ordenes-s2:** las 4 herramientas «s2», eventos y fuente. Pruebas propias: dos confirmaciones simultáneas de pedidos distintos dan números consecutivos sin repetir; confirmar sin líneas → `conflicto`; editar un confirmado → `conflicto`; la serie sale de la sucursal del pedido; toda la tabla de transiciones por HTTP. *Hecho cuando:* confirmar emite `pedido.confirmado` con el código y el total, una sola vez.
- **M-ordenes-w** (tras s2 y K1b) · rutas `m/ordenes` (lista), `m/ordenes/tablero`, `m/ordenes/entregas`, `m/ordenes/nuevo`, `m/ordenes/:id`:
  - *Lista:* filtro de estado, `Lista` (código, cliente, entrega con insignia «Atrasado», estado, total).
  - *Nuevo y ficha:* cliente (`SelectorDeRegistro`), fecha de entrega, responsable, notas; **líneas** en un componente propio del módulo (`lineas-de-pedido.tsx`, hecho solo con piezas del kit): por línea, producto (`SelectorDeRegistro` sobre `productos_buscar`) o descripción libre, `CampoCantidad`, `CampoPrecio`, importe calculado con `importe()`; en móvil cada línea es una tarjeta que se edita en una hoja. Totales (`GrupoDeCifras`: subtotal, IGV, total) calculados en pantalla con `calcularTotalesDePedido` de `@capaz/shared` (la misma función del servidor; no se duplica la fórmula).
  - *Ficha:* `BarraDeEstado` (`Borrador`, `Confirmado`, `En proceso`, `Listo`, `Entregado`), botón principal con el siguiente paso, «Cancelar pedido» (crítica), historial.
  - *Por estado:* `Tablero` con una columna por estado abierto; «Pasar a…» en el menú de cada tarjeta.
  - *Entregas:* pedidos abiertos agrupados por fecha de entrega (atrasados, hoy, próximos siete días).
  - *Hecho cuando:* desde 390 px se arma un pedido de dos líneas, se confirma y aparece su número.
- **Parar y preguntar:** se pide descuento por línea, adelanto, impresión o PDF, o precios sin IGV: no están en esta ola (D17).

## 7. K1 · Kit y base web de la ola

Todo en `apps/web/src/shared/**` y `app/proveedores.tsx`. Piezas propias, sin dependencias nuevas, cada una mostrada en `/kit` (`app/kit/kit-ola-2.tsx`, que K1a agrega a `pagina-kit.tsx`) en todos sus estados, a 390 y 1280 px. Objetivos táctiles de 44 px, foco visible, etiquetas asociadas.

**K1a**
1. `shared/api/cliente-de-consultas.ts` (un `QueryClient`: `staleTime: 30_000`, `retry: false`, `refetchOnWindowFocus: false`) y `QueryClientProvider` en `app/proveedores.tsx`. Los `consultas.tsx` de las áreas de la ola 1 **no se tocan** (siguen funcionando anidados); se retiran en otra ocasión.
2. `shared/api/consultas.ts`: `ErrorDeApi` y `datosOError` (copia de `core/clientes/api.ts`, que no se toca). `shared/ui/use-retardo.ts` (ídem).
3. `shared/sesion/acceso.ts`: `accesoA(yo, codigo)`, `puedeEscribirEn(yo, codigo)`, `seccionesDe(yo, codigo)`; con pruebas.
4. `shared/formato/milesimas.ts`: `textoAMilesimas`, `milesimasATexto`, `formatearCantidad(milesimas, unidad?)`; con pruebas (la copia de `core/productos/logica.ts` no se toca).
5. `CampoTextarea` (`etiqueta`, `error`, `ayuda`, `filas`), `CampoCantidad` (`valor: number | null` en milésimas, `alCambiar`, `unidad?`), `CampoPrecio` (igual, en milésimas de sol, prefijo «S/»).
6. `NavegacionDeSeccion` (`etiqueta`, `secciones: Array<{ a: string; texto: string; fin?: boolean }>`; fila con desplazamiento horizontal en móvil; modelo: la navegación de `plataforma/marco.tsx`).
7. `Cifra` (`etiqueta`, `valor: string`, `tono?: 'neutro' | 'exito' | 'peligro' | 'aviso'`, `ayuda?`) y `GrupoDeCifras` (rejilla de 2 columnas en móvil, 4 en escritorio).

**K1b**
8. `SelectorDeRegistro`: `{ etiqueta, valor: Opcion | null, alCambiar: (o: Opcion | null) => void, buscar: (texto: string) => Promise<Opcion[]>, error?, ayuda?, textoSinResultados?, alCrear?: (texto: string) => void, textoCrear? }` con `Opcion = { id: string; nombre: string; detalle?: string }`. Campo de búsqueda con retardo de 300 ms, resultados como lista de botones, teclado (flechas, Enter, Escape), y con valor elegido muestra el nombre y «Cambiar». No importa de `core`: quien lo usa le pasa `buscar`.
9. `Tablero<T>`: `{ etiqueta, columnas: Array<{ id: string; titulo: string; resumen?: string; filas: readonly T[] }>, clave: (f: T) => string, tarjeta: (f: T) => ReactNode, vacio?: ReactNode }`. Desde 640 px, columnas con desplazamiento horizontal; por debajo, una columna a la vez elegida con `CampoSelect`. Sin arrastre.

**Pruebas:** lógica pura de cada pieza (conversión de milésimas, navegación por teclado del selector como función pura, selección de columna). **Hecho cuando:** `/kit` muestra las nueve entregas y una pantalla nueva puede leer con `useQuery` sin crear su propio cliente. **Parar y preguntar:** `SelectorDeRegistro` o `Tablero` pasan de 150 líneas por accesibilidad (D6).

## 8. N1 · Inicio y bandeja con pendientes

Lo que hace que el ERP «avise»: la persona entra y ve qué espera por ella. Servidor y web, pequeño.

1. Herramienta nueva del núcleo `borradores_resumen` (`{}` → `{ pendientes: int, deAltaPrioridad: int }`; `borradores:ver`, lectura; cuenta solo los de módulos a los que la persona puede entrar). Contrato en `contratos/borradores.ts`.
2. Menú (`app/carcasa/**`): el destino «Bandeja» muestra el número de pendientes (insignia), en el menú lateral y en la barra inferior.
3. `/inicio` (`core/inicio/**`): tarjetas de pendientes, cada una solo si la persona tiene acceso de alcance `todos` al módulo: borradores por aprobar; deudas por cobrar vencidas (cantidad y monto, de `registro_resumen` del mes); entregas de hoy y pedidos atrasados (`ordenes_resumen`); actividades vencidas (`crm_resumen`). Cada tarjeta enlaza a su pantalla. Las llamadas van por `llamar` (por nombre: `core` no importa de `modules`).
4. Bandeja (`core/bandeja/logica.ts`): en la vista y en el formulario de corrección genéricos, un argumento cuyo nombre termina en `Centimos` se muestra y se edita en soles (`S/ 150.00`) y vuelve a céntimos al guardar; uno que termina en `Milesimas`, con tres decimales. Con pruebas.

**Hecho cuando:** un borrador de `deuda_crear` propuesto por un pedido se lee «Total: S/ 1,500.00» en la bandeja y el menú muestra «1». **Parar y preguntar:** se pide notificación por correo, WhatsApp o del navegador (ola 5; D24).

## 9. X2 · Cierre de la ola 2 (integrador)

1. Prueba de recorrido por HTTP `apps/api/src/pruebas/recorridos/ola-2.int.spec.ts`: empresa con `registro`, `crm` y `ordenes` activos → oportunidad ganada → pedido de dos líneas confirmado → `Relevo.procesarLote()` → el borrador de `deuda_crear` aparece en la bandeja → se aprueba → la deuda existe con `origenTipo: 'pedido'` → se abona en dos partes → `pagada` → la caja del día suma los dos ingresos. Un `member` con `registro` en `lectura` no puede aprobar ese borrador (`modulo_solo_lectura`).
2. Quitar `enConstruccion` de `registro`, `crm` y `ordenes` (cada uno al integrarse su carril web) y ajustar `core/modulos/catalogo.spec.ts` (la cuenta de «en construcción» baja de 8 a 5). `registro-agregar.spec.ts` no necesita cambios al agregar módulos (comprobado).
3. `pnpm db:generar` no genera nada; lista de migraciones `0013` a `0016` para la sesión de Neon.
4. Revisión visual por tandas con el usuario (pantallas de la ola 1 pendientes + las de la ola 2).
5. Tablero, `RELEVO.md`, `graphify update .`, y puerta de la ola 3 (`FICHAS-OLA-3.md` §6).

**Ola 2 lista cuando:** en una empresa de prueba (y en Atlantisgraf en cuanto exista despliegue, X1) se lleva la caja del día y las cuentas por cobrar a mano, un pedido confirmado deja su cobro en la bandeja, e Inicio muestra las deudas vencidas.
