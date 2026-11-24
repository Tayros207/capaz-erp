# Agente flotante · Diseño técnico

**Fecha:** 2026-11-24 · **Acompaña a:** `docs/PLAN-AGENTE-FLOTANTE.md` · **Para:** quien construye. Cada dato lleva su marca: **[V]** verificado hoy leyendo el código o `node_modules`, **[W]** verificado hoy en documentación oficial en la web (por un subagente; la fuente se cita), **[N]** no verificado, con el motivo.

Nada de este documento se ha construido ni ejecutado contra un modelo real.

---

## 1. APIs reales que usará el constructor

### 1.1 NestJS 12.4.2 · streaming [V]
- `@Sse(path?: string, options?: { method?: RequestMethod; maxPendingDataLength?: number })` en `@nestjs/common`. **Admite POST:** `@Sse('turno', { method: RequestMethod.POST })`. El manejador devuelve `Observable<MessageEvent>` (o una promesa de uno).
- `MessageEvent = { data?: string | object; id?: string; type?: string; retry?: number; comment?: string }`. Un `data` objeto se serializa a JSON. `comment` sirve de latido.
- `@SseSignal()` entrega un `AbortSignal` que se aborta cuando el cliente se desconecta.
- **Al cerrarse la conexión, Nest cancela la suscripción al Observable y cierra la respuesta** (`router-response-controller.js`, `onClose`). Consecuencia de diseño: el turno **no** puede vivir dentro del Observable; corre como promesa aparte y el Observable solo lo escucha (§6).
- Validación del cuerpo: `@Body({ schema })` con el pipe global `StandardSchemaValidationPipe` ya montado (`infra/http/validacion.ts`). Funciona con esquemas Zod 4.
- El guardia global (`core/auth/guardia.ts`) llena `contextoActual()` antes del manejador; `@RequiereEmpresa()` y `@RequierePermiso('x:y')` están en `infra/http/decoradores.ts`.
- `HerramientasModule` es `@Global()` y exporta `RegistroDeHerramientas` y `EjecutorDeHerramientas`: el módulo del agente los inyecta sin importarlo.

### 1.2 Zod 4.6.7 · contratos a JSON Schema [V]
- `z.toJSONSchema(esquema, { io: 'input', target: 'draft-07', unrepresentable: 'any', override })`.
- **Medido sobre los 303 contratos de negocio:** los 303 convierten, **ninguno falla**, todos dan raíz `type: "object"`, ninguno usa `$ref`.
- Los contratos no usan `transform`, `preprocess`, `coerce`, `date`, `bigint`, `lazy` ni `custom`. Usan `refine` en 84 sitios: **la regla del `refine` no aparece en el JSON Schema** (se pierde en silencio); el ejecutor la sigue validando y devuelve el error en español.
- `.default(...)` (94 sitios): con `io: 'input'` el campo sale opcional y con `default`.
- **Hay que limpiar el esquema.** 251 de 303 traen un `pattern` larguísimo para `uuid` y `date` además del `format`. Con este `override` el catálogo baja de ~61.500 a ~41.500 tokens:
  ```ts
  override: (ctx) => {
    const j = ctx.jsonSchema;
    if (j.format && j.pattern) delete j.pattern;
    if (j.maximum === Number.MAX_SAFE_INTEGER) delete j.maximum;
    if (j.minimum === Number.MIN_SAFE_INTEGER) delete j.minimum;
  }
  ```
- El resultado trae `$schema` y una propiedad no enumerable `~standard`: pasar por `JSON.parse(JSON.stringify(x))` y borrar `$schema`.
- Cuatro herramientas tienen el argumento `origen` con el valor `agente` (`movimiento_registrar`, `deuda_abonar`, `deuda_crear_con_adelanto`, y el filtro de `borradores_listar`). En las tres primeras el bucle **quita `origen` del esquema que ve el modelo y lo pone él** (`origen: 'agente'`).

### 1.3 Web [V]
- React Router 8.5.1: `useLocation()`, `useNavigate()`, `Outlet`, `createBrowserRouter`. Las rutas de módulo son `/m/<codigo>/…`; el registro único está en `apps/web/src/app/rutas.tsx` (el panel **no** añade rutas).
- `HojaInferior` (`shared/ui/hoja-inferior.tsx`): props `abierto, alCerrar, titulo, ancha?, pie?, alta?, children`. Es un `<dialog>` **modal** (`useDialogo` → `showModal()`), va por portal a `document.body`, Escape lo cierra. `alta` = 94 % del alto. **No tiene estados «asomada» ni arrastre**: lo que el plan anterior describía de Tairos no existe aquí.
- `Icono` (`shared/ui/icono.tsx`) solo acepta los nombres de `ICONOS` en `shared/ui/iconos.tsx` (17 hoy). Faltan los del panel: hay que añadirlos ahí (archivo compartido). Existen en `lucide-react` 1.73.0: `Sparkles`, `Mic`, `MicOff`, `ArrowUp`, `Square`, `History`, `SquarePen`, `Star`, `Trash2`, `Pencil`, `ArrowLeft`, `Copy` **[V]**. No se confirmó `SendHorizontal`, `Maximize2`, `MessageCircle` ni `RotateCcw` **[N]**: no usarlos sin comprobar.
- `Boton` (`shared/ui/boton.tsx`): `variante` (`primario | secundario | fantasma | peligro`), `tamano` (`normal | grande`), `cargando`, `icono`. Un botón solo de icono exige `aria-label`.
- Tokens (`shared/estilos/tokens.css`): colores `fondo, superficie, superficie-alta, borde, borde-fuerte, texto, texto-suave, texto-inverso, accion, accion-texto, peligro, aviso, exito, info, foco`; radios `rounded-control`, `rounded-tarjeta`, `rounded-chip`; sombras `shadow-sutil`, `shadow-tarjeta`, `shadow-elevada`; `--alto-control` (44 px táctil, 40 px desde tableta). Los componentes **solo** usan estos nombres.
- Capas (prueba de arquitectura): `app` puede importar de `core`; `core` no importa de `modules`; `shared` no importa de `core` ni de `app`. El panel vive en `apps/web/src/core/agente/` y lo monta `app/carcasa/carcasa.tsx`.
- Llamadas: `llamar(nombre, args)`, `llamarConfirmando(nombre, args, {titulo})` en `shared/api/herramientas.ts`; `pedir('GET' | 'POST', ruta, esquema, cuerpo?)` en `shared/api/cliente.ts` (**solo GET y POST**: por eso los endpoints del agente no usan PATCH ni DELETE).
- Pruebas web: Vitest en Node, **sin DOM** (no hay jsdom ni happy-dom). Se prueba lógica pura y `renderToStaticMarkup`. No se pueden probar clics, foco ni efectos.
- Captura reutilizable: `useReconocedorWebSpeech()` (`core/captura/use-reconocedor-web-speech.ts`, devuelve `ReconocedorDeVoz`), `proponerCaptura(args)` (`core/captura/api.ts`), `TarjetaDeBorrador` (`core/captura/tarjeta-de-borrador.tsx`, props `propuesta` y `alResolver`), y la lógica de `core/captura/logica.ts` (`decidirOrigen`, `transcurridoMs`, `instanteDeInicio`, `destinoSiEsPreguntaDePrecio`, `mensajeDeErrorDeCaptura`).

### 1.4 Ejecutor [V]
- `EjecutorDeHerramientas.ejecutar(nombre, args, { ctx, confirmacion?, claveDeIdempotencia? })` abre **su propia transacción** y lanza si ya hay una en curso: el bucle del agente llama `ejecutar()` **fuera** de `conEmpresa`.
- Con `ctx.canal = 'agente'` y una herramienta `critica`, responde **`confirmacion_solo_ui`** (línea 249), **antes** de calcular el resumen. No devuelve `pendiente_confirmacion` ni token (lo confirma `ejecutor-transaccion.int.spec.ts:165`).
- Una herramienta `normal` (también las que mueven dinero) se ejecuta por el canal `agente` sin pedir nada. **La política del agente no la aplica el ejecutor: la aplica `core/agente` antes de llamar.**
- `borrador_aprobar` rechaza todo canal distinto de `ui`.
- La clave de idempotencia solo cuenta en herramientas con `idempotente: true`.
- Cada llamada queda en `core.auditoria` con `canal`. **`auditoria_listar` no filtra por canal** (su contrato no tiene ese argumento): la «actividad del agente» necesita añadirlo.

---

## 2. Modelo de datos

Cuatro tablas en el esquema `core`. Archivo nuevo `apps/api/src/db/esquema/core-agente.ts`, una línea en `apps/api/src/db/esquema/index.ts`, una migración (número a reclamar; la última hoy es `0038`).

| Tabla | Para qué | Modo de `capaz_app` | Política extra |
|---|---|---|---|
| `core.agente_configuracion` | Una fila por empresa: modelo, tope, interruptores | `completo` | — |
| `core.agente_conversaciones` | Lista de conversaciones de cada persona | `completo` | `solo_propias` |
| `core.agente_mensajes` | Mensajes de la persona y del agente | `completo` | `solo_propias` |
| `core.uso` | Tokens y costo de cada turno (la tabla que pide `ARQUITECTURA-DE-IA.md` §3) | `insercion` | inmutable |

### 2.1 Drizzle

```ts
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, index, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { core } from './core.js';

export const agenteConfiguracion = core.table('agente_configuracion', {
  tenantId: text('tenant_id').primaryKey(),
  /** Nulo = el modelo del despliegue (`AGENTE_MODELO`). */
  modelo: text('modelo'),
  /** Millonésimas de dólar. Nulo = el tope del despliegue. */
  topeMensualMicrousd: bigint('tope_mensual_microusd', { mode: 'number' }),
  escrituraDirecta: boolean('escritura_directa').notNull().default(false),
  internet: boolean('internet').notNull().default(false),
  actualizadoPor: text('actualizado_por').notNull(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // La misma forma que valida Tairos: `proveedor/nombre`.
  check('agente_modelo_forma', sql`${t.modelo} is null or (length(${t.modelo}) <= 100 and ${t.modelo} ~ '^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._:-]*$')`),
  check('agente_tope', sql`${t.topeMensualMicrousd} is null or ${t.topeMensualMicrousd} >= 0`),
]);

export const agenteConversaciones = core.table('agente_conversaciones', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  tenantId: text('tenant_id').notNull(),
  usuarioId: text('usuario_id').notNull(),
  titulo: text('titulo').notNull(),
  favorita: boolean('favorita').notNull().default(false),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  /** La mueve el repositorio al guardar un mensaje (no un disparador: renombrar no debe reordenar). */
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('agente_conversaciones_persona_id').on(t.tenantId, t.usuarioId, t.id),
  check('agente_conversacion_titulo', sql`length(${t.titulo}) between 1 and 120`),
  index('idx_agente_conversaciones_persona').on(t.tenantId, t.usuarioId, t.actualizadoEn.desc()),
]);

export const agenteMensajes = core.table('agente_mensajes', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  tenantId: text('tenant_id').notNull(),
  usuarioId: text('usuario_id').notNull(),
  conversacionId: uuid('conversacion_id').notNull(),
  turnoId: uuid('turno_id').notNull(),
  rol: text('rol').notNull(),
  estado: text('estado').notNull().default('completo'),
  contenido: text('contenido').notNull().default(''),
  metadatos: jsonb('metadatos').notNull().default(sql`'{}'::jsonb`),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('agente_mensajes_turno_rol').on(t.tenantId, t.conversacionId, t.turnoId, t.rol),
  // La llave lleva `usuario_id`: nadie puede colgar un mensaje de la conversación de otra persona.
  foreignKey({ name: 'agente_mensajes_conversacion_fk', columns: [t.tenantId, t.usuarioId, t.conversacionId],
    foreignColumns: [agenteConversaciones.tenantId, agenteConversaciones.usuarioId, agenteConversaciones.id] }),
  check('agente_mensaje_rol', sql`${t.rol} IN ('persona', 'agente')`),
  check('agente_mensaje_estado', sql`${t.estado} IN ('completo', 'en_curso', 'interrumpido', 'error')`),
  check('agente_mensaje_largo', sql`length(${t.contenido}) <= 40000`),
  index('idx_agente_mensajes_conversacion').on(t.tenantId, t.conversacionId, t.creadoEn),
]);

/** Uso y costo. Solo inserción; sin llaves foráneas (particionable, como `core.auditoria`). */
export const uso = core.table('uso', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  tenantId: text('tenant_id').notNull(),
  usuarioId: text('usuario_id').notNull(),
  origen: text('origen').notNull(),
  turnoId: uuid('turno_id').notNull(),
  modelo: text('modelo').notNull(),
  tokensEntrada: integer('tokens_entrada').notNull().default(0),
  tokensSalida: integer('tokens_salida').notNull().default(0),
  tokensCache: integer('tokens_cache').notNull().default(0),
  /** Millonésimas de dólar (regla 9: nunca decimales en `number`). */
  costoMicrousd: bigint('costo_microusd', { mode: 'number' }).notNull().default(0),
  rondas: integer('rondas').notNull().default(0),
  duracionMs: integer('duracion_ms').notNull().default(0),
  resultado: text('resultado').notNull().default('ok'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('uso_origen', sql`${t.origen} IN ('agente', 'titulo', 'captura')`),
  check('uso_resultado', sql`${t.resultado} IN ('ok', 'cortado', 'error')`),
  index('idx_uso_empresa').on(t.tenantId, t.creadoEn.desc()),
  index('idx_uso_persona').on(t.tenantId, t.usuarioId, t.creadoEn.desc()),
]);
```

### 2.2 Seguridad a mano, al final de la migración

```sql
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
select core.aplicar_aislamiento('core.agente_configuracion', 'completo');
--> statement-breakpoint
create trigger agente_configuracion_actualizado before update on core.agente_configuracion
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint

-- Conversaciones y mensajes: además de la empresa, SOLO la persona dueña.
-- Política RESTRICTIVA (se suma con AND a «aislamiento»); sin cláusula TO: vale para todos los roles,
-- también el dueño de la base. No es una función ni usa security definer (regla 18).
select core.aplicar_aislamiento('core.agente_conversaciones', 'completo');
--> statement-breakpoint
drop policy if exists solo_propias on core.agente_conversaciones;
--> statement-breakpoint
create policy solo_propias on core.agente_conversaciones as restrictive
  using      (usuario_id = nullif(current_setting('app.user_id', true), ''))
  with check (usuario_id = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
select core.aplicar_aislamiento('core.agente_mensajes', 'completo');
--> statement-breakpoint
drop policy if exists solo_propias on core.agente_mensajes;
--> statement-breakpoint
create policy solo_propias on core.agente_mensajes as restrictive
  using      (usuario_id = nullif(current_setting('app.user_id', true), ''))
  with check (usuario_id = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint

-- Uso: de la empresa (el tope se suma entre todas las personas). Solo inserción.
select core.aplicar_aislamiento('core.uso', 'insercion');
--> statement-breakpoint
create trigger uso_inmutable before update or delete on core.uso
  for each row execute function core.rechazar_cambio();
```

**Por qué funciona [V parcial]:**
- `core.aplicar_aislamiento` (leída en `drizzle/0000_cimientos.sql`) crea la política permisiva `aislamiento` sin `TO`, activa `FORCE ROW LEVEL SECURITY` y da los permisos a `capaz_app`. Si alguien la vuelve a ejecutar, borra y recrea **solo** `aislamiento`; `solo_propias` sigue.
- `conEmpresa` fija `app.tenant_id` **y `app.user_id`** en cada transacción (`infra/database/con-empresa.ts`, leído).
- La prueba de catálogo exige la política `aislamiento` sin restricción de rol; **no prohíbe políticas adicionales** (leída).
- En el repositorio **no existe hoy ninguna política por persona**: esta es la primera. Por eso lleva su propia prueba de integración (§2.4).
- **[N]** No se ejecutó la migración. El comportamiento de una política `restrictive` junto a `aislamiento` es el documentado por PostgreSQL, pero aquí nadie lo ha corrido: la prueba de §2.4 es la que lo demuestra.
- Las conversaciones **no** se abren a `capaz_sistema`. Un barrido de retención que cruce empresas necesitaría una política explícita para ese rol (regla 18); en la primera versión no hace falta (§9.6).

### 2.3 Ejemplos para `aislamiento-ejemplos.ts` (obligatorio en el mismo paso)

`comoEmpresa` fija `app.user_id = 'prueba'`, así que los ejemplos usan `usuario_id = 'prueba'`. Van en este orden (la tabla referida antes).

```ts
'core.agente_configuracion': { sql: `insert into core.agente_configuracion (tenant_id, actualizado_por) values ($1, 'prueba')`, modo: 'completo' },
'core.agente_conversaciones': { sql: `insert into core.agente_conversaciones (id, tenant_id, usuario_id, titulo) values (md5($1::text || 'agc')::uuid, $1, 'prueba', 'Hola')`, modo: 'completo' },
'core.agente_mensajes': { sql: `insert into core.agente_mensajes (tenant_id, usuario_id, conversacion_id, turno_id, rol, contenido) values ($1, 'prueba', md5($1::text || 'agc')::uuid, md5($1::text || 'agt')::uuid, 'persona', 'Hola')`, modo: 'completo' },
'core.uso': { sql: `insert into core.uso (tenant_id, usuario_id, origen, turno_id, modelo) values ($1, 'prueba', 'agente', md5($1::text || 'agt')::uuid, 'simulado/uno')`, modo: 'insercion' },
```

### 2.4 Prueba de privacidad (`core/agente/privacidad.int.spec.ts`)

Con el rol `capaz_app`, la misma empresa y dos personas (`u_a` y `u_b`), usando un ayudante local que fija `app.tenant_id` y `app.user_id`:
1. `u_a` crea una conversación y un mensaje. `u_b` hace `select` de ambas tablas: **0 filas**.
2. `u_b` hace `update` y `delete` sobre la conversación de `u_a`: **0 filas afectadas**.
3. `u_b` inserta una conversación con `usuario_id = 'u_a'`: falla con `row-level security`.
4. `u_b` inserta un mensaje con su `usuario_id` y el `conversacion_id` de `u_a`: falla por la llave foránea.
5. El rol dueño, sin variables de sesión, ve 0 filas.
6. `core.uso`: `u_b` **sí** ve la fila de `u_a` (es de la empresa); `update` y `delete` fallan.

---

## 3. Contrato web ↔ API

Archivo nuevo `packages/shared/src/agente.ts`, exportado con **una línea** desde `packages/shared/src/index.ts`. **No toca `contratos/index.ts`** (no son herramientas), así que no puede tumbar el registro.

```ts
export const ENTIDADES_DE_PANTALLA = ['cliente', 'producto', 'pedido', 'orden_de_produccion', 'cotizacion', 'oportunidad', 'movimiento', 'deuda', 'borrador', 'guia'] as const;

/** Lo que la persona tiene delante. Es una PISTA para el modelo, nunca una autorización. */
export const pantallaDelAgenteSchema = z.strictObject({
  /** Solo el camino, sin consulta ni fragmento. */
  ruta: z.string().max(200).regex(/^\/[A-Za-z0-9/_.-]*$/),
  /** El `<codigo>` de `/m/<codigo>/…`, o nulo en pantallas del núcleo. */
  modulo: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/).nullable(),
  entidad: z.strictObject({ tipo: z.enum(ENTIDADES_DE_PANTALLA), id: z.uuid() }).nullable(),
});

export const turnoDelAgenteSchema = z.strictObject({
  conversacionId: z.uuid().optional(),      // sin él, el servidor crea la conversación
  turnoId: z.uuid(),                        // lo genera la web; el mismo en un reintento
  mensaje: z.string().trim().min(1).max(4000),
  origen: z.enum(['texto', 'voz']).default('texto'),
  pantalla: pantallaDelAgenteSchema.optional(),
});
```

**La web no manda títulos ni textos de la pantalla.** El nombre del módulo lo saca el servidor del manifiesto (`CatalogoDeModulos`) y el tipo de entidad de una lista fija. Así el contexto de pantalla no puede usarse para inyectar instrucciones. El servidor **no carga** la entidad: escribe una línea como «La persona está en Pedidos, viendo el pedido `<id>`» y el modelo, si la necesita, llama a `pedido_ver`, que revisa permisos como siempre.

`pantallaDesdeRuta(pathname)` (web, función pura, `core/agente/logica-pantalla.ts`) reconoce, con el id en forma de UUID:

| Ruta | `modulo` | `entidad.tipo` |
|---|---|---|
| `/clientes/:id` | null | `cliente` |
| `/productos/:id` | null | `producto` |
| `/bandeja/:id` | null | `borrador` |
| `/m/ordenes/guias/:id` | `ordenes` | `guia` |
| `/m/ordenes/:id` y sus subrutas de documento | `ordenes` | `pedido` |
| `/m/produccion/:id` | `produccion` | `orden_de_produccion` |
| `/m/cotizador/cotizaciones/:id`, `/m/cotizador/cuadro/:id` | `cotizador` | `cotizacion` |
| `/m/crm/oportunidades/:id` | `crm` | `oportunidad` |
| `/m/registro/movimientos/:id` | `registro` | `movimiento` |
| `/m/registro/deudas/:id` | `registro` | `deuda` |
| cualquier otra `/m/<codigo>/…` | `<codigo>` | null |

Todos estos patrones se leyeron en los `rutas.tsx` de cada área **[V]**. Las subrutas fijas de un módulo (`/m/ordenes/tablero`, `/m/ordenes/nuevo`, `/m/produccion/…`) no llevan UUID y por eso no dan entidad.

### 3.1 Eventos SSE (`POST /api/v1/agente/turno`)

Cada evento es `event: <tipo>` + `data: <JSON>`. Unión discriminada `eventoDelAgenteSchema` en `agente.ts`.

| `type` | `data` | Cuándo |
|---|---|---|
| `inicio` | `{ conversacionId, turnoId, modelo }` | Primer evento, ya guardado el mensaje de la persona |
| `texto` | `{ delta }` | Fragmentos de la respuesta |
| `herramienta_inicio` | `{ id, nombre, titulo }` | El agente empieza a usar una herramienta (`titulo` = `ayuda.titulo`) |
| `herramienta_fin` | `{ id, ok, nota }` | Terminó. `nota` es un texto corto del servidor («12 resultados», «sin permiso»); **nunca los datos** |
| `accion` | `{ herramienta, titulo, entidadTipo, entidadId }` | Una escritura directa ya hecha (fase 3) |
| `borrador` | `{ borrador: { id, herramienta, resumen, args, sugerencias: [] }, critica }` | El agente propuso algo que espera aprobación (fase 3). La forma de `borrador` es la de `propuestaDeCapturaSchema`: sirve tal cual a `TarjetaDeBorrador` |
| `uso` | `{ modelo, tokensEntrada, tokensSalida, tokensCache, costoMicrousd, rondas, duracionMs }` | Antes del fin |
| `fin` | `{ mensajeId, estado: 'completo' \| 'interrumpido' }` | Último evento de un turno guardado |
| `error` | `{ motivo, mensaje }` | Último evento si el turno no pudo terminar |
| *(comentario)* | `: latido` | Cada 15 s mientras no haya otro evento |

`motivo` ∈ `apagado`, `tope_mensual`, `limite_de_ritmo`, `turno_en_curso`, `modelo_no_disponible`, `tiempo_agotado`, `interno`. `mensaje` está en español y listo para mostrar. Los rechazos **previos** al primer evento (sin sesión, cuerpo inválido, origen inválido) salen como respuesta JSON normal `Respuesta<never>` con su estado HTTP, por el filtro de errores de siempre.

### 3.2 Endpoints REST del módulo (`@Controller('v1/agente')`)

Todos con `@RequiereEmpresa()`, cabecera `Cache-Control: no-store` y la misma comprobación de `Origin` que `herramientas.controller.ts` en los que escriben. Responden `Respuesta<T>`.

| Método y ruta | Cuerpo | Devuelve |
|---|---|---|
| `GET /estado` | — | `{ activo, motivo, modelo, puedeConfigurar, escritura }` (`escritura` ∈ `ninguna`, `borradores`, `directa`) |
| `POST /turno` (SSE) | `turnoDelAgenteSchema` | eventos de §3.1 |
| `GET /conversaciones?antesDe=<iso>` | — | `{ items: [{ id, titulo, favorita, actualizadoEn }], hayMas }` (50 por página; borra de paso las propias más viejas que la retención) |
| `GET /conversaciones/:id` | — | `{ id, titulo, favorita, mensajes: [{ id, turnoId, rol, estado, contenido, metadatos, creadoEn }] }` |
| `POST /conversaciones/:id/renombrar` | `{ titulo }` | la conversación |
| `POST /conversaciones/:id/favorita` | `{ favorita }` | la conversación |
| `POST /conversaciones/:id/borrar` | — | `{ id }` (borra mensajes y conversación en una transacción) |
| `GET /latido` (SSE) | — | 3 eventos `texto` separados 1 s y un `fin`. Sin modelo. Sirve para comprobar el streaming en el despliegue |

**Cambiar el modelo y el tope SÍ es una operación de negocio (regla 3):** no va por REST. Son dos herramientas registradas, con su contrato en `packages/shared/src/contratos/agente.ts`:
- `agente_configuracion_ver` (`lectura`, módulo `core`, permiso `empresa:ver`): modelo elegido, tope, interruptores, catálogo con precios en vivo y gasto del mes.
- `agente_configurar` (`critica`, módulo `core`, permiso `empresa:configurar`): `{ modelo?: string | null, topeMensualMicrousd?: number | null, escrituraDirecta?: boolean }`. Queda auditada y con confirmación. **El agente la tiene prohibida** (no puede cambiar su propio modelo ni su tope).

Esto corrige al plan anterior, que dejaba la duda abierta. Coste: el contrato se registra en `contratos/index.ts` **en el mismo paso** que las herramientas (regla de coordinación).

### 3.3 `metadatos` del mensaje del agente

```ts
{
  modelo: string,
  uso: { tokensEntrada, tokensSalida, tokensCache, costoMicrousd, rondas, duracionMs },
  pantalla: { ruta, modulo, entidad } | null,
  herramientas: [{ nombre, ok }],                                     // sin argumentos ni resultados
  acciones: [{ herramienta, titulo, entidadTipo, entidadId }],        // escrituras directas hechas
  borradores: [{ id, herramienta, resumen, critica }],                // propuestas
  corte: null | 'rondas' | 'tiempo' | 'tope' | 'error',
}
```
`acciones` y `borradores` se escriben **en cuanto ocurren** (no al final): es lo que permite saber qué se hizo si el turno se corta (§6).

---

## 4. Catálogo para el modelo: medición real

Script de medición en el directorio temporal de la sesión (no está en el repo). Estimación **tokens ≈ caracteres ÷ 4**; no es un tokenizador real y el español con JSON suele dar algo más. Formato medido: `{type:'function', function:{name, description, parameters}}` con `description = ayuda.paraQueSirve`.

| Qué se le ofrece al modelo | Tokens (≈) |
|---|---|
| Las 303 herramientas, esquema tal cual sale de Zod | **61.500** (66.600 con `cuandoUsarla`) |
| Las 303, esquema limpio (§1.2) | **41.500** |
| Las 117 de lectura, tal cual / limpias | 19.000 / **12.500** |
| 8 lecturas del núcleo «siempre» (limpias) | 760 |
| Lecturas de un módulo (limpias) | de 180 (reportes) a 3.000 (núcleo); pedidos 1.240, finanzas 1.360, cotizador 2.400 |
| Todas las herramientas de un módulo (limpias) | de 180 a 11.500 (cotizador); pedidos 3.800, finanzas 4.600 |
| Mapa con solo los nombres agrupados | 1.600 |
| Mapa con nombre + una línea de las 303 | 11.000 |
| Ejemplo: 14 lecturas + 3 meta-herramientas | **3.000** |

**Corrige al plan anterior:** no son ~90.000 tokens, son ~61.500 (o ~41.500 limpiando el esquema). Y el argumento cambia: con DeepSeek el costo de mandar todo sería pequeño (unos milésimos de dólar por ronda); el problema real es la **precisión** de un modelo sin evaluar frente a 300 opciones y el costo si Moisés cambia a un modelo más caro con el selector.

### 4.1 Qué se ofrece en cada turno

`catalogoParaElTurno(ctx, pantalla, modo)` devuelve la lista de `tools`. Presupuesto: **≤ 8.000 tokens** (una prueba lo vigila).

1. **Filtro de acceso:** solo herramientas cuyo módulo `puedeEntrar` y cuyo permiso tiene la persona (mismas reglas que `comprobarAcceso`). Lo que no puede usar, el modelo ni lo ve.
2. **Filtro de política:** fuera las `prohibido` y las 11 lecturas excluidas (`AGENTE-AUDITORIA-HERRAMIENTAS.md` §4).
3. **Filtro de modo:** con `escritura = 'ninguna'` solo lecturas (y `captura_proponer`).
4. **Siempre:** `mi_dia_ver`, `clientes_buscar`, `clientes_ver`, `productos_buscar`, `borradores_resumen`, `borradores_listar`, `precio_anterior_consultar`, `captura_proponer`.
5. **Por pantalla:** las herramientas del `modulo` de la pantalla (lecturas primero; escrituras si el modo lo permite) hasta agotar el presupuesto.
6. **Tres meta-herramientas internas** (no se registran; las atiende el bucle):
   - `software_mapa({ modulo? })`: sin argumento, las áreas con el nombre del módulo y los **nombres** de sus herramientas disponibles; con `modulo`, `nombre: paraQueSirve` de cada una.
   - `herramienta_describir({ nombre })`: esquema limpio + `titulo`, `paraQueSirve`, `cuandoUsarla`, `ejemploTecleado`, `erroresComunes`.
   - `herramienta_llamar({ nombre, args })`: sigue **el mismo camino** que una llamada nativa (política → ejecutor).

El orden de la lista es estable (alfabético dentro de cada grupo) para no romper la caché de prefijo.

---

## 5. Cliente del modelo (OpenRouter por `fetch`, sin dependencias)

Interfaz `ModeloDeChat` con dos implementaciones: `ModeloDeOpenRouter` y `ModeloSimulado` (guion fijo; es el que usan **todas** las pruebas).

```ts
export type MensajeDeModelo =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LlamadaDeModelo[]; reasoning_details?: unknown }
  | { role: 'tool'; tool_call_id: string; content: string };
export type LlamadaDeModelo = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type TrozoDeModelo =
  | { tipo: 'texto'; delta: string }
  | { tipo: 'fin'; motivo: 'stop' | 'tool_calls' | 'length' | 'error'; llamadas: LlamadaDeModelo[]; razonamiento: unknown; uso: UsoDeRonda | null };
export type UsoDeRonda = { entrada: number; salida: number; cache: number; costoMicrousd: number };
export interface ModeloDeChat {
  conversar(p: { modelo: string; mensajes: MensajeDeModelo[]; herramientas: unknown[]; senal: AbortSignal; sesion: string }): AsyncIterable<TrozoDeModelo>;
}
```

Cuerpo de la petición a `https://openrouter.ai/api/v1/chat/completions`:

```json
{
  "model": "<id>", "messages": [], "tools": [], "tool_choice": "auto",
  "stream": true, "max_tokens": 2000,
  "reasoning": { "effort": "none" },
  "provider": { "data_collection": "deny", "zdr": true, "require_parameters": true }
}
```

Hechos de OpenRouter y DeepSeek **[W]**, consultados el 2026-11-24:

| Hecho | Fuente | Efecto en el diseño |
|---|---|---|
| El uso llega **siempre** en el último trozo, con `usage.cost` en dólares y `prompt_tokens_details.cached_tokens`. `usage: {include: true}` y `stream_options.include_usage` están deprecados y sin efecto. | `openrouter.ai/docs` (streaming, usage accounting) | No mandar esos campos. `costoMicrousd = Math.round(usage.cost * 1e6)`. |
| Los `tool_calls` llegan por fragmentos con `index`; `finish_reason` ∈ `tool_calls, stop, length, content_filter, error`. | referencia de chat completions | Acumular por `index` (como el daemon de Tairos, líneas 3160–3172). |
| Hay comentarios `: OPENROUTER PROCESSING`. Un error a mitad de flujo llega con **HTTP 200**, un objeto `error` de primer nivel y `finish_reason: "error"`. | docs de streaming | Saltar líneas que empiezan por `:`. Tratar `error` como fallo de la ronda. |
| `provider.data_collection: "deny"`, `provider.zdr`, `only`, `order`, `allow_fallbacks`, `require_parameters` existen. Si ningún proveedor cumple, la doc lista un **503**. | guía de selección de proveedor; errores | Motivo `modelo_no_disponible`. El texto 404 «No endpoints found matching your data policy» **[N]**. |
| Hay una lista pública de endpoints sin retención: `openrouter.ai/api/v1/endpoints/zdr`. Quedan **fuera** DeepSeek directo, Baidu, Alibaba, StreamLake, SiliconFlow y Novita. Dentro: 15 de 22 endpoints de V4 Pro 0813 y 44 de 53 de V4.1 Flash 1017. | esa URL | Con `zdr: true` la petición no puede ir a DeepSeek en China. Qué endpoints sobreviven a `data_collection: "deny"` **[N]**: no hay campo público. |
| `tool_choice: "required"` no lo admiten todos los endpoints. | `…/models/<id>/endpoints` | Usar solo `"auto"`. |
| DeepSeek cachea el prefijo solo, sin `cache_control`; lectura al 0,1× del precio de entrada. | guía de prompt caching | No mandar marcas de caché. Mantener el prefijo estable (§4.1, prompt). |
| El razonamiento se controla con `reasoning: { effort }`; en V4/V4.1 los valores son `max, high, low, none` y por defecto es `high`. `exclude: true` lo oculta **pero se cobra**. | guía de reasoning tokens; lista de modelos | Por defecto `effort: "none"` (variable `AGENTE_RAZONAMIENTO`). |
| Con razonamiento **y** herramientas, la API de DeepSeek exige devolver el `reasoning_content` de **todos** los turnos anteriores; si falta responde 400. En OpenRouter se devuelve `reasoning_details` sin tocar. | `api-docs.deepseek.com/guides/thinking_mode` ; guía de OpenRouter | Dentro de un turno el bucle guarda `reasoning_details` en el mensaje `assistant` y lo reenvía tal cual. Entre turnos **no** se guarda. Por eso el valor seguro es `none`. Si un proveedor intermedio lo exige de verdad con `low` **[N]**: es un escenario del banco de evaluación. |
| La búsqueda web es el *server tool* `openrouter:web_search` (el sufijo `:online` está deprecado). Con DeepSeek usa Exa: US$ 0,007 por petición. | guía de web search | Solo para la fase 6 (D4). |

Tiempos: 30 s para conectar, 60 s de silencio entre trozos, 120 s para el turno entero. Los tres abortan la misma `AbortSignal`.

---

## 6. El turno, paso a paso

`ServicioDeTurnos.iniciar(ctx, cuerpo)` devuelve un `Observable<MessageEvent>` y lanza `correr()` **sin esperarla**. `correr()` empuja eventos a un `Subject`; si nadie escucha (cliente desconectado), sigue igual.

```
0. Comprobaciones, todas antes del primer evento:
   proveedor ≠ 'apagado'  ·  la persona puede entrar al menos a un módulo
   gasto del mes (sum(costo_microusd) de core.uso) < tope            → si no, error tope_mensual
   turnos de la persona en los últimos 60 s < 6 y en 24 h < 300       → si no, error limite_de_ritmo
1. Transacción corta (conEmpresa):
   - crear la conversación si no vino (título = primeros 55 caracteres del mensaje)
   - insertar mensaje 'persona'  (on conflict do nothing)
   - insertar mensaje 'agente' con estado 'en_curso' (on conflict do nothing, returning)
   Si el mensaje 'agente' YA existía (reintento con el mismo turnoId):
     · 'completo'                         → emitir su texto de una vez + fin. No se llama al modelo.
     · 'en_curso' con menos de 150 s      → error turno_en_curso
     · cualquier otro caso con acciones   → marcar 'interrumpido', emitir fin. NO se repite.
     · cualquier otro caso sin acciones   → volver a 'en_curso' y seguir (repetir es inocuo)
2. Emitir 'inicio'. Leer historial: últimos 30 mensajes 'completo' (tope 24.000 caracteres),
   solo texto; a cada respuesta del agente se le añade una línea «[Hizo: …]» con sus acciones y borradores.
3. Hasta 6 rondas:
   a. llamar al modelo (streaming) → eventos 'texto'
   b. sin tool_calls → fin del bucle
   c. por cada tool_call, en orden y de a una:
        - JSON.parse de los argumentos. Si falla: NO se ejecuta nada; el resultado es
          {"error": "Los argumentos no son JSON válido. Vuelve a enviarlos completos."}
        - meta-herramienta → la atiende el bucle
        - política (§7) → prohibido | borrador | directo
        - directo: ejecutor.ejecutar(nombre, args, { ctx: {...ctx, canal:'agente'},
                   claveDeIdempotencia: `${turnoId}:${ronda}:${indice}` })
        - resultado → recorte (§6.1) → mensaje 'tool'
        - si fue escritura o borrador: UPDATE inmediato de metadatos del mensaje 'agente'
   d. si es la ronda 6 y el modelo aún pide herramientas → corte 'rondas'
4. Transacción corta: mensaje 'agente' → 'completo' (o 'interrumpido' con su corte),
   contenido y metadatos; insertar core.uso; conversación.actualizado_en = now().
5. Emitir 'uso' y 'fin'.
En cualquier excepción: mensaje 'agente' → 'error', insertar core.uso con resultado 'error', emitir 'error'.
```

**Ninguna transacción queda abierta mientras se espera al modelo.** Las conexiones del grupo son 10 (`database.service.ts`).

### 6.1 Recorte de resultados
- El resultado de una herramienta se serializa y, si pasa de **6.000 caracteres**, se recorta: las listas (`items` o cualquier arreglo de primer nivel) se cortan a los primeros N que quepan y se añade `"_recortado": { "mostrados": N, "total": <largo original> }`.
- Todo resultado va envuelto: `{"ok": true, "datos": …}` o `{"ok": false, "error": {codigo, mensaje}}`. Los rechazos del ejecutor llegan al modelo con su mensaje en español.
- Lo que sale de `respuesta.avisos` y `respuesta.recibo` ya viene filtrado por permisos por el ejecutor (`filtrarPorPermisos`).

### 6.2 Vercel: qué pasa si el móvil se va a segundo plano

Hechos **[W]** (documentación de Vercel, consultada el 2026-11-24):

| Hecho | Fuente |
|---|---|
| Con Fluid Compute, duración por defecto **300 s** en Hobby (máximo 300) y en Pro (máximo 800). Fluid está activo por defecto en proyectos creados desde el 2025-04-23. | `vercel.com/docs/functions/limitations`, `/docs/fluid-compute` |
| NestJS se despliega como una sola función y el SSE está documentado con `@Sse()` y un Observable. El streaming está activo por defecto en Node.js. | `/docs/frameworks/backend/nestjs` |
| La duración del flujo cuenta contra el máximo; al pasarlo, 504 `FUNCTION_INVOCATION_TIMEOUT`. | `/docs/functions/limitations` |
| La cancelación al desconectarse el cliente es **opcional** (`supportsCancellation`); este proyecto no la activa. | `/docs/functions/functions-api-reference#cancel-requests` |
| `waitUntil` (paquete `@vercel/functions`) alarga la invocación tras la respuesta, con el mismo tope; no reintenta. | `/docs/functions/functions-api-reference/vercel-functions-package` |
| «Las capas intermedias pueden cerrar conexiones inactivas»: recomiendan mandar progreso o latidos. | `/docs/functions/configuring-functions/duration` |
| Con `services`, `functions` va dentro de cada servicio. | `/docs/services` (Beta) |
| Cron: 100 por proyecto; Hobby una vez al día, Pro una vez por minuto; GET a producción con `Authorization: Bearer <CRON_SECRET>`; sin reintentos. Vercel lo marca como función «legacy» que migrará a Schedules. | `/docs/cron-jobs/usage-and-pricing`, `/docs/cron-jobs/manage-cron-jobs` |

Lo que **no** se pudo comprobar **[N]**:
- Que **este** proyecto tenga Fluid activo y en qué plan está (se mira en el panel de Vercel o con `vercel inspect`).
- Que la función **siga corriendo** después de que el cliente se desconecta. La doc no lo afirma: solo se deduce de que la cancelación sea opcional. Tras cerrarse la respuesta, la instancia puede quedar suspendida.
- Cómo fijar `maxDuration` para NestJS dentro de `services` (el único ejemplo documentado es de Python). No hace falta tocarlo: 120 s caben en los 300 por defecto.
- Si el camino `/api/*` → servicio `api` hace *buffering* del flujo. Se comprueba con `GET /api/v1/agente/latido` una vez desplegado (los tres eventos deben llegar separados por 1 s).

**Diseño que sobrevive sin depender de lo no verificado:**
1. El mensaje de la persona se guarda **antes** de llamar al modelo. Nunca se pierde.
2. El mensaje del agente existe desde el paso 1 como `en_curso` y cada escritura se anota al momento.
3. El turno corre desligado de la conexión: si la plataforma lo deja terminar, queda `completo` aunque nadie lo esté mirando.
4. Si la web pierde el flujo sin haber recibido `fin` ni `error`: espera 3 s, pide `GET /conversaciones/:id` hasta 5 veces (cada 4 s). Si el mensaje aparece `completo`, lo pinta. Si sigue `en_curso` pasados 150 s desde su creación, lo muestra como «La respuesta se interrumpió» con el botón **Reintentar**, que reenvía el **mismo `turnoId`** (paso 1 decide si repetir o no).
5. Al volver la pestaña a primer plano (`visibilitychange`), la web repite el punto 4 si había un turno abierto.
6. **Mejora opcional (decisión D8):** envolver `correr()` en `waitUntil` exige la dependencia `@vercel/functions`. No se instala sin orden (regla 15). Sin ella, el punto 4 cubre el caso.

---

## 7. Política del agente (dónde se decide qué hace solo)

`core/agente/politica.ts`, función pura:

```ts
export type Politica = 'directo' | 'borrador' | 'prohibido';
export function politicaDe(h: { nombre: string; criticidad: Criticidad; mueveDinero: boolean }, args: unknown,
  modo: 'ninguna' | 'borradores' | 'directa'): Politica
```
1. `criticidad === 'lectura'` → `directo` (salvo las 11 excluidas → `prohibido`).
2. `PROHIBIDAS.has(nombre)` → `prohibido`.
3. `modo === 'ninguna'` → `prohibido`, salvo `captura_proponer` (solo propone borradores con las reglas del dictado).
4. `criticidad === 'critica'` o `mueveDinero` → `borrador`.
5. `modo === 'directa'` y `DIRECTAS.has(nombre)` y ninguna excepción por argumento → `directo`.
6. Todo lo demás → `borrador`. **Una herramienta nueva cae aquí.**

`PROHIBIDAS` y `DIRECTAS` son listas de nombres copiadas de `AGENTE-AUDITORIA-HERRAMIENTAS.md` §3. Son cadenas, no imports: no rompen la regla 7 (precedente: `HERRAMIENTAS_CON_SECRETOS` en `core/borradores/proponer.ts`). Una prueba de integración recorre el registro real y falla si una lista nombra una herramienta que ya no existe.

`modo` sale de: modelo no evaluado → `ninguna` (D7); evaluado y `escritura_directa = false` → `borradores`; evaluado y `true` → `directa`.

### 7.1 Cómo propone un borrador
1. `ejecutor.validar(nombre, args, ctx)` (método público **nuevo**, 10 líneas, que envuelve al privado `comprobar`): existe, argumentos reservados, módulo, permiso y esquema. Si falla, el error vuelve al modelo y **no** se propone nada.
2. `db.conEmpresa(ctx, (tx) => proponerBorrador(tx, { herramienta, args: datosValidados, resumen, origen: 'agente', origenRef: `agente:${conversacionId}:${turnoId}`, propuestoPor: ctx.usuarioId }))`. Es el mismo camino que usan las reglas automáticas (`core/automatizaciones/motor.ts:121`).
3. `resumen` lo arma el **servidor**: `ayuda.titulo` de la herramienta. No se usa texto del modelo: un resumen redactado por el modelo podría decir una cosa y los argumentos otra.
4. El resultado para el modelo: `{"ok": true, "propuesto": true, "borradorId": "…", "nota": "Quedó como borrador. La persona debe aprobarlo; no está hecho."}`.
5. Evento `borrador` a la web.

### 7.2 Cómo se aprueba (ya existe, no se toca) [V]
La tarjeta llama a `aprobarBorrador(id, resumen)` (`core/bandeja/api.ts`) → `llamarConfirmando('borrador_aprobar', …)` → `POST /v1/herramientas/borrador_aprobar` con canal `ui`. Si la herramienta propuesta es **crítica**, `ejecutarDentro` devuelve `requiereConfirmacion` con el resumen que calcula **la propia herramienta** y un token de 120 s; la web muestra el diálogo y reenvía el token. El agente nunca ve ni el resumen ni el token.

Consecuencia: **no hay «tarjeta de confirmación» distinta de la «tarjeta de borrador»**. Es la misma tarjeta; si es crítica, al pulsar Aprobar aparece el segundo paso. Y como el borrador vive en la bandeja, **no caduca a los 120 s**: lo que caduca es el token, que se pide de nuevo al pulsar.

---

## 8. Seguridad

| Amenaza | Defensa (dónde vive) |
|---|---|
| Un nombre de cliente, una nota o el motivo que escribe un cliente en el enlace público de una cotización dice «ignora lo anterior y…» | La política de §7 es **código**, no texto del prompt: el modelo no puede ejecutar lo prohibido ni saltarse el borrador aunque obedezca la inyección. Además el prompt marca los resultados como datos. |
| El modelo intenta mandar `empresaId`, `usuarioId`, `permisos` o `canal` | El ejecutor ya lo rechaza con `argumento_prohibido` y lo audita. |
| Sacar datos por una URL o una imagen en la respuesta | El panel pinta **texto plano** con saltos de línea, negritas y listas. **No** pinta imágenes ni convierte URL externas en enlaces. Los enlaces a entidades los crea la web a partir de `accion` y `borrador`, nunca del texto del modelo. |
| Volcar la base por partes | Lecturas en bloque excluidas; recorte a 6.000 caracteres por resultado; 6 rondas; tope de ritmo. |
| Que el agente se dé más poder | `agente_configurar`, miembros, invitaciones, llaves, conexiones, webhooks y reglas están en `PROHIBIDAS`. |
| Factura sin control | Tope mensual por empresa (comprobado antes de cada turno), 6 rondas, 2.000 tokens de salida por ronda, 120 s por turno, 6 turnos por minuto y 300 por día por persona. Interruptor global `AGENTE_PROVEEDOR=apagado`. |
| Dos turnos a la vez de la misma persona | El paso 1 rechaza si hay un mensaje `en_curso` reciente en esa conversación. |
| Una persona lee el hilo de otra | Política `solo_propias` en la base + prueba de integración. |
| Datos personales en los registros | Nunca se registra el mensaje, el prompt ni los resultados: solo contadores, modelo y duración. |
| Petición desde otro sitio con la cookie | Comprobación de `Origin` como en la puerta de herramientas. |
| El modelo inventa que hizo algo | El prompt lo prohíbe y la web solo muestra «hecho» por eventos `accion`; el texto del modelo no lleva esa insignia. |
| Datos de clientes en un tercero (Ley 29733) | `zdr: true` + `data_collection: "deny"`; DeepSeek directo queda fuera. No se manda audio. **La revisión legal de la transferencia al exterior sigue pendiente y no la hace este documento.** |

El límite de ritmo se cuenta en `core.uso` (base de datos), no en memoria: en *serverless* cada instancia tiene su propia memoria y un contador local no limita nada (es el mismo problema que `RELEVO.md` señala en `entrada.controller.ts`).

---

## 9. Web: el panel

### 9.1 Piezas (todas en `apps/web/src/core/agente/`)
| Archivo | Qué es |
|---|---|
| `lanzador-del-agente.tsx` | El botón flotante. Está en el paquete principal. |
| `panel-del-agente.tsx` | Cabecera + hilo + caja. Se carga con `lazy` al primer clic. |
| `hilo.tsx` | Lista de mensajes y tarjetas. |
| `caja-de-mensaje.tsx` | Área de texto, micrófono, enviar / detener. |
| `vista-de-historial.tsx` | Lista de conversaciones (vacía en la fase 1). |
| `logica-*.ts` | Todo lo que se pueda probar sin DOM. |

### 9.2 Medidas propias (regla 12: no se copian de Tairos)
- Botón: `size-14` (56 px), redondo, `bg-accion text-accion-texto shadow-elevada`, icono `size-6`. Foco visible con el token `foco`.
- Móvil (< `md`): `fixed right-4 z-30`, `bottom: calc(env(safe-area-inset-bottom, 0px) + 3.5rem + 0.75rem)`: queda **encima** de la barra inferior (`min-h-14`, `z-20`).
- Escritorio (`md` en adelante): `right-6 bottom-6`.
- `print:hidden`. No se pinta mientras el panel está abierto.
- Panel en escritorio: `fixed right-6 bottom-6 z-30 w-[26rem] h-[min(40rem,calc(100dvh-6rem))] rounded-tarjeta border border-borde bg-superficie shadow-elevada`, **no modal** (`<section role="dialog" aria-modal="false" aria-label="Asistente">`): la persona sigue viendo y usando la pantalla de la que habla.
- Panel en móvil: `HojaInferior` con `alta`, modal.
- Elegir uno u otro: un hook nuevo `shared/ui/use-ancho.ts` con `window.matchMedia('(min-width: 48rem)')`.

### 9.3 Estados que deben existir
| Estado | Qué se ve |
|---|---|
| Vacío | Saludo corto y 3 sugerencias que **rellenan** la caja (no envían): «¿Qué tengo pendiente hoy?», «¿Quién me debe?», «Registra un ingreso de…». |
| Sin IA (fase 1 o `apagado`) | Aviso fijo: «Por ahora puedo registrar lo que dictes o escribas. Las preguntas llegan cuando se active el asistente.» |
| Escribiendo | Texto que crece; línea «Consultando pedidos…» por cada `herramienta_inicio`; botón **Detener**. |
| Borrador propuesto | `TarjetaDeBorrador` dentro del hilo. |
| Error | Mensaje del servidor + **Reintentar** (mismo `turnoId`). El texto de la persona no se pierde. |
| Interrumpido | «La respuesta se interrumpió.» + lo que sí se hizo + **Reintentar** si procede. |
| Tope alcanzado | «Se alcanzó el tope de uso de este mes.» Sin botón de reintento. |
| Historial vacío | «Aquí aparecerán tus conversaciones.» |
| Historial cargando / con error | Esqueleto (`shared/ui/esqueleto.tsx`) / mensaje + Reintentar. |
| Sin voz en el navegador | El micrófono no se pinta y aparece el aviso que ya da `useReconocedorWebSpeech`. |

### 9.4 Accesibilidad y teclado
- El botón lleva `aria-label="Abrir el asistente"`, `aria-haspopup="dialog"`, `aria-expanded`.
- Al abrir, el foco va al área de texto; al cerrar, vuelve al botón.
- El hilo es `role="log"` con `aria-live="polite"`; los errores, `role="alert"`.
- Enter envía, Mayús+Enter salta de línea. Escape: primero **detiene** la respuesta en curso; si no hay ninguna, cierra.
- Atajo `Ctrl/Cmd + J` con `preventDefault`. **[N]** En Chrome y Firefox esa combinación abre las descargas; no se probó que la página pueda quedársela. Si estorba, se cambia en un solo sitio.
- Todo objetivo táctil mide al menos `--alto-control`.
- `prefers-reduced-motion`: sin animación de entrada.

### 9.5 Voz
El micrófono del panel usa `useReconocedorWebSpeech()` tal cual. El texto reconocido se **suma** a la caja y se puede corregir antes de enviar; **nunca se envía solo**. No se graba ni se sube audio. En Firefox sigue sin haber voz (limitación del navegador, memoria del proyecto): el texto es el respaldo.

- **Fase 1 (sin modelo):** enviar llama a `proponerCaptura({ texto, origen, transcurridoMs, modulo: 'registro' })`. Si `destinoSiEsPreguntaDePrecio(texto)` devuelve una ruta, se ofrece el enlace a `/precios` en vez de crear nada.
- **Fase 2 en adelante:** enviar llama a `/agente/turno` con `origen: 'voz' | 'texto'`. El modelo tiene `captura_proponer` en su conjunto de siempre y la usa cuando lo dicho es un registro; así el dictado sigue pasando por las reglas de Tairos.RC y sale la misma tarjeta.

### 9.6 Retención (D6)
Sin trabajo programado (el relevo no corre en *serverless*). Al listar, el servidor borra **las conversaciones de esa persona** más antiguas que `AGENTE_RETENCION_DIAS` (90 por defecto), dentro de la misma transacción. Un barrido global con Vercel Cron queda para la fase 7.

---

## 10. Variables de configuración nuevas (`infra/config/config.ts`)

| Variable | Tipo y valor por defecto | Nota |
|---|---|---|
| `AGENTE_PROVEEDOR` | `apagado \| simulado \| openrouter`, por defecto `apagado` | `simulado` se rechaza si `NODE_ENV = production` |
| `OPENROUTER_API_KEY` | texto, opcional | Obligatoria si el proveedor es `openrouter` |
| `AGENTE_MODELO` | texto, por defecto `deepseek/deepseek-v4.1-flash-1017` | Debe estar en el catálogo de `core/agente/modelos.ts` |
| `AGENTE_RAZONAMIENTO` | `none \| low \| high`, por defecto `none` | §5 |
| `AGENTE_TOPE_MENSUAL_USD` | número ≥ 0, por defecto `5` | Valor provisional hasta D3 |
| `AGENTE_RETENCION_DIAS` | entero 1–3650, por defecto `90` | D6 |
| `AGENTE_MAX_RONDAS` | entero 1–10, por defecto `6` | |

Todas opcionales con valor por defecto: **añadirlas no rompe el arranque de nadie** ni obliga a tocar el `.env` de las otras sesiones.
