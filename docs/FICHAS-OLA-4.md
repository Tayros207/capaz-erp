# Fichas congeladas de la ola 4 · Captura por voz y texto, y Cotizador (corte B1)

**Versión 1 · 2026-11-16 · Estado: CONGELADA para las tandas 1 y 2; la tanda 3 va en esquema (arquitectura fijada, detalle al cerrar la tanda 2). Para: los agentes de carril (Sonnet, esfuerzo medio) y el integrador.**

Desarrolla `docs/PLAN-INTEGRACION-COTIZIN-Y-SF.md` §4 (aprobado por el dueño el 2026-11-16) y `docs/adr/ADR-017-captura-y-cotizador.md`. Se escribió leyendo el código real de `main` (migraciones `0000` a `0022`), la copia de Cotizín y Tairos.RC. **Si este documento y el código se contradicen, el carril para y pregunta.** Un cambio a lo escrito aquí lo hace solo el integrador. Las contradicciones que ya se encontraron están resueltas en la §11.

Rutas con prefijo, como en el plan: `COT/` = `/home/datayros/Documentos/work/referencias/cotizin-2026-11-14/` · `SF/` = `/home/datayros/Documentos/work/modules/SF-registro-conversacional/`. Las dos son de **solo lectura** (regla 13). Nadie abre un `.env`.

## 0. Cómo leerlo

- **Agente de carril:** lee `AGENTS.md`, `PLAN-PARALELO.md` §2 y §8, la **§1 de este documento** y **solo la sección de tu carril**. Las reglas R1 a R18 de `FICHAS-OLA-2.md` §1 valen igual; léelas si tu carril es de módulo (`M-*`).
- Búscala con `grep -n '^## \|^### ' docs/FICHAS-OLA-4.md`.
- Verificaciones (las de `PLAN-PARALELO.md` §5): **VERIF-SERVIDOR** = `pnpm check` en el directorio del carril (con su `CAPAZ_TEST_DB`) · **VERIF-WEB** = `pnpm --filter @capaz/shared build && pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build && pnpm --filter api test` · **VERIF-DATOS** = dentro de `apps/api`, `node scripts/migrar.ts --base capaz_test_<id>` dos veces; después `pnpm check` en la raíz y `pnpm db:generar` (no debe generar nada).

| § | Contenido | Carril | Tanda |
|---|---|---|---|
| 1 | Reglas comunes de la ola 4 (R19 a R26) | todos | — |
| 2 | Paso previo | C4 (integrador) | 0 |
| 3 | Captura (núcleo) | C3 | 1 |
| 4 | Reglas de dictado | M-registro-s5a | 1 |
| 5 | Motor del Cotizador | M-cotizador-s0 | 1 |
| 6 | Datos del Cotizador (`0024_cotizador`) | DB5 | 1 |
| 7 | Intérprete de Finanzas y `deuda_crear_con_adelanto` | M-registro-s5b | 2 |
| 8 | Pantalla de dictado | W11 | 2 |
| 9 | Cotizador: precios y configuración | M-cotizador-s1 | 2 |
| 10 | Esquema de la tanda 3 | M-cotizador-s2 · M-ordenes-s3 · M-cotizador-w1 · X4 | 3 |
| 11 | Contradicciones halladas y cómo se resolvieron | integrador | — |
| 12 | Decisiones abiertas del dueño y de Keny | — | — |
| 13 | Riesgos | — | — |
| 14 | Lo no verificado | — | — |

### 0.1 Mapa de carriles y qué arranca primero

**Condición de partida (orden del dueño, 2026-11-16):** la ronda 3 de administración de cuentas va antes y usa la migración `0023`. **Ningún carril de la ola 4 se lanza hasta que esa ronda esté integrada en `main`.** Las fichas no usan nada de esa ronda; solo cuenta su número de migración: la del Cotizador es **`0024_cotizador`**.

```
ronda 3 integrada (0023 en main)
   └─► C4 (integrador, minutos) ─► C3 ─┐
        s5a ───────────────────────────┴─► s5b ─► W11 (de punta a punta)
        s0 ──┐
        DB5 ─┴─► s1 ─► s2 ─► (w1, ordenes-s3) ─► X4
```

| Tanda | En paralelo (máximo 4 abiertos) | Se lanza cuando | Neon |
|---|---|---|---|
| 0 | **C4** | ronda 3 integrada | no |
| **1** | **DB5 · M-cotizador-s0 · M-registro-s5a** (los tres a la vez, no esperan a C4) y **C3** (en cuanto C4 esté en `main`) | ronda 3 integrada | **sí: `0024`** |
| 2 | M-registro-s5b · W11 · M-cotizador-s1 | s5b: C3 y s5a · W11: C3 (y s5b para probar de punta a punta) · s1: DB5 y s0 | no |
| 3 | M-cotizador-s2 · M-ordenes-s3 · M-cotizador-w1 (dos sesiones) · X4 | s2: s1 · ordenes-s3: s1 (los eventos ya están en el contrato) · w1: s2 · X4: todo | no |

Orden de integración dentro de la tanda 1: DB5, C3, s5a, s0 (`pnpm check` en `main` después de cada una). Si falta presupuesto se recorta el Cotizador, no la voz (plan §4.5).

## 1. Reglas comunes de la ola 4

**R19 · La captura solo propone.** `apps/api/src/core/captura/**` y `apps/api/src/modules/*/dictado/**` nunca ejecutan una herramienta ni escriben en tablas de negocio: el intérprete **lee** y devuelve propuestas; `captura_proponer` llama a `proponerBorrador`. Prohibido en esas carpetas: importar `EjecutorDeHerramientas`, llamar a `ejecutarDentro`, `emitir`, `.insert(`, `.update(` o `.delete(`. Una prueba (`core/captura/solo-propone.spec.ts`, la escribe C3) lee esos archivos y falla si aparece cualquiera de esas palabras. El dinero lo mueve la herramienta de siempre cuando una **persona** aprueba el borrador desde la pantalla (`borrador_aprobar`, que ya exige `canal: 'ui'`).

**R20 · Sin modelo de pago (fase A1).** Nadie instala `ai` ni ningún SDK de proveedor, nadie agrega una variable de entorno, nadie hace una llamada de red a un servicio de IA o de voz. El puerto `ModeloDeLenguaje` existe con una sola implementación, `ModeloNulo`. El reconocimiento de voz es el del navegador (Web Speech); el servidor nunca recibe audio.

**R21 · Porte fiel.** Lo que se trae de Cotizín o de Tairos.RC **se copia con `cp` y después se edita lo mínimo**; no se reescribe de memoria. Cambios permitidos: (a) las líneas `import` (rutas relativas terminadas en `.js`, sin el alias `@/`); (b) el nombre del archivo de prueba (`*.test.ts` → `*.spec.ts`); (c) los renombres de identificadores que diga la ficha, con `sed`; (d) arreglos de tipos que exija el compilador, **uno por uno y listados en el informe**. Prohibido: cambiar un literal esperado, borrar o saltar una prueba (`it.skip`), reformatear (`pnpm format`) o «mejorar» el código. Cada carril de porte pega en su informe la salida del comparador:

```bash
sin_imports() { perl -0pe "s/^import\b.*?from\s*['\"][^'\"]*['\"];?[ \t]*\n//msg" "$1"; }
comparar() { if diff <(sin_imports "$1" | sed -E "$R") <(sin_imports "$2") > /dev/null; then echo "IGUAL     $2"; else echo "DISTINTO  $2"; fi; }
# uso: R='<renombres de la ficha, o vacío>' comparar <archivo de origen> <archivo portado>
```

Todo archivo portado (código y pruebas) debe salir `IGUAL`, salvo los que el informe liste con cada línea tocada y su motivo. El integrador vuelve a correr el comparador al integrar. **Si para pasar una prueba hay que tocar un valor esperado, el carril para y pregunta.**

**R22 · Dinero del Cotizador (excepción escrita a la regla 9; ADR-017 §3).** Dentro de `apps/api/src/modules/cotizador/domain/motor/**` el dinero es **texto decimal** calculado con `big.js` (importes con 2 decimales, unitarios con 4, cantidades con 3), y la curva de precios usa `Math.log`/`Math.exp` en **un** archivo (`motor/escala/precio-por-escala.ts`). Fuera de `motor/` todo es céntimos y milésimas enteras. El **único** cruce es `domain/adaptador-de-dinero.ts`. Solo `domain/*.ts` importa de `domain/motor/`; herramientas y repositorios usan las fachadas de `domain/`. Solo `motor/base/dinero.ts` importa `big.js`. Lo vigila `domain/frontera-del-motor.spec.ts` (la escribe s0).

**R23 · Nombres reservados.** `canal`, `contexto`, `ctx`, `empresaId`, `usuarioId`, `permisos` (y sus variantes) no pueden ser argumentos de una herramienta: el registro no arranca y el ejecutor responde `argumento_prohibido` (`packages/shared/src/herramientas.ts`, `ARGUMENTOS_DE_CONTEXTO`). El medio de una captura se llama **`origen`**.

**R24 · Migraciones.** Solo DB5 escribe migraciones en esta ola y es **una**: `0024_cotizador`. Ni la captura ni la voz necesitan tabla nueva. Ningún código ni prueba nombra una migración por su número.

**R25 · Archivos compartidos.** `packages/shared/src/contratos/index.ts`, `apps/api/src/app.module.ts`, `apps/web/src/app/rutas.tsx`, `apps/web/src/app/carcasa/**`, `core/modulos/**`, `package.json` y las banderas `enConstruccion`/`porDefecto` son del integrador. C4 deja hecho lo que los carriles necesitan; lo demás es solicitud de cambio.

**R26 · Regla 12 y datos personales.** Cotizín y Tairos.RC son del dueño: su lógica, sus textos y sus pruebas se pueden portar. Nada se toma de Odoo ni de otro ERP. El texto dictado es dato personal: **no** va a registros (`logger`), ni a la auditoría, ni a eventos; vive solo en el borrador (`args`, `resumen`).

## 2. C4 · Paso previo (integrador)

Tamaño S. Lo hace el integrador en `main`, sin agente. Deja el cableado para que ningún carril toque archivos compartidos.

1. `packages/shared/src/contratos/captura.ts` nuevo con `export const contratosDeCaptura = {} as const;` y `export const eventosDeCaptura = {} as const;` (mismo encabezado de comentario que `contratos/cotizador.ts`).
2. `packages/shared/src/contratos/index.ts`: importar ambos, `export * from './captura.js';`, y extender `...contratosDeCaptura` en `CONTRATOS` y `...eventosDeCaptura` en `EVENTOS`.
3. `apps/api/src/core/captura/captura.module.ts`: `@Global() @Module({})` vacío, clase `CapturaModule`; importarlo en `app.module.ts` después de `BorradoresModule`.
4. `apps/api/src/modules/cotizador/cotizador.module.ts`: `@Module({})` vacío, clase `CotizadorModule`; importarlo en `app.module.ts` después de `OrdenesModule`. (El manifiesto ya está en `ModulosModule.con([...])`.)
5. `apps/web/src/core/captura/rutas.tsx` con `export const rutas: RouteObject[] = [];` y registrarlo en `apps/web/src/app/rutas.tsx` (import y `...captura` en `DE_AREAS`, junto a `bandeja`).
6. Comprobar, sin cambiar nada: `apps/api/package.json` tiene `"big.js": "7.0.1"` y `"@types/big.js": "7.0.0"` (ya están; commit `02693ae`); `ls apps/api/drizzle/*.sql | tail -1` es `0023_*`.

**Hecho cuando:** `pnpm check` en verde en `main` y el servidor arranca (los mapas de contratos nuevos están vacíos, así que el registro no reclama herramientas). **Parar si:** la última migración de `main` no es la `0023`.

## 3. C3 · Captura (núcleo)

Convierte un texto dictado o escrito en **borradores** de herramientas que ya existen, con origen `voz` o `texto`, y mide cuántos se aprueban sin corregir. No interpreta: delega en el intérprete que registre cada módulo.

- **Esfuerzo:** M · **Depende de:** C4 integrado · **Verificación:** VERIF-SERVIDOR.
- **Propiedad exclusiva:** `apps/api/src/core/captura/**` · `apps/api/src/core/borradores/**` · `packages/shared/src/contratos/captura.ts` · `packages/shared/src/contratos/borradores.ts` (**solo agregar**; no se cambia ningún esquema existente).
- **Lee:** esta sección y la §1 · `apps/api/src/core/borradores/{proponer,repositorio,herramientas-de-borradores,catalogo}.ts` · `core/herramientas/{tipos,http-de-pruebas}.ts` · `core/eventos/{registro-de-consumidores.ts,eventos.module.ts}` (modelo del registro global) · `core/empresas/hoy.ts` · `core/borradores/borradores.int.spec.ts` (modelo de prueba por HTTP) · `docs/COMO-CREAR-UN-MODULO.md` §4 y §5.

### 3.1 Contrato `captura.ts` (copiar tal cual)

```ts
import { z } from 'zod';
import { contrato } from '../herramientas.js';
import type { ORIGENES_DE_BORRADOR } from './borradores.js';

// Contratos del área «captura»: texto dictado o escrito → borradores. Solo el carril de esta área edita este archivo.

/** Por dónde entró el texto. Es también el `origen` del borrador (subconjunto de ORIGENES_DE_BORRADOR). */
export const ORIGENES_DE_CAPTURA = ['voz', 'texto'] as const satisfies readonly (typeof ORIGENES_DE_BORRADOR)[number][];
export type OrigenDeCaptura = (typeof ORIGENES_DE_CAPTURA)[number];
/** Módulos que tienen intérprete. Crece con cada intérprete nuevo. */
export const MODULOS_CON_DICTADO = ['registro'] as const;
/** El botón que tocó la persona antes de dictar; manda sobre lo que diga la frase. */
export const MODOS_DE_CAPTURA = ['ingreso', 'egreso'] as const;
export const INTERPRETES_DE_CAPTURA = ['reglas', 'modelo'] as const;
export const MAXIMO_DE_TEXTO_DE_CAPTURA = 500;
/** 15 minutos: lo más que puede pasar entre tocar el micrófono y enviar. */
export const MAXIMO_DE_ESPERA_DE_CAPTURA_MS = 900_000;
export const MAXIMO_DE_PROPUESTAS_POR_CAPTURA = 5;

export const capturaProponerSchema = z.strictObject({
  texto: z.string().trim().min(1, { error: 'Dicta o escribe algo.' }).max(MAXIMO_DE_TEXTO_DE_CAPTURA, { error: 'El texto es demasiado largo.' }),
  origen: z.enum(ORIGENES_DE_CAPTURA),
  /** Milisegundos entre que la persona tocó el micrófono (o empezó a escribir) y el envío. Lo mide el reloj del aparato. */
  transcurridoMs: z.number().int().min(0).max(MAXIMO_DE_ESPERA_DE_CAPTURA_MS),
  modulo: z.enum(MODULOS_CON_DICTADO).default('registro'),
  modo: z.enum(MODOS_DE_CAPTURA).optional(),
});

/** Un dato que el intérprete no pudo fijar solo: el campo, lo que se dictó y las opciones que encontró. */
export const sugerenciaDeCapturaSchema = z.strictObject({
  campo: z.string(),
  texto: z.string(),
  opciones: z.array(z.strictObject({ id: z.string(), nombre: z.string(), detalle: z.string().optional() })),
});
export type SugerenciaDeCaptura = z.infer<typeof sugerenciaDeCapturaSchema>;

export const propuestaDeCapturaSchema = z.strictObject({
  /** Id del borrador ya guardado en la bandeja. */
  id: z.string(),
  herramienta: z.string(),
  resumen: z.string(),
  args: z.unknown(),
  sugerencias: z.array(sugerenciaDeCapturaSchema),
});

export const capturaPropuestaSchema = z.strictObject({
  borradores: z.array(propuestaDeCapturaSchema),
  /** Lo que la persona debe completar o decidir, en palabras: «el monto», «si entró o salió». */
  faltan: z.array(z.string()),
  /** Ayuda para volver a dictar cuando no se entendió. */
  pista: z.string().nullable(),
  interpretadoCon: z.enum(INTERPRETES_DE_CAPTURA),
});
export type CapturaPropuesta = z.infer<typeof capturaPropuestaSchema>;

export const contratosDeCaptura = {
  captura_proponer: contrato(capturaProponerSchema, capturaPropuestaSchema),
} as const;
export const eventosDeCaptura = {} as const;
```

Por qué `transcurridoMs` y no una hora: el reloj del celular puede estar adelantado o atrasado; una duración no. El servidor guarda `capturaIniciadaEn = ahora − transcurridoMs` en la columna que ya existe (`core.borradores.captura_iniciada_en`).

### 3.2 Agregar a `contratos/borradores.ts`

```ts
export const MAXIMO_DE_DIAS_DE_METRICAS = 92;
/** Un borrador resuelto dentro de este plazo desde que empezó la captura cuenta como «en la misma sesión». */
export const SEGUNDOS_DE_MISMA_SESION = 600;

const diasEntre = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;

export const pedirMetricasDeBorradoresSchema = z
  .strictObject({
    desde: z.iso.date(),
    hasta: z.iso.date(),
    origen: z.enum(['voz', 'texto']).optional(),
    modulo: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => v.hasta >= v.desde, { error: 'La fecha final no puede ser anterior a la inicial.' })
  .refine((v) => v.hasta < v.desde || diasEntre(v.desde, v.hasta) <= MAXIMO_DE_DIAS_DE_METRICAS, { error: `Las métricas abarcan como máximo ${MAXIMO_DE_DIAS_DE_METRICAS} días.` });

export const metricasDeBorradoresSchema = z.strictObject({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  propuestos: z.number().int().nonnegative(),
  aprobadosSinCorregir: z.number().int().nonnegative(),
  aprobadosCorregidos: z.number().int().nonnegative(),
  descartados: z.number().int().nonnegative(),
  pendientes: z.number().int().nonnegative(),
  /** 0 a 100 con un decimal; `null` si todavía no hay ninguno resuelto. */
  pctSinCorregir: z.number().min(0).max(100).nullable(),
  /** Aprobados dentro de SEGUNDOS_DE_MISMA_SESION desde el inicio de la captura. */
  enLaMismaSesion: z.number().int().nonnegative(),
  /** Mediana, en segundos enteros, del inicio de la captura a la aprobación, solo de los de la misma sesión. */
  medianaSegundos: z.number().int().nonnegative().nullable(),
  /** Qué argumentos se corrigieron más (compara `args` con `argsOriginales`). */
  camposCorregidos: z.array(z.strictObject({ campo: z.string(), veces: z.number().int().positive() })),
});
export type MetricasDeBorradores = z.infer<typeof metricasDeBorradoresSchema>;
```

Y en `contratosDeBorradores`: `borradores_metricas: contrato(pedirMetricasDeBorradoresSchema, metricasDeBorradoresSchema),`.

### 3.3 Tipos del servidor (`core/captura/tipos.ts`)

```ts
export type PropuestaInterpretada = {
  herramienta: NombreDeHerramienta;
  /** Pueden venir incompletos: se validan al aprobar. */
  args: Record<string, unknown>;
  resumen: string;
  sugerencias?: SugerenciaDeCaptura[];
};
export type DictadoInterpretado = { propuestas: PropuestaInterpretada[]; faltan: string[]; pista: string | null };
export type EntradaDeInterprete = { texto: string; origen: OrigenDeCaptura; modo?: 'ingreso' | 'egreso'; /** Lo que extrajo el modelo; `null` en A1. */ extraccion: unknown | null };
export type InterpreteDeCaptura = {
  /** Código del módulo dueño de las herramientas que propone. */
  modulo: string;
  /** Solo lee (R19). `ctx` es el de la PERSONA que dicta, no el de sistema. */
  interpretar(tx: Transaccion, ctx: ContextoDeHerramienta, e: EntradaDeInterprete): Promise<DictadoInterpretado>;
  /** Solo A2. */
  esquemaParaModelo?: z.ZodType;
  instrucciones?: string;
};
```

`core/captura/modelo-de-lenguaje.ts`:

```ts
export interface ModeloDeLenguaje { extraer(esquema: z.ZodType, instrucciones: string, texto: string): Promise<unknown | null> }
export const MODELO_DE_LENGUAJE = Symbol('MODELO_DE_LENGUAJE');
/** A1: no hay modelo. Siempre `null`, sin red, sin configuración (R20). */
export class ModeloNulo implements ModeloDeLenguaje { async extraer(): Promise<null> { return null; } }
```

`core/captura/registro-de-interpretes.ts`: `@Injectable() class RegistroDeInterpretes` con `agregar(lista: readonly InterpreteDeCaptura[])` (lanza si ya hay uno de ese `modulo`), `para(modulo: string): InterpreteDeCaptura | undefined` y `fijar(i: InterpreteDeCaptura)` (reemplaza sin protestar; **solo para pruebas**, así las de C3 siguen pasando cuando s5b registre el intérprete real).

### 3.4 Pasos

1. Rellenar `contratos/captura.ts` (§3.1) y agregar lo de §3.2; `pnpm --filter @capaz/shared build`.
2. `tipos.ts`, `modelo-de-lenguaje.ts`, `registro-de-interpretes.ts` (§3.3), con sus pruebas unitarias.
3. `captura.module.ts`: sigue `@Global()`; `providers: [RegistroDeInterpretes, { provide: MODELO_DE_LENGUAJE, useClass: ModeloNulo }, HerramientasDeCaptura]`, `exports: [RegistroDeInterpretes]`.
4. `herramientas-de-captura.ts`: `crearHerramientasDeCaptura(interpretes: RegistroDeInterpretes, modelo: ModeloDeLenguaje): HerramientaRegistrada[]` y el proveedor `HerramientasDeCaptura` (inyecta `RegistroDeHerramientas`, `RegistroDeInterpretes` y `MODELO_DE_LENGUAJE`; en `onModuleInit` registra). Modelo: `core/borradores/herramientas-de-borradores.ts`.
5. La herramienta **`captura_proponer`**: `modulo: 'core'`, `permiso: 'borradores:ver'`, `criticidad: 'normal'`, `idempotente: true`, **sin** `mueveDinero`, con `ayuda` completa. Dentro de `ejecutar(args, ctx, tx)`, en este orden:
   1. `acceso = ctx.modulos.find((m) => m.codigo === args.modulo)`. Sin `acceso?.puedeEntrar` → `rechazo('modulo_no_disponible', …)`. Sin `acceso.puedeEscribir` → `rechazo('modulo_solo_lectura', …)`. (El núcleo está eximido de `puedeEscribir` en el ejecutor: por eso se comprueba aquí.)
   2. `interprete = interpretes.para(args.modulo)`; si no hay → `rechazo('no_encontrado', 'Todavía no se puede dictar para ese módulo.')`.
   3. `extraccion = interprete.esquemaParaModelo && interprete.instrucciones ? await modelo.extraer(interprete.esquemaParaModelo, interprete.instrucciones, args.texto) : null`. `interpretadoCon = extraccion === null ? 'reglas' : 'modelo'`.
   4. `r = await interprete.interpretar(tx, ctx, { texto: args.texto, origen: args.origen, modo: args.modo, extraccion })`.
   5. Si `r.propuestas.length > MAXIMO_DE_PROPUESTAS_POR_CAPTURA` → `throw` (error de programación). Por cada propuesta, `d = datosDeHerramienta(p.herramienta)` (`core/borradores/catalogo.ts`): si no existe o `d.modulo !== interprete.modulo` → `throw new Error(...)` (el ejecutor lo convierte en `error_interno` y revierte); si `d.permiso !== null && !ctx.permisos.includes(d.permiso)` → `rechazo('sin_permiso', 'No tienes permiso para registrar eso.')`. Es todo o nada.
   6. `capturaIniciadaEn = new Date(Date.now() - args.transcurridoMs)`.
   7. Por cada propuesta: `proponerBorrador(tx, { herramienta, args, resumen, origen: args.origen, propuestoPor: ctx.usuarioId, capturaIniciadaEn })`.
   8. `exito({ borradores: [{ id, herramienta, resumen, args, sugerencias: p.sugerencias ?? [] }], faltan: r.faltan, pista: r.pista, interpretadoCon })`.
   - `auditar`: `{ entidadTipo: 'borrador', entidadId: <id del primero, si hay>, resumen: { borradores: n, faltan: n, origen, interpretadoCon } }`. **Nunca** el texto (R26).
   - Cero propuestas es una respuesta **correcta** (`borradores: []` con `faltan` y `pista`): la llamada queda en la auditoría con `borradores: 0`.
6. `core/borradores/metricas.ts` (puro): `porcentajeSinCorregir({ sinCorregir, corregidos, descartados }): number | null` = `sinCorregir / (sinCorregir + corregidos + descartados) × 100` redondeado a un decimal; `null` con denominador 0. Los pendientes no cuentan.
7. `core/borradores/repositorio-de-metricas.ts`: una función `metricasDeBorradores(tx, { desde, hasta, zona, origenes, modulos })`:
   - universo: `origen = any(origenes)` (los dos de captura, o el pedido), `modulo = any(modulos)`, `(propuesto_en at time zone zona)::date between desde and hasta`;
   - conteos por `estado` y `corregido` con `count(*) filter (where …)`;
   - `enLaMismaSesion` y `medianaSegundos`: aprobados con `captura_iniciada_en is not null` y `resuelto_en - captura_iniciada_en <= SEGUNDOS_DE_MISMA_SESION`; mediana con `percentile_cont(0.5) within group (order by extract(epoch from resuelto_en - captura_iniciada_en))`, redondeada a entero;
   - `camposCorregidos`: sobre los aprobados con `corregido`, las claves de primer nivel donde `args -> clave is distinct from args_originales -> clave` (unión de las claves de ambos, con `jsonb_object_keys`), agrupadas y ordenadas por veces descendente y nombre; máximo 20.
8. La herramienta **`borradores_metricas`** en `herramientas-de-borradores.ts`: `modulo: 'core'`, `permiso: 'borradores:ver'`, `criticidad: 'lectura'`. `zona` = `(await hoyDeLaEmpresa(tx)).zona`. `modulos` = los de `ctx.modulos` con `puedeEntrar` (como `borradores_resumen`), cruzados con `args.modulo` si llega. Sin módulos, todo en cero y `null`.
9. `core/captura/solo-propone.spec.ts` (R19): con `node:fs`, recorre `src/core/captura/**` y `src/modules/*/dictado/**` (archivos `.ts` que no sean `.spec.ts`) y falla si alguno contiene `EjecutorDeHerramientas`, `ejecutarDentro`, `emitir(`, `.insert(`, `.update(` o `.delete(`. Excepción única, escrita en la prueba: `core/captura/herramientas-de-captura.ts` puede importar `proponerBorrador`.
10. `core/captura/interprete-de-prueba.ts`: un intérprete fijo para las pruebas (`modulo: 'registro'`; propone `movimiento_registrar { tipo: 'ingreso', montoCentimos: 50000, origen: 'voz' }` con resumen «Ingreso de S/ 500.00»; si el texto es «nada», no propone y devuelve `faltan: ['el monto']` y una pista; si es «ajena», propone `pedido_crear`).

### 3.5 Pruebas exigidas

Unitarias: registro de intérpretes (duplicado lanza; `fijar` reemplaza); `ModeloNulo` devuelve `null`; `porcentajeSinCorregir` (0/0 → `null`; 1 de 3 → 33.3; 7 de 10 → 70); `solo-propone`.

Por HTTP real (`core/captura/captura.int.spec.ts`; dos empresas; el intérprete de prueba se pone con `app.obtener(RegistroDeInterpretes).fijar(...)`):
1. el dueño dicta → un borrador con `origen: 'voz'`, `propuestoPor` = su id, `argsOriginales` igual a `args`, `corregido: false`, `capturaIniciadaEn` = ahora − `transcurridoMs` (± 5 s), y `borrador.propuesto` en `core.eventos_salida`;
2. `borrador_aprobar` de ese borrador crea el movimiento (aparece en `movimientos_listar`) y deja el borrador `aprobado` con `corregido: false`; **antes** de aprobar no hay ningún movimiento;
3. la misma `Idempotency-Key` dos veces → la misma respuesta y **un** borrador;
4. un `member` sin `registro` asignado (por ejemplo, con solo `crm`, tras `activarModulo(empresaId, 'crm')`) → `modulo_no_disponible` y ningún borrador;
5. un `member` con `registro` en `lectura` → `modulo_solo_lectura`; con el módulo dado de baja (`darDeBajaModulo`) → `modulo_solo_lectura`;
6. la otra empresa no ve el borrador (`borrador_ver` → `no_encontrado`; `borradores_listar` vacío);
7. `borrador_corregir` (cambia `montoCentimos`) + `borrador_aprobar` → `corregido: true`;
8. validación: `texto` vacío, `transcurridoMs: 900001` y un campo de más → `argumentos_invalidos`; `canal: 'voz'` como argumento → `argumento_prohibido`;
9. texto «nada» → `ok`, `borradores: []`, `faltan` y `pista` con contenido, cero filas nuevas en `core.borradores`;
10. texto «ajena» → `error_interno` y cero borradores.

`core/borradores/metricas.int.spec.ts`: con uno aprobado sin corregir, uno corregido y aprobado, uno descartado y uno pendiente (los cuatro de voz) → `propuestos 4`, `pctSinCorregir 33.3`, `camposCorregidos` contiene `montoCentimos`, `medianaSegundos` no nulo; un borrador de origen `modulo` no cuenta; un `member` sin `registro` recibe ceros; rango de 93 días → `argumentos_invalidos`; el corte de día usa la zona de la empresa.

**Hecho cuando:** las diez pruebas por HTTP pasan, `pnpm check` en verde, y el informe confirma que no se agregó ninguna dependencia, variable de entorno ni migración.

**Parar y preguntar si:** hace falta una columna o un índice en `core.borradores`; hace falta un permiso nuevo en `manifiesto-core.ts`; `proponerBorrador` necesita otro parámetro; aprobar un borrador de origen `voz` se comporta distinto de uno de origen `modulo`.

## 4. M-registro-s5a · Reglas de dictado

Trae a Capaz, **tal cual**, las reglas puras de Tairos.RC que leen una frase y sacan monto, tipo, contacto, descripción, categoría, abono y adelanto, con sus pruebas. Agrega tres reglas pequeñas que Tairos.RC no tiene. Todo es lógica pura: sin base, sin Nest, sin red.

- **Esfuerzo:** S–M · **Depende de:** nada · **Verificación:** VERIF-SERVIDOR.
- **Propiedad exclusiva:** `apps/api/src/modules/registro/dictado/**` (carpeta nueva).
- **Lee:** esta sección y la §1 (sobre todo R21) · los archivos de `SF/` de la tabla · `apps/api/src/modules/registro/domain/catalogos.ts` (los nombres de las categorías de Capaz).

### 4.1 Qué se copia y con qué nombre

Destino: `apps/api/src/modules/registro/dictado/reglas/`. La prueba va al lado, con el mismo nombre y `.spec.ts`.

| Origen en `SF/src/` | Destino en `reglas/` | Pruebas (`test(`) · `expect(` |
|---|---|---|
| `features/extract/lib/normalize-monto.ts` | `monto.ts` | 42 · 110 |
| `features/extract/lib/detect-abono.ts` | `abono.ts` | 7 · 16 |
| `features/extract/lib/detect-proforma.ts` | `proforma.ts` | 14 · 32 |
| `features/extract/lib/infer-categoria.ts` | `categoria.ts` | 27 · 85 |
| `features/extract/lib/infer-descripcion.ts` | `descripcion.ts` | 23 · 39 |
| `features/extract/lib/enrich-extraction.ts` | `enriquecer.ts` | 26 · 62 |
| `features/extract/lib/incomplete-input-hint.ts` | `pista.ts` | sin prueba en el origen |
| `features/extract/schemas/extraction-schema.ts` | `extraccion.ts` (solo `extractionSchema` y su tipo; `transaccionInputSchema` **no** se trae) | — |
| `shared/lib/numeros-en-palabras.ts` | `numeros-en-palabras.ts` | 5 · 15 |
| `shared/lib/vocabulario-imprenta.ts` | `vocabulario-imprenta.ts` | sin prueba propia |
| `shared/lib/similitud-nombres.ts` | `similitud-nombres.ts` | 32 · 56 |
| `shared/lib/categorias.ts` | `categorias-de-rubro.ts` (entero, también el campo `color`) | 7 · 23 |

Total: **183 pruebas y 438 `expect`**. El informe trae la cuenta por archivo (`grep -cE "^\s*(test|it)(\.each)?\("` y `grep -c "expect("` en origen y en destino): deben coincidir.

Renombres de identificadores exportados (regla 10), con `sed -E` y `\b` a ambos lados; son el valor de `R` del comparador de R21:

| De | A | | De | A |
|---|---|---|---|---|
| `normalizeMontoToCentimos` | `montoACentimos` | | `inferCategoria` | `inferirCategoria` |
| `extractAllMontosCentimos` | `todosLosMontosEnCentimos` | | `inferDescripcion` | `inferirDescripcion` |
| `extractNumeroSoles` | `numeroEnSoles` | | `cleanContactoNombre` | `limpiarNombreDeContacto` |
| `parseContratoConAdelanto` | `leerContratoConAdelanto` | | `formatContactoNombre` | `formatearNombreDeContacto` |
| `inferTipo` | `inferirTipo` | | `enrichExtraction` | `enriquecerExtraccion` |
| `inferContacto` | `inferirContacto` | | `hintForIncompleteInput` | `pistaDeDictadoIncompleto` |
| `centimosToDisplay` | `centimosComoTexto` | | `extractionSchema` | `extraccionSchema` |
| `extractAbonoContacto` | `contactoDeAbono` | | `ExtractionResult` | `Extraccion` |
| `extractProformaContacto` | `contactoDeProforma` | | | |

No se renombra nada más: ni identificadores internos, ni las claves de `Extraccion` (`monto_centimos`, `contacto_nombre`, `es_abono`…, que siguen en `snake_case` porque son el formato de la extracción y las pruebas las leen así), ni los textos de las pistas. Única edición de texto permitida: en `pista.ts` y en cualquier mensaje, quitar menciones al dominio de Tairos.RC si aparecen (no deberían: el aviso de HTTPS está en el hook, que es de W11).

### 4.2 Casos de referencia (ya están en las pruebas copiadas; **no cambian**)

Tomados del código real de Tairos.RC. Sirven al integrador para abrir dos al azar.

| Frase | Función | Esperado | Origen |
|---|---|---|---|
| «Ingreso 500 soles, cliente Juan, flyers» | `montoACentimos` | `50000` | `normalize-monto.test.ts:25` |
| «egreso 45.50 tinta negra» / «egreso 45,50 tinta negra» | `montoACentimos` | `4550` | `:31-32` |
| «ingreso de mil quinientos soles» | `montoACentimos` | `150000` | `:46` |
| «me salieron trescientos cincuenta soles» | `montoACentimos` | `35000` | `:47` |
| «ciento veinte soles de tinta» | `montoACentimos` | `12000` | `:49` |
| «un millar de volantes» / «una cartulina» | `montoACentimos` | `null` (un número que cuenta cosas no es plata) | `:54-55` |
| «un millón de soles» | `montoEnPalabrasSoles` | `1000000` | `numeros-en-palabras.test.ts:16` |
| «Contrato 240, adelanto 100» | `todosLosMontosEnCentimos` | `[24000, 10000]` | `normalize-monto.test.ts:66` |
| «Contrato 240, adelanto 100, cliente Cristina» | `leerContratoConAdelanto` | `{ monto_centimos: 24000, adelanto_centimos: 10000 }` | `:140-143` |
| «cliente Neira contrato total 800 adelanto 300» | `leerContratoConAdelanto` | `80000` y `30000` | `:147-150` |
| «contrato 100 adelanto 100» | `leerContratoConAdelanto` | adelanto `null` (nunca iguala ni supera el total) | `:154-155` |
| «me pagó la señora Rosa 80 soles» | `inferirTipo` | `'ingreso'` (el pronombre invierte el verbo) | `:105` |
| «le pagué 350 a Pacheco» | `inferirTipo` | `'egreso'` | `:107` |
| «compré cartulina por 350 soles» | `inferirTipo` | `'egreso'` (con tilde) | `:92` |
| «anótame que gasté en tinta 120 soles» | `inferirTipo` | `'egreso'` («anota» no es sentido del dinero) | `:132` |
| «350 de cartulina» / «Cristina 240» | `inferirTipo` | `null` (no adivina) | `:125-126` |
| «me salieron 350 de cartulina» | `inferirTipo` | `null` | `:279` |
| «le compré a Pacheco unas cartulinas 350 soles» | `inferirContacto` | `'Pacheco'` | `:201` |
| «Cristina me quedó debiendo 240» | `inferirContacto` | `'Cristina'` | `:203` |
| «Egreso 350 soles, proveedor Comercial Pacheco, cartulina folcote» | `inferirContacto` | `'Comercial Pacheco'` | `:226-228` |
| «contrato de 240 soles de un millar de tarjetas del cliente juanito y adelanto 20 soles» | `inferirContacto` | `'juanito'` | `:254-256` |
| «pagué 200 de luz» / «me pagaron 500» | `inferirContacto` | `null` (no inventa personas) | `:215`, `:331` |
| «Juan abona 100 soles de su deuda» | `esAbonoDeuda` · `contactoDeAbono` | `true` · `'Juan'` | `detect-abono.test.ts:12,34` |
| «me dio 80 de lo que me debe» | `esAbonoDeuda` | `true` | `:15` |
| «Contrato 240, adelanto 100, cliente Cristina» | `esAbonoDeuda` | `false` (un registro nuevo con adelanto no es un abono) | `:21` |
| «compré cartulina 350 soles a Pacheco», `egreso` | `inferirCategoria` | `'materia_prima'` | `infer-categoria.test.ts:16` |
| «pagué el recibo de luz 180 soles», `egreso` | `inferirCategoria` | `'servicios'` | `:56` |
| «alquiler de máquina 800 soles» / «alquiler 800 soles» | `inferirCategoria` | `'maquinaria'` / `'local'` | `:124-125` |
| «plastificado de 500 volantes», `egreso` / `ingreso` | `inferirCategoria` | `'acabados_terceros'` / `'acabados'` | `:158-159` |
| «Egreso 180 soles, recibo de luz» | `inferirDescripcion` | `'Recibo de luz'` | `infer-descripcion.test.ts:29` |
| «Ingreso 500 soles, cliente Juan» | `inferirDescripcion` | `null` | `:65` |
| «CRISTHIAN NEYRA» frente a «Cristian Neira» | `similitud` | `1` | `similitud-nombres.test.ts:156` |
| «Thania» / «Tania» · «Balverde» / «Valverde» | `esProbableMismaPersona` | `true` | `:98`, `:103` |
| «sabes que anótame que le compré a Pacheco unas cartulinas y me salieron 350 soles» | `enriquecerExtraccion` (sin modelo) | `tipo 'egreso'`, `35000`, `'Pacheco'`, `'materia_prima'` | `enrich-extraction.test.ts:169-173` |
| «oye regístrame que Cristina me quedó debiendo, le hice unas tarjetas de 240 y me adelantó 100» | `enriquecerExtraccion` | `'ingreso'`, `24000`, adelanto `10000`, `'Cristina'` | `:192-196` |
| «Egreso 500, me pagaron» con el botón `egreso` | `enriquecerExtraccion` | `tipo 'egreso'` (el botón manda) | `:216` |
| «Hazle una proforma a Juan por 500 tarjetas a 180 soles» | `esProforma` | `true` | `detect-proforma.test.ts:11` |

### 4.3 Reglas nuevas (no existen en Tairos.RC; archivos nuevos en `dictado/`, con su prueba)

**a) `dictado/categoria-de-capaz.ts`** · `categoriaDeCapaz(rubro: Categoria): string`. Las 16 categorías del rubro caen en las 8 por defecto de Capaz. «Cobros» y «Pagos» no se usan aquí: son de los abonos.

| Categoría del rubro (Tairos.RC) | Categoría de Capaz |
|---|---|
| `materia_prima`, `insumos`, `acabados_terceros`, `maquinaria` | «Compras» |
| `mano_obra` | «Sueldos» |
| `servicios`, `local` | «Servicios» |
| `transporte`, `impuestos`, `otros_egresos` | «Otros egresos» |
| `impresion_offset`, `impresion_digital`, `gran_formato`, `acabados`, `diseno` | «Ventas» |
| `otros_ingresos` | «Otros ingresos» |

Prueba: las 16 tienen destino, y el destino es de las de `CATEGORIAS_POR_DEFECTO` (`domain/catalogos.ts`) con el mismo tipo.

**b) `dictado/fecha.ts`** · `fechaDictada(texto: string, hoy: string): string | null`. Solo retrocede; no entiende días de la semana ni fechas con número. Compara sin tildes ni mayúsculas y por palabra completa (el `\b` de JavaScript no sirve con tildes: usar límites con `(?<![\p{L}])` y `(?![\p{L}])`).

| Frase (con `hoy = '2026-03-10'`) | Esperado |
|---|---|
| «ayer pagué la luz 180 soles» | `'2026-03-09'` |
| «anteayer le compré a Pacheco 350» · «antes de ayer…» · «antier…» | `'2026-03-08'` |
| «hoy cobré 300 a Cristina» · «cobré 300 a Cristina» | `null` (la herramienta pone hoy) |
| «mañana pago la luz» | `null` (no se anota una fecha futura) |
| «le pagué a Bayer 200» | `null` («ayer» dentro de otra palabra no cuenta) |
| «ayer» con `hoy = '2026-03-01'` | `'2026-02-28'` (cruza el mes, sin `Date` local: aritmética en UTC) |

**c) `dictado/deuda.ts`** · `tipoDeDeudaDictada(texto: string): 'por_cobrar' | 'por_pagar' | null`. Se evalúa **después** de `esAbonoDeuda` (si es abono, no es deuda nueva).

| Frase | Esperado |
|---|---|
| «Juan me debe 350 por un banner» · «Cristina me quedó debiendo 240» · «le fié 120 a Rosa» · «me quedan debiendo 500» | `'por_cobrar'` |
| «le debo a Pacheco 500 de papel» · «quedé debiendo 200 en la distribuidora» · «me fiaron 300 de tinta» · «debo 150 al técnico» | `'por_pagar'` |
| «Ingreso 500 soles, cliente Juan, flyers» · «pagué la luz 180» | `null` |
| «me dio 80 de lo que me debe» | la función devuelve `'por_cobrar'`, pero `interpretarDictado` no la llama porque es abono |

**d) `dictado/interpretar-dictado.ts`** · la única puerta que usará s5b:

```ts
export type IntencionDeDictado = 'movimiento' | 'abono' | 'deuda' | 'deuda_con_adelanto' | 'fuera_de_alcance' | 'incompleto';
export type Dictado = {
  intencion: IntencionDeDictado;
  tipo: 'ingreso' | 'egreso' | null;
  montoCentimos: number | null;
  adelantoCentimos: number | null;
  /** Como se dictó, ya con mayúsculas de nombre (formatearNombreDeContacto). */
  contactoNombre: string | null;
  descripcion: string | null;
  categoriaDeRubro: Categoria | null;
  /** Nombre de una de las 8 categorías por defecto de Capaz, o null. */
  categoriaDeCapaz: string | null;
  tipoDeDeuda: 'por_cobrar' | 'por_pagar' | null;
  /** AAAA-MM-DD solo si se dictó «ayer» o «anteayer». */
  fecha: string | null;
  faltan: string[];
  pista: string | null;
};
export function interpretarDictado(texto: string, opciones: { modo?: 'ingreso' | 'egreso'; hoy: string; extraccion?: Extraccion | null }): Dictado;
```

Orden fijo dentro de `interpretarDictado` (`e` = `enriquecerExtraccion(texto, opciones.extraccion ?? VACIA, { modo })`, con `VACIA` = todos los campos en `null` y las tres banderas en `false`):
1. `e.es_proforma` → `fuera_de_alcance`, `pista: 'Las proformas y cotizaciones no se dictan aquí: hazlas en Pedidos.'`.
2. `e.monto_centimos === null` → `incompleto`, `faltan: ['el monto']`, `pista: pistaDeDictadoIncompleto(texto)`.
3. `e.es_abono` → `abono`; `tipoDeDeuda` = `'por_pagar'` si `(modo ?? inferirTipo(texto)) === 'egreso'`, si no `'por_cobrar'`; `tipo` = `'egreso'` o `'ingreso'` en consecuencia.
4. `e.adelanto_centimos !== null` → `deuda_con_adelanto`; `tipoDeDeuda` = `'por_pagar'` si `e.tipo === 'egreso'`, si no `'por_cobrar'`.
5. `tipoDeDeudaDictada(texto) !== null` → `deuda` con ese tipo.
6. `e.tipo === null` → `incompleto`, `faltan: ['si entró o salió']`, `pista: 'Toca «Ingreso» o «Egreso» y vuelve a enviar.'`.
7. En cualquier otro caso → `movimiento`.

En todos: `contactoNombre`, `descripcion` y `categoriaDeRubro` salen de `e`; `categoriaDeCapaz` de la tabla (a); `fecha` de (b); una fecha solo se entrega en `movimiento` y `abono`.

Casos de `interpretar-dictado.spec.ts` (mínimo estos doce; `hoy = '2026-03-10'`):

| Frase · modo | `intencion` y datos |
|---|---|
| «Ingreso 500 soles, cliente Juan, flyers» | `movimiento`, `ingreso`, `50000`, `'Juan'`, categoría de Capaz «Ventas» o `null` según `inferirCategoria` (anotar cuál sale; no forzar) |
| «le compré a Pacheco unas cartulinas y me salieron 350 soles» | `movimiento`, `egreso`, `35000`, `'Pacheco'`, «Compras» |
| «pagué el recibo de luz 180 soles ayer» | `movimiento`, `egreso`, `18000`, «Servicios», `fecha '2026-03-09'` |
| «Juan abona 100 soles de su deuda» | `abono`, `por_cobrar`, `10000`, `'Juan'` |
| «Contrato 240, adelanto 100, cliente Cristina» | `deuda_con_adelanto`, `por_cobrar`, `24000`, `10000`, `'Cristina'` |
| «contrato 100 adelanto 100» | **no** es `deuda_con_adelanto` (el adelanto queda `null`) |
| «Cristina me quedó debiendo 240» | `deuda`, `por_cobrar`, `24000`, `'Cristina'` |
| «le debo a Pacheco 500 de papel» | `deuda`, `por_pagar`, `50000` (el contacto: anotar lo que devuelva `inferirContacto`, sin tocar la regla portada) |
| «350 de cartulina» sin modo | `incompleto`, `faltan: ['si entró o salió']` |
| «350 de cartulina» con modo `egreso` | `movimiento`, `egreso`, `35000` |
| «hola que tal» | `incompleto`, `faltan: ['el monto']`, con pista |
| «Hazle una proforma a Juan por 500 tarjetas a 180 soles» | `fuera_de_alcance` |

**e) `dictado/pureza.spec.ts`:** todo archivo de `dictado/` que no sea prueba importa solo rutas relativas dentro de `dictado/` y `zod`. (s5b la relajará para `interprete.ts`.)

### 4.4 Pasos

1. `cp` de los doce archivos y de sus nueve pruebas a `reglas/`, con los nombres de la tabla.
2. Aplicar los renombres con `sed -E -i` a todos los archivos de `reglas/`.
3. Corregir las líneas `import` (relativas, con `.js`). No importar nada de fuera de `reglas/`.
4. `npx vitest run src/modules/registro/dictado` hasta que las 183 pasen **sin tocar un esperado**.
5. Correr el comparador de R21 sobre los 21 archivos y pegar la salida.
6. Escribir las reglas nuevas (a) a (e) con sus pruebas; cinco casos para `pista.ts` (uno por cada rama del origen).
7. VERIF-SERVIDOR.

**Hecho cuando:** 183 pruebas portadas en verde con el comparador en `IGUAL` (o cada excepción listada), más las pruebas nuevas; el informe trae la tabla «frase → resultado» de los doce casos de (d) con lo que **de verdad** devolvió cada uno.

**Parar y preguntar si:** una prueba portada solo pasa cambiando un esperado; una regla portada importa algo de Next, Supabase o del AI SDK; un caso de (d) da un `tipo` de dinero distinto del de la tabla (ingreso por egreso o al revés).

## 5. M-cotizador-s0 · Motor

Copia el motor de cálculo de Cotizín, con sus pruebas, a `modules/cotizador/domain/motor/`, y escribe el **único** adaptador entre ese motor (texto decimal) y el resto de Capaz (céntimos y milésimas enteras). No registra herramientas ni toca la base.

- **Esfuerzo:** M · **Depende de:** `big.js@7.0.1` y `@types/big.js@7.0.0` en `apps/api` (**ya instalados**; no instales nada) · **Verificación:** VERIF-SERVIDOR.
- **Propiedad exclusiva:** `apps/api/src/modules/cotizador/domain/**`.
- **Lee:** esta sección y la §1 (R21 y R22) · los archivos de `COT/src/` de la tabla · `packages/shared/src/dinero.ts`.

### 5.1 Qué se copia (archivos enteros, sin recortar)

Destino: `apps/api/src/modules/cotizador/domain/motor/`. Sin renombres de identificadores (`R=''`): los nombres de Cotizín ya están en español.

| Origen en `COT/src/` | Destino en `motor/` | Pruebas (`it(` o `it.each(`) |
|---|---|---|
| `shared/utils/dinero.ts` | `base/dinero.ts` | 22 |
| `shared/utils/esquemas-decimales.ts` | `base/esquemas-decimales.ts` | 10 |
| `shared/utils/impuesto.ts`, `shared/utils/texto.ts` | `base/impuesto.ts`, `base/texto.ts` | — |
| `shared/types/{resultado,dominio,medidas}.ts` | `base/{resultado,dominio,medidas}.ts` | — |
| `shared/types/empresa.ts` | `base/empresa.ts` | 6 |
| `shared/constants/cantidades-de-referencia.ts` | `base/cantidades-de-referencia.ts` | 5 |
| `shared/constants/factores.ts` | `base/factores.ts` | — |
| `lib/semillas/es-PE.ts` | `base/semilla-es-pe.ts` | 7 |
| `features/cotizacion/services/calcular-cotizacion.ts` | `costeo/calcular-cotizacion.ts` | 24 |
| `features/cotizacion/services/semaforo.ts` | `costeo/semaforo.ts` | 5 |
| `features/cotizacion/services/imposicion.ts` | `costeo/imposicion.ts` | 31 |
| `features/cotizacion/services/mermas.ts` | `costeo/mermas.ts` | 15 |
| `features/cotizacion/services/cuadro.ts` | `costeo/cuadro.ts` | 28 |
| `features/cotizacion/services/cuadro-directo.ts` | `costeo/cuadro-directo.ts` | 23 |
| `features/cotizacion/services/escalar-cuadro.ts` | `costeo/escalar-cuadro.ts` | 17 |
| `features/cotizacion/services/generar-referencias.ts` | `costeo/generar-referencias.ts` | 11 |
| `features/cotizacion/types/cotizacion.ts` | `costeo/tipos/cotizacion.ts` | 13 |
| `features/cotizacion/types/imposicion.ts` | `costeo/tipos/imposicion.ts` | 9 |
| `features/cotizacion/types/{cuadro-directo,escalado,borrador}.ts` | `costeo/tipos/` | — |
| `features/cotizacion/constants/{deduccion,factores,plantillas}.ts` | `costeo/constantes/` | — |
| `features/cotizacion/testing/{caso-de-referencia,caso-base,vectores-de-escalado}.ts` | `costeo/pruebas/` | — |
| `features/precio-por-escala/services/precio-por-escala.ts` | `escala/precio-por-escala.ts` | 22 |
| `features/precio-por-escala/services/precio-rapido.ts` | `escala/precio-rapido.ts` | 14 |
| `features/precio-por-escala/services/validar-referencias.ts` | `escala/validar-referencias.ts` | 14 |
| `features/precio-por-escala/services/ajuste-en-bloque.ts` | `escala/ajuste-en-bloque.ts` | 3 |
| `features/precio-por-escala/types/precio-por-escala.ts` | `escala/tipos/precio-por-escala.ts` | 5 |
| `features/precio-por-escala/testing/vectores-de-curva.ts` | `escala/pruebas/vectores-de-curva.ts` | — |

Son 36 archivos de código y 20 de pruebas, con **284 declaraciones de prueba**. La cuenta por archivo debe coincidir con el origen (`grep -cE "^\s*(it|test)(\.each)?\("`). El cierre de importaciones está comprobado: estos archivos solo se importan entre sí, a `zod` y a `big.js`. **No se copian:** `datos-de-version.ts`, `types/{pantalla,recibo}.ts`, `types/salidas.ts`, `testing/{armar-caso-de-referencia,contrato-*,entorno-de-herramientas,versiones}.ts`, ni nada de `herramientas/`, `components/`, `hooks/`, `shared/db/` o `shared/utils/{numero,moneda,respuesta,antiguedad,…}.ts`.

### 5.2 Casos de referencia (ya están en las pruebas copiadas; valores exactos de Cotizín)

| # | Entrada | Esperado | Dónde queda en Capaz |
|---|---|---|---|
| C1 | 2.500 volantes A5 (14.8 × 21) 4/4; madre 70 × 100, máquina 35 × 50; sangrado y calle 0.3; pinza 2; tiraje 3 % + 40 hojas | 4 poses; 625 netos → 645 → 685 pliegos de máquina; **172 pliegos madre** | `costeo/cuadro.spec.ts` («172 pliegos madre en el caso de referencia») · `costeo/mermas.spec.ts` |
| C2 | Las seis filas de C1 (172 × 0.45; 8 × 5.00; 0.8 × 30.00; 40.00; 28.00; 15.75) | Subtotales `77.40 / 40.00 / 24.00 / 40.00 / 28.00 / 15.75`; **costo `225.15`** | `costeo/calcular-cotizacion.spec.ts` |
| C3 | C2 con 35 % sobre la venta | **precio `346.38`**, utilidad `121.23`, unitario `0.1386`, margen `35.00`, verde | `calcular-cotizacion.spec.ts` · `cuadro.spec.ts` |
| C4 | C2 con recargo de 35 % sobre el costo | `303.95`, utilidad `78.80`, margen `25.93`, ámbar (con umbrales 20/10: verde) | los mismos |
| C5 | El cuadro de C1 a 100, 1.000 y 5.000 | **`144.86 / 220.34 / 555.83`** | `cuadro.spec.ts` |
| C6 | C1 escalado a 1.000 | 75 pliegos madre (no 172), papel `33.75`; fila por pliego `0.348` (= 0.8 × 298 / 685) | `escalar-cuadro.spec.ts` |
| C7 | Lista `190 / 580 / 1200`, curva | 100 → `190.00` · 200 → `265.86` · 500 → `414.50` · 800 → `520.54` · 1.000 → `580.00` · 1.500 → `696.59` · **2.500 → `877.39`** · 3.000 → `952.72` · 5.000 → `1200.00` | `escala/precio-por-escala.spec.ts` |
| C8 | La misma lista en escalón, 2.500 | **`1450.00`** (unitario `0.5800`) | el mismo |
| C9 | Mínimo 250 y 100 unidades | **`250.00`**, `minimoAplicado: true` | el mismo |
| C10 | Referencias `190 / 150 / 400` | bloqueo `total_no_crece` | `escala/validar-referencias.spec.ts` |
| C11 | `793.26` con redondeo 1, 5 y 10 | `794.00 / 795.00 / 800.00`; `994.37` a 5 → `995.00` | `escala/precio-rapido.spec.ts` |
| C13 | Adaptador | ver §5.3 | `domain/adaptador-de-dinero.spec.ts` (nueva) |

(C12, el caso armado solo con herramientas, es del corte B2.)

**Cómo se garantiza «sin cambiar ningún esperado»:** (1) se copia con `cp`, no se reescribe; (2) el comparador de R21 debe dar `IGUAL` en los 56 archivos, y cualquier línea tocada fuera de los `import` va listada; (3) la cuenta de pruebas por archivo coincide con el origen; (4) el informe pega estas seis comprobaciones, que deben dar **al menos una línea** cada una (en el origen dan 1, 4, 1, 1, 2 y 1):

```bash
cd apps/api/src/modules/cotizador/domain/motor
grep -n "toBe('225.15')" costeo/calcular-cotizacion.spec.ts
grep -n "toBe('346.38')" costeo/calcular-cotizacion.spec.ts
grep -n "pliegosMadre: '172'" costeo/cuadro.spec.ts
grep -n "'144.86', '220.34', '555.83'" costeo/cuadro.spec.ts
grep -n "'877.39'" escala/precio-por-escala.spec.ts
grep -n "toBe('1450.00')" escala/precio-por-escala.spec.ts
```

(5) el integrador repite (2) y (4) al integrar.

### 5.3 Adaptador único · `domain/adaptador-de-dinero.ts` (nuevo)

Único archivo que convierte entre el texto decimal del motor y los enteros de Capaz. No redondea en silencio: si el motor entrega más decimales de los previstos, lanza.

```ts
/** '346.38' → 34638. Acepta signo y hasta 2 decimales; con más decimales, exponente o texto que no es número lanza RangeError. */
export function importeACentimos(importe: string): number;
/** 34638 → '346.38'. Siempre 2 decimales. Exige entero seguro. */
export function centimosAImporte(centimos: number): string;
/** '2500' → 2500000; '0.8' → 800. Hasta 3 decimales; con más, lanza. */
export function cantidadAMilesimas(cantidad: string): number;
/** 2500000 → '2500'; 800 → '0.8' (sin ceros de relleno). */
export function milesimasACantidad(milesimas: number): string;
/** Unitario informativo del motor (4 decimales) a milésimas de sol, mitad hacia arriba: '0.1386' → 139; '0.3510' → 351. */
export function unitarioAMilesimas(unitario: string): number;
/** Porcentaje guardado como numeric ('35.000') al texto que espera el motor ('35'). */
export function porcentajeDeBase(valor: string): string;
```

Se implementa con las funciones de `motor/base/dinero.ts` (`decimal`, `multiplicar`, `redondear`, `aTexto`); **ningún** `parseFloat`, `Number('346.38')` ni multiplicación de un `number` con decimales. El paso final a `number` es `Number(textoEntero)` con `Number.isSafeInteger`.

Casos de `adaptador-de-dinero.spec.ts` (C13): `'346.38'` → `34638`; `'225.15'` → `22515`; `'1200.00'` → `120000`; `'190'` → `19000`; `'-12.5'` → `-1250`; `'0.07'` → `7`; `'346.385'`, `'1e3'`, `''`, `'abc'` → `RangeError`; ida y vuelta `centimosAImporte(importeACentimos(x)) === aTexto(x, 2)` para los nueve totales de C7; `cantidadAMilesimas('2500')` → `2500000`; `cantidadAMilesimas('0.348')` → `348`; `cantidadAMilesimas('0.3485')` → `RangeError`; `unitarioAMilesimas('0.1386')` → `139`; `unitarioAMilesimas('0.5800')` → `580`; `porcentajeDeBase('35.000')` → `'35'`; `centimosAImporte(0.5)` → `RangeError`.

### 5.4 `domain/frontera-del-motor.spec.ts` (nueva; vigila R22 para siempre)

Con `node:fs`, sobre `apps/api/src`:
1. el único archivo que importa `big.js` es `modules/cotizador/domain/motor/base/dinero.ts`;
2. fuera de `modules/cotizador/domain/` nadie importa una ruta que contenga `/domain/motor/`;
3. dentro de `modules/cotizador/domain/motor/` nadie importa de fuera de `motor/` salvo `zod` y `big.js`;
4. `Math.log` y `Math.exp` aparecen solo en `motor/escala/precio-por-escala.ts`.

### 5.5 Pasos

1. Antes de copiar: leer `apps/api/node_modules/big.js/package.json` y `node_modules/@types/big.js/index.d.ts` y confirmar con un archivo de una línea que `import Big from 'big.js'` compila con `module: nodenext` (`pnpm --filter api typecheck`). Si no compila, **parar**.
2. `cp` de los 56 archivos a sus destinos; renombrar `*.test.ts` → `*.spec.ts`; `es-PE.ts` → `semilla-es-pe.ts`.
3. Corregir los `import`: el alias `@/…` pasa a ruta relativa dentro de `motor/`, con `.js`.
4. `npx vitest run src/modules/cotizador` hasta el verde, sin tocar un esperado.
5. Comparador de R21 (`R=''`) sobre los 56 archivos; cuentas por archivo; las seis comprobaciones de §5.2.
6. `adaptador-de-dinero.ts` con su prueba; `frontera-del-motor.spec.ts`.
7. VERIF-SERVIDOR (incluye `lint` y la prueba de arquitectura: ningún archivo pasa de 500 líneas; el mayor del origen tiene 377).

**Hecho cuando:** las 284 pruebas copiadas pasan con el comparador en `IGUAL`, C13 y la frontera pasan, y el informe pega las seis líneas de §5.2.

**Parar y preguntar si:** una prueba copiada falla y solo pasa cambiando un esperado o un redondeo; `oxlint` exige reescribir código del motor (no lo reescribas: reporta la regla); hace falta un archivo de Cotizín que no está en la tabla; `big.js` no compila o no está instalado.

## 6. DB5 · Datos del Cotizador (`0024_cotizador`)

Único carril que escribe migraciones en la ola. Transcribe; no diseña. Solo las tablas del corte **B1** (las del cuadro por partes —tarifas, formatos, máquinas, ítems— y el enlace público **no** entran: D-I2 y D-I10).

- **Esfuerzo:** M · **Depende de:** ronda 3 integrada (la última migración de `main` es la `0023`) · **Verificación:** VERIF-DATOS · **Neon:** sí; el integrador avisa a la sesión de Neon al integrar.
- **Propiedad exclusiva:** `apps/api/drizzle/**` · `apps/api/drizzle.config.ts` · `apps/api/src/db/esquema/**` · `apps/api/src/infra/database/{aislamiento.int.spec.ts,aislamiento-ejemplos.ts,catalogo.int.spec.ts,contratacion.int.spec.ts}` · `apps/api/src/infra/database/cotizador-datos.int.spec.ts` (nuevo).
- **Lee:** esta sección y la §1 · `docs/MODULOS-Y-MERCADO.md` §8 · `apps/api/drizzle/0020_compras.sql` y `src/db/esquema/compras.ts` (modelo más reciente) · `drizzle/0014_registro.sql` (cómo se quita `CREATE SCHEMA`) · las tres pruebas y `aislamiento-ejemplos.ts`.

**Lo que ya existe (comprobado; no lo repitas):** el esquema `cotizador` y `grant usage … to capaz_app` (`0000_cimientos.sql`); `'cotizador'` en `schemaFilter` de `drizzle.config.ts` y en las listas de esquemas de `catalogo.int.spec.ts`, `aislamiento.int.spec.ts` y `contratacion.int.spec.ts`; `core.exigir_modulo_en_escritura()`, `core.rechazar_cambio()`, `core.tocar_actualizado_en()`; los `unique (tenant_id, id)` de `core.clientes` y `core.productos`; el `revoke execute … from public` por defecto para las funciones que crea `capaz_owner`.

Convenciones: archivo `src/db/esquema/cotizador.ts` con `export const cotizador = pgSchema('cotizador')`, exportado en `index.ts`; constantes con prefijo `cotizador…` (R16). Salvo que se diga otra cosa, cada tabla lleva `id uuid primary key default uuidv7()`, `tenant_id text not null` y `creado_en timestamptz not null default now()`; `actualizado_en` es `timestamptz not null default now()` con el disparador `core.tocar_actualizado_en`. «→» es llave foránea **compuesta** `(tenant_id, x)` → `(tenant_id, id)`. `bigint` con `{ mode: 'number' }`; `date` con `{ mode: 'string' }`; `numeric` devuelve texto (es lo que quiere el motor). **`capaz_sistema` no recibe nada:** `PERMITIDO` y `PERMITIDO_POR_COLUMNA` no cambian.

### 6.1 Tablas

**`cotizador.configuracion`** (`cotizadorConfiguracion`) · una fila por empresa · modo `completo` · `EJEMPLOS`: `completo`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `tenant_id` | text | no | | **clave primaria** (esta tabla no lleva `id`) |
| `utilidad_pct` | numeric(7,3) | no | `35` | `CHECK >= 0` |
| `utilidad_base` | text | no | `'venta'` | `CHECK in ('venta','costo')` |
| `umbral_verde_pct` | numeric(7,3) | no | `30` | |
| `umbral_minimo_pct` | numeric(7,3) | no | `15` | `CHECK >= 0` |
| `redondeo_comercial` | text | no | `'ninguno'` | `CHECK in ('ninguno','1','5','10')` |
| `igv_porcentaje` | smallint | no | `18` | `CHECK between 0 and 100` |
| `condiciones` | jsonb | no | `'{}'` | |
| `mensaje_whatsapp` | text | sí | | |
| `actualizado_por` | text | sí | | |
| `creado_en`, `actualizado_en` | | | | disparador |

`CHECK configuracion_umbrales`: `umbral_minimo_pct < umbral_verde_pct` · `CHECK configuracion_utilidad`: `utilidad_base = 'costo' or utilidad_pct < 100`. Sin más índices.

**`cotizador.listas_de_precio`** (`cotizadorListasDePrecio`) · modo `completo`. Los precios son **totales del lote, sin IGV**, a 100, 1.000 y 5.000 unidades.

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `producto_id` | uuid | sí | | → `core.productos` |
| `nombre` | text | no | | |
| `nombre_normalizado` | text | no | | |
| `unidad` | text | no | `'unidad'` | |
| `p100_centimos` | bigint | no | | `CHECK > 0` |
| `p1000_centimos` | bigint | no | | |
| `p5000_centimos` | bigint | no | | |
| `modo_intermedio` | text | no | `'curva'` | `CHECK in ('curva','escalon')` |
| `precio_minimo_centimos` | bigint | sí | | `CHECK is null or > 0` |
| `a_confirmado` | boolean | no | `false` | |
| `precios_fijados_en` | timestamptz | no | `now()` | |
| `archivado_en` | timestamptz | sí | | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`CHECK lista_invariante_b`: `p100_centimos < p1000_centimos and p1000_centimos < p5000_centimos` · `unique (tenant_id, id)` (`cotizador_listas_empresa_id`) · único parcial `uq_cotizador_listas_nombre` `(tenant_id, nombre_normalizado) where archivado_en is null` · índice `idx_cotizador_listas_producto` `(tenant_id, producto_id) where producto_id is not null`.

**`cotizador.ajustes_de_cliente`** (`cotizadorAjustesDeCliente`) · modo `completo` (quitar el ajuste es borrar la fila)

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `cliente_id` | uuid | no | | → `core.clientes` |
| `porcentaje` | numeric(7,3) | no | | `CHECK porcentaje > -100 and porcentaje <= 500 and porcentaje <> 0` |
| `nota` | text | sí | | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`unique (tenant_id, cliente_id)` (`uq_cotizador_ajustes_cliente`).

**`cotizador.cotizaciones`** (`cotizadorCotizaciones`) · modo `completo` · además `create trigger cotizaciones_sin_borrado before delete … execute function core.rechazar_cambio();`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `numero` | integer | sí | | |
| `anio` | integer | sí | | `CHECK cotizacion_numeracion: (numero is null) = (anio is null)` |
| `cliente_id` | uuid | sí | | → `core.clientes` |
| `cliente_nombre` | text | sí | | foto al emitir |
| `titulo` | text | no | | |
| `estado` | text | no | `'borrador'` | `CHECK in ('borrador','emitida','enviada','aceptada','rechazada','anulada')` |
| `version_actual` | integer | no | `1` | `CHECK >= 1` |
| `valida_hasta` | date | sí | | |
| `notas` | text | sí | | internas |
| `lineas_aceptadas` | jsonb | sí | | arreglo de posiciones |
| `total_aceptado_centimos` | bigint | sí | | `CHECK is null or >= 0` |
| `aceptada_en` | timestamptz | sí | | `CHECK cotizacion_aceptacion: estado <> 'aceptada' or aceptada_en is not null` |
| `motivo_rechazo` | text | sí | | |
| `anulado_en` | timestamptz | sí | | `CHECK cotizacion_anulacion: (estado = 'anulada') = (anulado_en is not null)` |
| `anulado_por` | text | sí | | |
| `motivo_anulacion` | text | sí | | |
| `datos_extra` | jsonb | no | `'{}'` | |
| `creado_por` | text | no | | |
| `actualizado_en` | | | | disparador |

`CHECK cotizacion_estado_numero`: `estado in ('borrador','anulada') or numero is not null` · `CHECK cotizacion_estado_cliente`: `estado in ('borrador','anulada') or cliente_id is not null` · `unique (tenant_id, id)` (`cotizador_cotizaciones_empresa_id`) · único parcial `uq_cotizador_cotizaciones_numero` `(tenant_id, anio, numero) where numero is not null` · índices `idx_cotizador_cotizaciones_estado` `(tenant_id, estado, creado_en desc)`, `idx_cotizador_cotizaciones_cliente` `(tenant_id, cliente_id, creado_en desc)`, `idx_cotizador_cotizaciones_creador` `(tenant_id, creado_por, creado_en desc)`.

**`cotizador.versiones`** (`cotizadorVersiones`) · modo `completo` · inmutable una vez emitida (disparador de §6.2)

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `cotizacion_id` | uuid | no | | → `cotizador.cotizaciones` |
| `version` | integer | no | | `CHECK >= 1` |
| `modo` | text | no | `'rapida'` | `CHECK in ('rapida','cuadro')` |
| `con_opciones` | boolean | no | `false` | las líneas son alternativas, no se suman para el cliente |
| `igv_porcentaje` | smallint | no | `18` | `CHECK between 0 and 100` |
| `subtotal_centimos` | bigint | no | `0` | `CHECK >= 0` |
| `igv_centimos` | bigint | no | `0` | `CHECK >= 0` |
| `total_centimos` | bigint | no | `0` | `CHECK total_centimos = subtotal_centimos + igv_centimos` |
| `costo_centimos` | bigint | sí | | `CHECK is null or >= 0` |
| `margen_pct` | numeric(7,3) | sí | | |
| `motivo_margen_bajo` | text | sí | | |
| `condiciones` | jsonb | no | `'{}'` | foto al emitir |
| `observaciones` | text | sí | | las ve el cliente |
| `entrada` | jsonb | no | `'{}'` | lo anotado (texto decimal del motor) |
| `resultado` | jsonb | sí | | cálculo del cuadro (B2) |
| `emitida_en` | timestamptz | sí | | |
| `emitida_por` | text | sí | | `CHECK version_emision: (emitida_en is null) = (emitida_por is null)` |
| `creado_por` | text | no | | |

Sin `actualizado_en`. `unique (tenant_id, id)` (`cotizador_versiones_empresa_id`) · `unique (tenant_id, cotizacion_id, version)` (`cotizador_versiones_numero`).

**`cotizador.version_lineas`** (`cotizadorVersionLineas`) · modo `completo` (las de una versión sin emitir se reemplazan)

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `version_id` | uuid | no | | → `cotizador.versiones` |
| `posicion` | integer | no | | `CHECK >= 0` |
| `producto_id` | uuid | sí | | → `core.productos` |
| `lista_id` | uuid | sí | | → `cotizador.listas_de_precio` |
| `descripcion` | text | no | | |
| `unidad` | text | no | `'unidad'` | |
| `cantidad_milesimas` | bigint | no | | `CHECK > 0` |
| `precio_unitario_milesimas` | bigint | no | | `CHECK >= 0` · sin IGV; informativo |
| `importe_centimos` | bigint | no | | `CHECK >= 0` · sin IGV; es el que manda |
| `igv_centimos` | bigint | no | | `CHECK >= 0` |
| `total_centimos` | bigint | no | | `CHECK total_centimos = importe_centimos + igv_centimos` |
| `origen_precio` | text | no | `'manual'` | `CHECK in ('lista','manual')` |
| `detalle` | jsonb | no | `'{}'` | rastro del motor (precio de lista, mínimo, ajustes), en texto |

`unique (tenant_id, version_id, posicion)` (`cotizador_version_lineas_posicion`).

**`cotizador.eventos`** (`cotizadorEventos`) · **modo `insercion`** · `create trigger eventos_inmutable before update or delete … execute function core.rechazar_cambio();` · `EJEMPLOS`: `insercion`

| Columna | Tipo | Nulo | Defecto | Restricción |
|---|---|---|---|---|
| `cotizacion_id` | uuid | no | | → `cotizador.cotizaciones` |
| `version` | integer | no | | `CHECK >= 1` |
| `tipo` | text | no | | `CHECK in ('creada','editada','emitida','enviada','aceptada','rechazada','anulada','nueva_version')` |
| `motivo` | text | sí | | |
| `datos` | jsonb | no | `'{}'` | |
| `usuario_id` | text | no | | |

Índice `idx_cotizador_eventos_cotizacion` `(tenant_id, cotizacion_id, creado_en desc)`.

### 6.2 Bloque a mano (al final del SQL generado, en este orden)

Por cada tabla: `select core.aplicar_aislamiento('cotizador.<tabla>', '<modo>');` · disparador de `actualizado_en` si aplica · `create trigger <tabla>_modulo before insert or update or delete on cotizador.<tabla> for each row execute function core.exigir_modulo_en_escritura('cotizador');` · lo particular. Comentario inicial: `-- capaz_sistema no recibe nada en las tablas de cotizador.` Después:

```sql
-- Una versión emitida no se toca: ni ella ni sus líneas. Sin security definer (regla 18).
create or replace function cotizador.proteger_version_emitida() returns trigger
language plpgsql set search_path = cotizador, pg_temp as $$
begin
  if old.emitida_en is not null then
    raise exception 'Una versión emitida no se modifica ni se borra.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
--> statement-breakpoint
create trigger versiones_inmutable before update or delete on cotizador.versiones
  for each row execute function cotizador.proteger_version_emitida();
--> statement-breakpoint
create or replace function cotizador.proteger_lineas_emitidas() returns trigger
language plpgsql set search_path = cotizador, pg_temp as $$
declare
  emitida boolean;
begin
  if tg_op <> 'INSERT' then
    select v.emitida_en is not null into emitida from cotizador.versiones v
      where v.tenant_id = old.tenant_id and v.id = old.version_id;
    if emitida then
      raise exception 'Las líneas de una versión emitida no se modifican.' using errcode = '42501';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    select v.emitida_en is not null into emitida from cotizador.versiones v
      where v.tenant_id = new.tenant_id and v.id = new.version_id;
    if emitida then
      raise exception 'Las líneas de una versión emitida no se modifican.' using errcode = '42501';
    end if;
    return new;
  end if;
  return old;
end $$;
--> statement-breakpoint
create trigger version_lineas_inmutables before insert or update or delete on cotizador.version_lineas
  for each row execute function cotizador.proteger_lineas_emitidas();
```

Emitir es el `update` que pone `emitida_en` y `emitida_por` cuando `old.emitida_en` todavía es nulo: el disparador lo deja pasar; a partir de ahí, nada.

### 6.3 Pasos

1. Comprobar `ls apps/api/drizzle/*.sql | tail -1`: es `0023_*`. Si no, **parar**.
2. Escribir `src/db/esquema/cotizador.ts` (siete tablas) y exportarlo en `index.ts` (y actualizar el comentario de cabecera).
3. `pnpm db:generar --name=cotizador`. El archivo debe llamarse `0024_cotizador.sql`. En el SQL generado, **quitar** `CREATE SCHEMA "cotizador";` y dejar el comentario `-- El esquema cotizador ya existe (0000); aquí solo van sus tablas.`
4. Agregar el bloque a mano de §6.2.
5. `aislamiento.int.spec.ts`, `beforeAll`: agregar `('cotizador', 'Cotizador')` al `insert into core.modulos` y `($1,'cotizador','activo')` al `insert into core.empresa_modulos`.
6. `aislamiento-ejemplos.ts`: siete entradas, en este orden y con ids fijos (`md5($1::text || 'x')::uuid`):
   - `cotizador.configuracion` · `completo` · `insert into cotizador.configuracion (tenant_id) values ($1)`
   - `cotizador.listas_de_precio` · `completo` · id `'q1'`; `nombre 'Volantes A5'`, `nombre_normalizado 'volantes a5'`, `19000, 58000, 120000`, `creado_por 'u1'`
   - `cotizador.ajustes_de_cliente` · `completo` · `cliente_id md5($1::text || 'cl')::uuid`, `porcentaje -5`, `creado_por 'u1'`
   - `cotizador.cotizaciones` · `completo` · id `'q2'`; `titulo 'Volantes'`, `creado_por 'u1'`
   - `cotizador.versiones` · `completo` · id `'q3'`; `cotizacion_id` = `'q2'`, `version 1`, `creado_por 'u1'`
   - `cotizador.version_lineas` · `completo` · `version_id` = `'q3'`, `posicion 0`, `descripcion 'Línea'`, `cantidad_milesimas 1000`, `precio_unitario_milesimas 1000`, `importe_centimos 100`, `igv_centimos 18`, `total_centimos 118`
   - `cotizador.eventos` · `insercion` · `cotizacion_id` = `'q2'`, `version 1`, `tipo 'creada'`, `usuario_id 'u1'`
7. `cotizador-datos.int.spec.ts` (consulta real con `capaz_app`, módulo activo, dentro de `comoEmpresa`):
   - alta de lista, cotización, versión y dos líneas; después `update cotizador.versiones set emitida_en = now(), emitida_por = 'u1'` pasa;
   - con la versión emitida: `update` de la versión, `delete` de la versión, e `insert`, `update` y `delete` de una línea suya fallan con «emitida»;
   - `update cotizador.cotizaciones set estado = 'emitida'` sin número falla por el `CHECK`; con número y cliente pasa;
   - `delete from cotizador.cotizaciones` falla (solo inserción);
   - una lista `19000 / 15000 / 40000` falla por `lista_invariante_b`;
   - `update` y `delete` en `cotizador.eventos` fallan con «permission denied»;
   - con el módulo `cotizador` dado de baja, un `insert` en `cotizador.listas_de_precio` falla con «no está activo»;
   - `capaz_sistema` no puede leer ninguna tabla de `cotizador`;
   - una línea que apunta a la versión de **otra** empresa falla por la llave compuesta.
8. Red de seguridad, a mano: quitar un `aplicar_aislamiento` del SQL, ver fallar `catalogo.int.spec.ts`, y devolverlo. Decirlo en el informe.
9. VERIF-DATOS. Lista para la sesión de Neon: `0024_cotizador`.

**Hecho cuando:** las tres pruebas de catálogo y `cotizador-datos.int.spec.ts` pasan; `pnpm db:generar` no genera nada; migrar dos veces no cambia nada.

**Parar y preguntar si:** `drizzle-kit` genera algo que toca tablas de otro esquema o recrea una restricción escrita a mano; el número de la migración no sale `0024`; la prueba de funciones de `catalogo.int.spec.ts` marca las dos funciones nuevas como ejecutables por `PUBLIC`; hace falta una columna que no está aquí; alguien pide las tablas del cuadro (B2) o la de enlaces (B3).

## 7. M-registro-s5b · Intérprete de Finanzas y `deuda_crear_con_adelanto`

Conecta las reglas de s5a con la captura de C3: resuelve nombres a identificadores leyendo la base, y propone el borrador de la herramienta que corresponde. Agrega una herramienta para que «contrato con adelanto» sea **un** borrador.

- **Esfuerzo:** M · **Depende de:** C3 y s5a integrados · **Verificación:** VERIF-SERVIDOR.
- **Propiedad exclusiva:** `apps/api/src/modules/registro/**` (menos `enConstruccion` y `porDefecto`) · `packages/shared/src/contratos/registro.ts` (**solo agregar**; `eventosDeRegistro` no cambia).
- **Lee:** esta sección, §1 y §3.3 · `apps/api/src/modules/registro/dictado/interpretar-dictado.ts` · `herramientas/{deudas-escritura,deudas-abonar,guardar-movimiento,comun,herramientas-de-registro}.ts` · `repositories/{deudas,categorias,movimientos}.repository.ts` · `apps/api/src/core/clientes/repositories/clientes.repository.ts` (`buscarClientes`) y `core/clientes/domain/normalizacion.ts`.

### 7.1 Contrato (agregar a `contratos/registro.ts`)

```ts
export const crearDeudaConAdelantoSchema = z
  .strictObject({
    tipo: z.enum(TIPOS_DE_DEUDA),
    contactoId: z.uuid(),
    concepto: texto(200).min(1, { error: 'Indica el concepto.' }),
    totalCentimos: positivo,
    adelantoCentimos: positivo,
    fecha: dia.optional(),
    venceEn: dia.nullish(),
    cuentaId: z.uuid().optional(),
    medioDePago: z.enum(MEDIOS_DE_PAGO).default('efectivo'),
    sucursalId: z.uuid().nullish(),
    notas: texto(2000).nullish(),
    origen: z.enum(ORIGENES_DE_MOVIMIENTO).default('teclado'),
  })
  .refine((v) => v.adelantoCentimos < v.totalCentimos, { error: 'El adelanto debe ser menor que el total.' });
// en contratosDeRegistro:
deuda_crear_con_adelanto: contrato(crearDeudaConAdelantoSchema, z.strictObject({ deuda: deudaSchema, movimiento: movimientoSchema })),
```

Y un campo opcional más en `abonarDeudaSchema`: `origen: z.enum(ORIGENES_DE_MOVIMIENTO).default('teclado')` (hoy `deuda_abonar` escribe siempre `'teclado'`; con esto un abono dictado queda con origen `'voz'`). Es aditivo: quien no lo manda obtiene lo de siempre.

### 7.2 Herramienta `deuda_crear_con_adelanto` (`herramientas/deudas-con-adelanto.ts`)

`modulo: 'registro'` · `permiso: 'registro:editar'` · `criticidad: 'normal'` · `idempotente: true` · **`mueveDinero: true`** · con `ayuda`. En **una** transacción (la del ejecutor), sin llamar a `ejecutarDentro`:
1. `asegurarCatalogos(tx, ctx)`; `hoy`; `fecha = args.fecha ?? hoy.dia`; `validarVencimiento`; `fechaDeMovimiento(args.fecha, hoy.dia)` (una fecha futura → `argumentos_invalidos`); contacto y sucursal existen (`no_encontrado`); `resolverCuenta`.
2. Crear la deuda igual que `deuda_crear` (mismo correlativo `claveDeDeuda(tipo)`, `insertarDeuda`).
3. `aplicarAbono({ estado: 'pendiente', totalCentimos, abonadoCentimos: 0 }, adelantoCentimos)`; `guardarMovimiento` con `tipo = tipoDeMovimientoDeAbono(args.tipo)`, categoría `categoriaDeAbono(tipo)`, `deudaId`, `contactoId`, `descripcion: 'Adelanto de <código>'`, `origen: args.origen`; `guardarAbonado`.
4. Eventos, en este orden: `deuda.creada` (tras insertar la deuda), `movimiento.registrado` (**ya lo emite `guardarMovimiento`**: no lo emitas otra vez) y `deuda.abonada`. Nunca `deuda.pagada` (el adelanto es menor que el total).
5. Salida `{ deuda, movimiento }`; `auditar` con códigos, montos y estado.

Para no duplicar código, extrae de `deudas-escritura.ts` y `deudas-abonar.ts` las funciones internas que necesites a un archivo común del módulo, **sin cambiar lo que hacen** `deuda_crear` y `deuda_abonar` (sus pruebas, incluidos los casos a–h, no cambian). En `deuda_abonar`, pasar `origen: args.origen` a `guardarMovimiento`.

### 7.3 Intérprete (`dictado/interprete.ts` y `dictado/resolver.ts`)

`export const interpreteDeRegistro: InterpreteDeCaptura = { modulo: 'registro', interpretar }`. Se registra en `HerramientasDeRegistro.onModuleInit` con `RegistroDeInterpretes.agregar([interpreteDeRegistro])` (inyectar el registro con `@Inject`). No declara `esquemaParaModelo` (A2).

`interpretar(tx, ctx, e)`: `d = interpretarDictado(e.texto, { modo: e.modo, hoy: (await hoyDeLaEmpresa(tx)).dia })`. `origenDeMovimiento = e.origen === 'voz' ? 'voz' : 'teclado'` (los movimientos no tienen origen `'texto'`).

**Resolver el contacto** (`resolver.ts`, solo lectura), cuando `d.contactoNombre` no es nulo:
1. `n = normalizarNombre(d.contactoNombre)`; `candidatos = await buscarClientes(tx, ctx, n, 5)`.
2. Si alguno tiene `nombreNormalizado === n` → ese.
3. Si no, los que cumplan `esProbableMismaPersona(d.contactoNombre, c.nombre)`: exactamente uno → ese; más de uno → ninguno, y una sugerencia `{ campo: <el del contacto>, texto: d.contactoNombre, opciones: esos }`.
4. Si ninguno → sin contacto, y una sugerencia con `opciones` = los tres primeros candidatos (puede ir vacía; la pantalla ofrecerá «Crear cliente»).

**Resolver la categoría** (solo en `movimiento`): si `d.categoriaDeCapaz` → `categoriaConNombre(tx, ctx, tipo, normalizarNombre(d.categoriaDeCapaz))`; si no hay y el contacto se resolvió → la categoría más usada en los movimientos activos de ese contacto y ese tipo, con las mismas reglas de `sugerirPorHistorial` (al menos 2 registros y 60 % de dominancia: exporta `MINIMO_REGISTROS` y `DOMINANCIA_MINIMA` de `reglas/categoria.ts`; es el único cambio permitido a un archivo portado, y se lista). Si la empresa aún no tiene categorías, se omite: **el intérprete no siembra** (R19).

**Qué propone según `d.intencion`:**

| Intención | Herramienta y `args` | `resumen` |
|---|---|---|
| `movimiento` | `movimiento_registrar { tipo, montoCentimos, fecha?, categoriaId?, contactoId?, descripcion, origen: origenDeMovimiento }`. Sin contacto resuelto: se omite `contactoId` y la descripción termina en ` · <nombre dictado>` | «Ingreso de S/ 500.00 · Juan Pérez · flyers» |
| `abono` | Con el contacto resuelto, sus deudas abiertas (`pendiente` o `parcial`) del `tipoDeDeuda`, respetando el alcance `propios`. Una → `deuda_abonar { id, montoCentimos, fecha?, origen }`. Varias → la más antigua (por `fecha`, luego `numero`) y una sugerencia `{ campo: 'id', texto: '<n> deudas abiertas', opciones: [{ id, nombre: código, detalle: 'Saldo S/ x' }] }`. Ninguna, o sin contacto → `movimiento_registrar` (como arriba) y en `faltan`: «<nombre> no tiene deudas abiertas: se propone como ingreso (o egreso) simple». Si el monto supera el saldo, se propone igual y `faltan` lo dice | «Abono de S/ 100.00 a CXC-2026-0007 de Juan Pérez» |
| `deuda` | `deuda_crear { tipo: tipoDeDeuda, contactoId?, concepto: descripcion ?? 'Deuda dictada', totalCentimos }` | «Por cobrar S/ 240.00 a Cristina» |
| `deuda_con_adelanto` | `deuda_crear_con_adelanto { tipo, contactoId?, concepto: descripcion ?? 'Trabajo dictado', totalCentimos, adelantoCentimos, origen }` | «Por cobrar S/ 240.00 a Cristina, con adelanto de S/ 100.00» |
| `incompleto`, `fuera_de_alcance` | ninguna propuesta; `faltan` y `pista` de `d` | — |

En `deuda` y `deuda_con_adelanto` sin contacto resuelto, el borrador se propone **sin** `contactoId` (un borrador puede venir incompleto), con la sugerencia y con `faltan: ['cliente nuevo: «<nombre>»']` (o `['a quién']` si no se dictó nombre). `faltan` y `pista` de `d` se suman siempre a la respuesta.

### 7.4 Pruebas exigidas

De `deuda_crear_con_adelanto`, por HTTP: total 240.00 y adelanto 100.00 → deuda `parcial` con saldo 140.00, un movimiento de ingreso con `deudaId`, y los tres eventos una vez cada uno; `adelanto = total` y `adelanto > total` → `argumentos_invalidos` sin nada creado; por pagar → movimiento de egreso; misma `Idempotency-Key` → una sola deuda y un solo movimiento; `member` de `lectura` → `modulo_solo_lectura`; la deuda admite después `deuda_abonar` hasta `pagada` (140.00) y **se anula como cualquiera** (caso g: primero su abono). `deuda_abonar` con `origen: 'voz'` deja el movimiento con ese origen; sin `origen`, `'teclado'`. Casos a–h intactos.

«Frase → borrador», por HTTP con `captura_proponer` (empresa sembrada: clientes «Juan Pérez», «Cristina Neira», «Comercial Pacheco», «Rosa Díaz» y «Rosa Diez»; categorías por defecto; una deuda por cobrar abierta de Juan Pérez de 300.00 y dos de Cristina Neira). Cada caso comprueba herramienta, `args` exactos, `origen` del borrador y, donde se indica, que **aprobarlo** produce el efecto:

| # | Dictado · modo | Borrador esperado |
|---|---|---|
| 1 | «Ingreso 500 soles, cliente Juan Pérez, flyers» | `movimiento_registrar { tipo: 'ingreso', montoCentimos: 50000, contactoId: Juan Pérez, origen: 'voz' }`; al aprobar nace el movimiento con origen `voz` |
| 2 | «egreso 45.50 tinta negra» | `movimiento_registrar { egreso, 4550 }`, categoría «Compras» |
| 3 | «ingreso de mil quinientos soles» | `{ ingreso, 150000 }`, sin contacto |
| 4 | «le compré a Comercial Pacheco unas cartulinas y me salieron 350 soles» | `{ egreso, 35000, contactoId: Comercial Pacheco, categoría «Compras» }` |
| 5 | «pagué el recibo de luz 180 soles ayer» | `{ egreso, 18000, categoría «Servicios», fecha: ayer de la empresa }` |
| 6 | «me pagó la señora Rosa 80 soles» | `{ ingreso, 8000 }` sin `contactoId`, con sugerencia de dos opciones (Rosa Díaz, Rosa Diez) |
| 7 | «Ingreso 200 soles, cliente Wilfredo, volantes» | `{ ingreso, 20000 }` sin `contactoId`; la descripción termina en «· Wilfredo»; sugerencia sin opciones |
| 8 | «Juan Pérez abona 100 soles de su deuda» | `deuda_abonar { id: la deuda de Juan, montoCentimos: 10000, origen: 'voz' }`; al aprobar, saldo 200.00 |
| 9 | «Cristina Neira abona 50 de su deuda» | `deuda_abonar` con la más antigua y sugerencia con las dos |
| 10 | «Comercial Pacheco abona 100 de su deuda» | no hay deuda → `movimiento_registrar` y el aviso en `faltan` |
| 11 | «Juan Pérez abona 900 de su deuda» | `deuda_abonar` igual; `faltan` avisa que supera el saldo; al aprobar → `conflicto` y el borrador sigue pendiente |
| 12 | «Contrato 240, adelanto 100, cliente Cristina Neira» | `deuda_crear_con_adelanto { por_cobrar, 24000, 10000, contactoId }`; al aprobar, deuda `parcial` |
| 13 | «contrato 100 adelanto 100 cliente Cristina Neira» | **no** es `deuda_crear_con_adelanto` |
| 14 | «Cristina Neira me quedó debiendo 240» | `deuda_crear { por_cobrar, 24000, contactoId }` |
| 15 | «le debo a Comercial Pacheco 500 de papel» | `deuda_crear { por_pagar, 50000 }` (con el contacto si la regla portada lo encuentra; anotar lo que salga) |
| 16 | «Contrato 300, adelanto 50, cliente Mateo» | `deuda_crear_con_adelanto` sin `contactoId`, `faltan` con «cliente nuevo: «Mateo»»; tras `clientes_crear` y `borrador_corregir` con su id, aprobar funciona y queda `corregido: true` |
| 17 | «350 de cartulina» sin modo · con modo `egreso` | sin borrador y `faltan: ['si entró o salió']` · `movimiento_registrar { egreso, 35000 }` |
| 18 | «Hazle una proforma a Juan por 500 tarjetas a 180 soles» · «hola que tal» | sin borrador, con `pista` |
| 19 | el caso 1 con `origen: 'texto'` | borrador con origen `texto` y `args.origen: 'teclado'` |
| 20 | un `member` con alcance `propios` dicta el caso 8 y la deuda es de otra persona | no la ve → `movimiento_registrar` con el aviso |

Más: `solo-propone.spec.ts` y `pureza.spec.ts` siguen en verde (relajar `pureza` solo para `interprete.ts` y `resolver.ts`); después de **proponer** los veinte casos no existe ningún movimiento ni deuda nuevos.

**Hecho cuando:** los veinte casos y las pruebas de la herramienta pasan; `registro` tiene 24 herramientas; el informe trae la tabla con lo que devolvió cada frase.

**Parar y preguntar si:** un caso exige cambiar una regla portada o un esperado de s5a; hace falta una columna; `guardarMovimiento` no permite pasar `origen` o emite distinto de lo descrito; aprobar un borrador de `deuda_crear_con_adelanto` se comporta distinto que llamarla directo.

## 8. W11 · Pantalla de dictado

- **Esfuerzo:** M · **Depende de:** C3 integrado (s5b integrado para probar de punta a punta) · **Verificación:** VERIF-WEB.
- **Propiedad exclusiva:** `apps/web/src/core/captura/**`.
- **Lee:** esta sección, §1 y §3.1 · `SF/src/shared/hooks/useSpeechRecognition.ts` (289 líneas; solo importa React) · `apps/web/src/core/bandeja/{api.ts,logica.ts,formulario-correccion.tsx}` · `apps/web/src/modules/registro/hoja-movimiento.tsx` (cómo se usan los selectores) · `/kit`.
- **Solicitudes de cambio previstas (las hace el integrador al integrar):** el botón de micrófono en la carcasa (`app/carcasa/**`) que lleva a `/dictar`, visible si `puedeEscribirEn(yo, 'registro')`; una tarjeta de métricas en Inicio (`core/inicio/**`).

1. **`reconocedor.ts`** (interfaz; otro proveedor se cambia sin tocar la pantalla):
   ```ts
   export type EstadoDeReconocedor = 'sin_contexto_seguro' | 'no_disponible' | 'listo' | 'escuchando' | 'error';
   export type ReconocedorDeVoz = { estado: EstadoDeReconocedor; texto: string; aviso: string | null; iniciar: () => void; detener: () => void; limpiar: () => void };
   ```
2. **`use-reconocedor-web-speech.ts`**: porte del hook de Tairos.RC (R21 en lo que aplica: se copia y se adapta la forma de salida a la interfaz). Se conserva: idioma `es-PE`, continuo en escritorio y por sesiones en Android, resultados parciales, la unión del texto entre sesiones. El recorte del texto pasa de 400 a `MAXIMO_DE_TEXTO_DE_CAPTURA`. Avisos propios: sin `window.isSecureContext` → «El micrófono necesita una conexión segura (https). Mientras tanto, escribe o usa el micrófono del teclado.»; sin `SpeechRecognition` → «Este navegador no reconoce voz. Usa Chrome, o escribe.». **Nada** del dominio ni de la marca de Tairos.RC. La lógica que sea pura (unir sesiones, recortar) va en `logica.ts` con pruebas.
3. **`pantalla-dictado.tsx`**, ruta `dictar` en `core/captura/rutas.tsx`. Móvil primero (R18): botón grande de micrófono; el texto en un `CampoTextarea` siempre editable (el texto es el respaldo de la voz); dos botones «Ingreso» y «Egreso» (el `modo`; se puede no elegir ninguno); «Enviar». El cronómetro arranca al tocar el micrófono o con la primera tecla: `transcurridoMs = Math.min(Math.round(performance.now() - inicio), MAXIMO_DE_ESPERA_DE_CAPTURA_MS)`. `origen` = `'voz'` si el texto vino del reconocedor (aunque después se retoque), `'texto'` si se escribió entero.
4. Envía con `llamar('captura_proponer', …)`. Con `borradores: []` muestra `faltan` y `pista` y deja el texto para corregirlo. Con borradores, una **tarjeta por borrador**.
5. **Tarjetas** (`tarjeta-de-borrador.tsx` y un formulario por herramienta en `tarjetas/`): para `movimiento_registrar`, `deuda_abonar`, `deuda_crear` y `deuda_crear_con_adelanto`. Muestran nombres, no identificadores: monto (`CampoMonto`), tipo, fecha, contacto (`SelectorDeRegistro` sobre `clientes_buscar`, con «Crear cliente «X»» → `clientes_crear` cuando la sugerencia no trae opciones), categoría y cuenta (`CampoSelect` con `categorias_listar` y `cuentas_listar`), deuda (las opciones de la sugerencia). Las llamadas van **por nombre** con `llamar` (`core` no importa de `modules`). Una herramienta sin tarjeta propia cae en el `formulario-correccion` genérico de la bandeja (importarlo, no copiarlo).
6. Acciones de cada tarjeta:
   - **«Aprobar»**: si la persona no cambió nada → solo `borrador_aprobar`. Si cambió algo → `borrador_corregir` con los `args` nuevos y después `borrador_aprobar`. **Nunca** se llama a `borrador_corregir` sin cambios: marcaría `corregido` y falsearía la medición. La comparación es una función pura probada.
   - **«Después»**: no llama a nada; el borrador queda en la bandeja.
   - **«Descartar»**: `borrador_descartar { id, motivo: 'Dictado descartado' }`.
   - Tras aprobar: aviso «Registrado» y la pantalla queda lista para el siguiente dictado. Un rechazo de la herramienta (por ejemplo, el abono supera el saldo) se muestra en la tarjeta y el borrador sigue pendiente.
7. Al pie, una línea de medición con `borradores_metricas` del mes en curso y `origen: 'voz'`: «Este mes: 42 dictados · 76 % sin corregir · 24 s» (o «Aún sin dictados»).
8. Pruebas (solo lógica pura, sin navegador): unir y recortar el texto del reconocedor; decidir `origen`; calcular y topar `transcurridoMs`; armar los `args` corregidos y detectar «sin cambios»; aplicar una opción de sugerencia; textos por código de error; texto de la línea de medición.

**Hecho cuando:** VERIF-WEB en verde y, con s5b integrado, en un navegador de escritorio se escribe «Ingreso 500 soles, cliente Juan Pérez, flyers», se toca «Aprobar» y el movimiento aparece en Finanzas. **Revisión visual pendiente (persona):** 390 y 1280 px, claro y oscuro; y la voz real en Chrome de Android, **que solo se puede probar con HTTPS (X1, Keny)**.

**Parar y preguntar si:** hace falta una pieza del kit que no existe; se pide grabar y subir audio, o enviar el audio al servidor (no es A1); la tarjeta necesita importar algo de `modules/registro`; el hook exige una dependencia.

## 9. M-cotizador-s1 · Precios y configuración

Lista de precios por cantidad (100 / 1.000 / 5.000), el precio de cualquier cantidad intermedia, el ajuste por cliente y la configuración. Es el servidor de la «cotización rápida».

- **Esfuerzo:** M · **Depende de:** DB5 y s0 integrados · **Verificación:** VERIF-SERVIDOR.
- **Propiedad exclusiva:** `apps/api/src/modules/cotizador/**` (menos `domain/motor/**`, que queda congelado, y las banderas `enConstruccion`/`porDefecto`) · `packages/shared/src/contratos/cotizador.ts`.
- **Lee:** esta sección y §1 · `FICHAS-OLA-2.md` §1 (R1 a R18) · `docs/COMO-CREAR-UN-MODULO.md` · los modelos de código de `PLAN-PARALELO.md` §5 · `domain/adaptador-de-dinero.ts` y `domain/motor/escala/{precio-rapido,validar-referencias}.ts` · `src/db/esquema/cotizador.ts`.

### 9.1 Manifiesto (`cotizador.manifest.ts`)

`descripcion`: «Lista de precios por cantidad y cotizaciones que se convierten en pedidos.» · `permisos`: `cotizador:ver`, `cotizador:editar`, `cotizador:emitir`, `cotizador:costos`, **`cotizador:configurar`** (nuevo) · `completo`: los cinco · `lectura`: `cotizador:ver` · `dependeDe: []` · `secciones` (todas `construida: false`; las enciende el integrador con w1): `rapida` «Cotización rápida» `/m/cotizador` · `cotizaciones` «Cotizaciones» `/m/cotizador/cotizaciones` · `precios` «Lista de precios» `/m/cotizador/precios` · `ajustes` «Ajustes» `/m/cotizador/ajustes`. `familia`, `orden`, `acento`, `icono` y `enConstruccion` **no se tocan**.

### 9.2 Contratos (`contratos/cotizador.ts`)

```ts
export const MODOS_INTERMEDIOS = ['curva', 'escalon'] as const;
export const REDONDEOS_COMERCIALES = ['ninguno', '1', '5', '10'] as const;
export const BASES_DE_UTILIDAD = ['venta', 'costo'] as const;
export const ESTADOS_DE_COTIZACION = ['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada'] as const;
export const UNIDADES_SUGERIDAS = ['unidad', 'ciento', 'millar', 'pliego', 'm2', 'hora', 'juego', 'talonario'] as const;
/** La lista cotiza entre estas cantidades; fuera de ellas se cotiza aparte. */
export const CANTIDAD_MINIMA_DE_LISTA_MILESIMAS = 100_000;
export const CANTIDAD_MAXIMA_DE_LISTA_MILESIMAS = 5_000_000;
export const DIAS_PARA_REVISAR_PRECIO = 90;
/** En el corte B1 solo 18 o 0: Pedidos calcula con 18 (ver §11, punto 13). */
export const IGV_ADMITIDOS = [18, 0] as const;

const texto = (max: number) => z.string().trim().max(max);
const soloId = z.strictObject({ id: z.uuid() });
const positivo = z.number().int().safe().min(1, { error: 'El precio debe ser mayor que cero.' });
const nombre = texto(120).min(1, { error: 'El nombre es obligatorio.' });
/** Porcentajes: texto decimal (interior del motor, R22). */
const porcentaje = z.string().regex(/^\d{1,4}(\.\d{1,3})?$/, { error: 'Porcentaje inválido.' });
const porcentajeConSigno = z.string().regex(/^-?\d{1,3}(\.\d{1,3})?$/, { error: 'Porcentaje inválido.' });

export const condicionesSchema = z.strictObject({
  validezDias: z.number().int().min(1).max(365).nullable(),
  plazoEntrega: texto(300), formaPago: texto(300), tolerancia: texto(300), noIncluye: texto(300),
});
export const CONDICIONES_VACIAS = { validezDias: null, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '' } as const;

export const configuracionDeCotizadorSchema = z.strictObject({
  utilidadPct: z.string(), utilidadBase: z.enum(BASES_DE_UTILIDAD), umbralVerdePct: z.string(), umbralMinimoPct: z.string(),
  redondeoComercial: z.enum(REDONDEOS_COMERCIALES), igvPorcentaje: z.number().int(), condiciones: condicionesSchema,
  mensajeWhatsapp: z.string().nullable(), actualizadoEn: z.iso.datetime().nullable(),
});

export const listaDePrecioSchema = z.strictObject({
  id: z.string(), productoId: z.string().nullable(), nombre: z.string(), unidad: z.string(),
  p100Centimos: z.number().int(), p1000Centimos: z.number().int(), p5000Centimos: z.number().int(),
  modoIntermedio: z.enum(MODOS_INTERMEDIOS), precioMinimoCentimos: z.number().int().nullable(), aConfirmado: z.boolean(),
  preciosFijadosEn: z.iso.datetime(), /** Más de DIAS_PARA_REVISAR_PRECIO días sin fijar precios. */ porRevisar: z.boolean(),
  archivadoEn: z.iso.datetime().nullable(), creadoEn: z.iso.datetime(), actualizadoEn: z.iso.datetime(),
});

const referencias = { p100Centimos: positivo, p1000Centimos: positivo, p5000Centimos: positivo };
export const crearListaDePrecioSchema = z.strictObject({
  nombre, unidad: texto(20).min(1).default('unidad'), productoId: z.uuid().nullish(), ...referencias,
  modoIntermedio: z.enum(MODOS_INTERMEDIOS).default('curva'), precioMinimoCentimos: positivo.nullish(),
  /** El unitario no baja con la cantidad: se guarda solo si la persona lo confirma. */
  confirmarUnitarioNoBaja: z.boolean().default(false),
});
export const editarListaDePrecioSchema = z
  .strictObject({ id: z.uuid(), nombre: nombre.optional(), unidad: texto(20).min(1).optional(), productoId: z.uuid().nullish(),
    p100Centimos: positivo.optional(), p1000Centimos: positivo.optional(), p5000Centimos: positivo.optional(),
    modoIntermedio: z.enum(MODOS_INTERMEDIOS).optional(), precioMinimoCentimos: positivo.nullish(), confirmarUnitarioNoBaja: z.boolean().default(false) })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && k !== 'confirmarUnitarioNoBaja' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

/** El ajuste de UNA cotización; nunca toca la lista. */
export const ajusteDePrecioSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('ninguno') }),
  z.strictObject({ tipo: z.literal('precio'), importeCentimos: positivo }),
  z.strictObject({ tipo: z.literal('monto'), importeCentimos: z.number().int().safe() }),
]);
export const consultarPrecioSchema = z.strictObject({
  listaId: z.uuid(), cantidadMilesimas: z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' }),
  clienteId: z.uuid().optional(), ajuste: ajusteDePrecioSchema.default({ tipo: 'ninguno' }),
});
export const precioConsultadoSchema = z.strictObject({
  listaId: z.string(), nombre: z.string(), unidad: z.string(), cantidadMilesimas: z.number().int(),
  /** Lista → ajuste del cliente → redondeo comercial. Sin IGV. */ precioListaCentimos: z.number().int(),
  /** Lo que se cobra, sin IGV (la lista con el ajuste de esta cotización). */ importeCentimos: z.number().int(),
  igvCentimos: z.number().int(), totalCentimos: z.number().int(), precioUnitarioMilesimas: z.number().int(),
  minimoAplicado: z.boolean(), ajusteClientePct: z.string().nullable(), redondeoComercial: z.enum(REDONDEOS_COMERCIALES), igvPorcentaje: z.number().int(),
});

export const ajusteDeClienteSchema = z.strictObject({ clienteId: z.string(), clienteNombre: z.string(), porcentaje: z.string(), nota: z.string().nullable(), actualizadoEn: z.iso.datetime() });
```

| Herramienta | Entrada | Salida | Permiso · criticidad · marcas |
|---|---|---|---|
| `cotizador_iniciar` | `{}` | `{ configuracionCreada: boolean }` | `cotizador:editar` · normal · idempotente |
| `cotizador_configuracion_ver` | `{}` | `configuracionDeCotizadorSchema` (sin fila: los valores por defecto y `actualizadoEn: null`; **no** siembra) | `cotizador:ver` · lectura |
| `cotizador_configurar` | `{ utilidadPct?: porcentaje, utilidadBase?, umbralVerdePct?: porcentaje, umbralMinimoPct?: porcentaje, redondeoComercial?, igvPorcentaje?: 18 \| 0, condiciones?: condicionesSchema, mensajeWhatsapp?: texto(500) \| null }` · al menos un cambio | `configuracionDeCotizadorSchema` | `cotizador:configurar` · normal |
| `listas_precio_listar` | `{ ...paginaSchema.shape, buscar?: texto(100), estado: enum('activas','archivadas','todas') = 'activas', soloPorRevisar: boolean = false }` · orden `(nombre_normalizado, id)` | `listadoSchema(listaDePrecioSchema)` | `cotizador:ver` · lectura |
| `lista_precio_ver` | `soloId` | `listaDePrecioSchema` | `cotizador:ver` · lectura |
| `lista_precio_crear` | `crearListaDePrecioSchema` | `listaDePrecioSchema` | `cotizador:configurar` · normal · idempotente |
| `lista_precio_editar` | `editarListaDePrecioSchema` | `listaDePrecioSchema` | `cotizador:configurar` · **crítica** |
| `lista_precio_archivar` | `soloId` | `listaDePrecioSchema` | `cotizador:configurar` · normal |
| `precio_consultar` | `consultarPrecioSchema` | `precioConsultadoSchema` | `cotizador:ver` · lectura |
| `ajustes_cliente_listar` | `{}` | `listadoSchema(ajusteDeClienteSchema)` (`siguiente` nulo; máximo 500) | `cotizador:ver` · lectura |
| `ajuste_cliente_fijar` | `{ clienteId: uuid, porcentaje: porcentajeConSigno \| null, nota?: texto(200) \| null }` (`null` o `'0'` quita el ajuste) | `{ clienteId: string, ajuste: ajusteDeClienteSchema \| null }` | `cotizador:configurar` · normal |

Son 11 herramientas (R15: máximo 13). Además, **copiar ya** `eventosDeCotizador` de la §10.1 (lo necesita M-ordenes-s3 para compilar); s1 no emite ninguno.

### 9.3 Reglas (dominio; cada una con prueba unitaria)

1. **Fachada `domain/precios.ts`** (única puerta de las herramientas al motor, R22): `cotizarDesdeLista(lista, { cantidadMilesimas, ajusteClientePct, redondeo, ajuste, igvPorcentaje })` convierte céntimos y milésimas a texto con el adaptador, llama a `precioDeRapida(variante, cantidad, ajuste, redondeo, ajusteClientePct)` del motor y devuelve céntimos. `validarLista(referencias)` envuelve `validarReferencias`.
2. **IGV por línea**, con `BigInt` y mitad hacia arriba: `igv = redondear(importe × igvPorcentaje / 100)`, `total = importe + igv`. Función pura `igvDeImporte(importeCentimos, igvPorcentaje)` en `domain/igv.ts`.
3. Códigos del motor → respuesta: `fuera_de_rango` → `conflicto` («… está fuera de 100 a 5.000 unidades: hay que cotizar aparte.»); `cantidad_invalida` y `precio_no_positivo` → `argumentos_invalidos`; `referencias_invalidas` y `calculo_invalido` → `conflicto`.
4. **Invariante B** (el total crece: `p100 < p1000 < p5000`) bloquea: `argumentos_invalidos` con el mensaje del motor. **Invariante A** (el unitario baja) avisa: sin `confirmarUnitarioNoBaja` → `conflicto` con el mensaje del motor más « Confirma para guardarlo igual.»; con él se guarda `a_confirmado = true`.
5. `precios_fijados_en = now()` al crear y cada vez que cambia `p100`, `p1000`, `p5000`, el modo o el mínimo; no al renombrar. `porRevisar` = más de 90 días desde entonces (con `hoyDeLaEmpresa`).
6. `lista_precio_editar` es crítica: `resumir` devuelve «Cambiarás los precios de «Volantes A5»: 100 → S/ 190.00 (antes S/ 180.00)…» y `huella = hashCanonico({ p100, p1000, p5000, modoIntermedio, precioMinimo, archivadoEn })` del estado actual. Una lista archivada no se edita (`conflicto`).
7. Nombre repetido entre listas activas → `conflicto` con `candidatas`. `productoId`, si llega, existe y no está archivado.
8. `precio_consultar`: lista archivada → `conflicto`; `clienteId` → su ajuste si existe; la configuración se lee (o sus valores por defecto si no hay fila). **No escribe.**
9. `asegurarConfiguracion(tx, ctx)` (R10): `insert … on conflict do nothing`; la llaman `cotizador_iniciar` y toda escritura.
10. `cotizador_configurar`: tras fusionar el cambio, `umbralMinimoPct < umbralVerdePct` y, con base `venta`, `utilidadPct < 100` (`argumentos_invalidos`).

### 9.4 Pruebas exigidas

Unitarias de `domain/precios.ts`, en céntimos (los casos C7 a C11 a través de la fachada): lista `19000 / 58000 / 120000` en curva → 100: `19000` · 200: `26586` · 500: `41450` · 1.000: `58000` · 1.500: `69659` · **2.500: `87739`** · 5.000: `120000`; en escalón, 2.500 → `145000`; mínimo `25000` con 100 → `25000` y `minimoAplicado`; 99 y 5.001 unidades → `fuera_de_rango`; `19000 / 15000 / 40000` → bloqueo; 2.000 unidades con redondeo `1`, `5`, `10` → `79400`, `79500`, `80000` (sin redondeo `79326`); ajuste de cliente `-5` y `10`; ajuste `monto` negativo que deja el precio en cero → `precio_no_positivo`. De `igvDeImporte` (18 %): `34638` → `6235` (total `40873`); `14486` → `2607`; `22034` → `3966`; `55583` → `10005`; con 0 % → `0`.

R17 completa por HTTP (dos empresas, `lectura`, sin módulo, baja con `insert` directo rechazado, idempotencia de `lista_precio_crear`, crítica que no cambia nada hasta confirmar, paginación). Propias: `precio_consultar` de 2.500 con la lista de C7 devuelve `importeCentimos 87739`, `igvCentimos 15793`, `totalCentimos 103532`; un `member` de `lectura` puede `precio_consultar` y no puede `lista_precio_crear`; el ajuste del cliente cambia `precioListaCentimos` y aparece en `ajusteClientePct`; `frontera-del-motor.spec.ts` sigue en verde.

**Hecho cuando:** se crea una lista por HTTP sin haber configurado nada, `precio_consultar` devuelve `87739` para 2.500 unidades, y el servidor arranca con las 11 herramientas.

**Parar y preguntar si:** hace falta importar `big.js` o el motor fuera de `domain/`; un número de C7 a C11 no sale; hace falta una columna; se pide el precio por m², las tarifas o el cuadro por partes (no son de B1).

## 10. Tanda 3 (esquema; arquitectura fijada)

El detalle campo por campo de s2 y de w1 lo cierra el arquitecto al integrar la tanda 2, con lo aprendido. Lo de esta sección **no se reabre**.

### 10.1 Eventos del Cotizador (congelados ya; los copia s1 al contrato)

```ts
const lineaAceptadaSchema = z.strictObject({
  productoId: z.string().nullable(), descripcion: z.string(), unidad: z.string(),
  cantidadMilesimas: z.number().int(), precioUnitarioMilesimas: z.number().int(), afectoIgv: z.boolean(),
});
export const eventosDeCotizador = {
  'cotizacion.emitida': z.strictObject({ id: z.string(), codigo: z.string(), version: z.number().int(), clienteId: z.string(), totalCentimos: z.number().int() }),
  'cotizacion.aceptada': z.strictObject({
    id: z.string(), codigo: z.string(), version: z.number().int(), clienteId: z.string(), igvPorcentaje: z.number().int(),
    subtotalCentimos: z.number().int(), igvCentimos: z.number().int(), totalCentimos: z.number().int(),
    /** Ya en el formato de una línea de pedido: precios CON IGV (D17). */
    lineas: z.array(lineaAceptadaSchema).min(1).max(100),
  }),
  'cotizacion.rechazada': z.strictObject({ id: z.string(), codigo: z.string(), version: z.number().int(), clienteId: z.string() }),
  'cotizacion.anulada': z.strictObject({ id: z.string(), codigo: z.string(), estadoAnterior: z.enum(ESTADOS_DE_COTIZACION) }),
} as const;
```

**Conversión de una línea aceptada (la hace el Cotizador al emitir el evento):** `cantidadMilesimas: 1000`, `unidad: 'lote'`, `descripcion` = la cantidad con su unidad y la descripción («2.500 unidades · Volantes A5 4/4 couché 150 g», máximo 300), `precioUnitarioMilesimas = total_centimos de la línea × 10`, `afectoIgv = igvPorcentaje > 0`, `productoId` el de la línea. Los tres totales del evento son la suma de las líneas aceptadas. Sin motivos ni textos libres del cliente (R13).

### 10.2 M-cotizador-s2 · Cotizaciones

- **Depende de:** s1 · **Propiedad:** la de s1 · **Verificación:** VERIF-SERVIDOR.
- **Doce herramientas:** `cotizacion_crear` (idempotente), `cotizacion_editar`, `cotizacion_ver`, `cotizaciones_listar`, `cotizacion_emitir` (**crítica**), `cotizacion_nueva_version`, `cotizacion_duplicar`, `cotizacion_marcar_enviada`, `cotizacion_aceptar`, `cotizacion_rechazar`, `cotizacion_anular` (**crítica**), `cotizador_resumen`. Permisos: lecturas `cotizador:ver`; crear, editar, nueva versión, duplicar, marcar enviada, aceptar y rechazar `cotizador:editar`; emitir y anular `cotizador:emitir`. Alcance `propios` por `creado_por` (R4); `cotizador_resumen` exige `todos`.
- **Estados** (tabla pura en `domain/estados.ts`): `borrador → emitida` (emitir) · `emitida → enviada` · `emitida | enviada → aceptada | rechazada` · `emitida | enviada | rechazada → borrador` (nueva versión: crea la versión `n + 1` sin emitir, copia de la actual, y sube `version_actual`) · cualquiera menos `anulada → anulada`. Solo se edita en `borrador`. Cada cambio deja una fila en `cotizador.eventos`.
- **Numeración:** se asigna en la **primera** emisión; clave `cotizador.cotizacion`, sin serie, `anio` de `hoyDeLaEmpresa`; código `COT-2026-0001` y, desde la segunda versión, «COT-2026-0001 v2». Emitir exige cliente y al menos una línea, guarda la foto (`cliente_nombre`, `condiciones`, `igv_porcentaje`) y `valida_hasta` (hoy + `validezDias`).
- **Líneas:** de 1 a 100. Una línea `lista` trae `listaId` y cantidad, y el servidor **recalcula** el precio con `cotizarDesdeLista` (no confía en el de la pantalla); una `manual` trae descripción, cantidad y precio unitario sin IGV, e `importe = importe(cantidad, precio)` de `@capaz/shared`. IGV por línea con `igvDeImporte`; los totales de la versión son sumas.
- **Opciones:** `conOpciones: true` marca que las líneas son alternativas (el documento no imprime un total general). **Aceptar** recibe `{ id, posiciones?: int[] }` (por defecto todas; con `conOpciones`, al menos una y obligatorio indicarlas) y guarda `lineas_aceptadas`, `total_aceptado_centimos` y `aceptada_en`.
- **Costo y margen:** `costoCentimos` es opcional y solo lo escribe y lo ve quien tiene `cotizador:costos` (para los demás, `costoCentimos`, `margenPct` y `motivoMargenBajo` salen `null`). Con costo, `margen = (subtotal − costo) / subtotal × 100` calculado con el motor (`calcularMargen`). Si queda por debajo de `umbralMinimoPct`, emitir exige `motivoMargenBajo`.
- **Eventos de negocio:** `cotizacion.emitida`, `cotizacion.aceptada`, `cotizacion.rechazada` y `cotizacion.anulada` (este, siempre que la cotización tuviera número), una vez cada uno.
- **Pruebas:** R17; la tabla de estados por HTTP; dos emisiones simultáneas dan números consecutivos; editar una versión emitida falla en la herramienta **y** en la base; aceptar dos veces → `conflicto` y un solo evento; el evento de 346.38 sin IGV lleva una línea de `408730` milésimas; quien no tiene `cotizador:costos` no ve el costo.
- **Parar y preguntar si:** se pide el cuadro por partes, descuentos por línea, enlace público, o cambiar el contrato de `pedido_crear`.

### 10.3 M-ordenes-s3 · Puente cotización → pedido

- **Depende de:** s1 integrado (para tener `EVENTOS['cotizacion.aceptada']`); se prueba emitiendo el evento a mano, sin esperar a s2 · **Propiedad:** `apps/api/src/modules/ordenes/**` · **Sin migración** y sin cambiar ningún contrato de `ordenes`.
- Archivo nuevo `modules/ordenes/consumidores.ts`; el proveedor `HerramientasDeOrdenes` inyecta `RegistroDeConsumidores` y los registra. R5 al pie de la letra (modelo: `modules/registro/consumidores.ts`).
- **`ordenes_cotizacion_aceptada`** (`evento: 'cotizacion.aceptada'`): valida la carga; si `pedidoPorOrigen(tx, ctx, 'cotizacion', carga.id)` devuelve un pedido vivo, no hace nada; si no, `proponerBorrador(tx, { herramienta: 'pedido_crear', args: { clienteId: carga.clienteId, lineas: carga.lineas, notas: 'Cotización <código> v<versión>', origenTipo: 'cotizacion', origenId: carga.id }, resumen: 'Crear el pedido de la cotización <código> por <total>', origen: 'modulo', origenRef: 'cotizacion:<id>', propuestoPor: 'sistema' })`. Si `carga.igvPorcentaje` no es 18 ni 0, la propuesta va con `prioridad: 'alta'` y la nota avisa que hay que revisar los importes.
- **`ordenes_cotizacion_anulada`** (`evento: 'cotizacion.anulada'`): si hay un pedido vivo con ese origen y está en `borrador` (`pedidoPorOrigen` hoy no devuelve el estado: agrega esa columna a su `select` o una lectura nueva en el repositorio del módulo), propone `pedido_cancelar { id, motivo: 'Cotización <código> anulada' }` con prioridad `alta`; en cualquier otro caso, nada.
- **Pruebas (P1 a P3 del plan §6.3):** P1 — con la línea `{ cantidadMilesimas: 1000, precioUnitarioMilesimas: 408730, afectoIgv: true }`, aprobar el borrador crea un pedido con subtotal `34638`, IGV `6235` y total `40873`; lo mismo con `170930` → `14486 + 2607`, `260000` → `22034 + 3966` y `655880` → `55583 + 10005`. P2 — el mismo evento entregado dos veces deja **un** borrador (`Relevo.procesarLote()` dos veces); aprobar dos borradores con el mismo origen deja un pedido y el segundo responde `conflicto`. P3 — sin evento de aceptación no hay borrador.

### 10.4 M-cotizador-w1 · Pantallas del corte B1 (dos sesiones)

- **Depende de:** s2 · **Propiedad:** `apps/web/src/modules/cotizador/**` · **Verificación:** VERIF-WEB · R18.
- **Rutas** (el `rutas.tsx` ya está registrado): `m/cotizador` (rápida), `m/cotizador/cotizaciones`, `m/cotizador/cotizaciones/:id`, `m/cotizador/cotizaciones/:id/documento`, `m/cotizador/precios`, `m/cotizador/ajustes`, con marco propio (`NavegacionDeSeccion`).
- **Sesión a:** *Lista de precios* (lista con la marca «Revisar», alta y edición en hoja con los tres precios y el unitario de cada uno, archivar) · *Cotización rápida* (buscar el producto, ver sus tres precios, escribir la cantidad, ver precio, IGV y total con `precio_consultar`, «Crear cotización») · *Ajustes* (configuración y ajustes por cliente).
- **Sesión b:** *Cotizaciones* (lista con estados) · *Ficha* (cliente, líneas, condiciones, emitir, nueva versión, enviada, aceptar eligiendo líneas, rechazar, anular, historial) · *Documento «Cotización»* con `shared/impresion` (`HojaImprimible`, `TablaImprimible`), **sin costos ni margen**, con precio, IGV y total, y sin total general si `conOpciones` · *WhatsApp* con el patrón de Pedidos (`enlaceDeWhatsApp`; el mensaje es el de la configuración o uno por defecto, y el PDF se adjunta a mano).
- Los totales en pantalla salen del servidor (`precio_consultar` y la ficha); **la pantalla no calcula precios** ni importa el motor.
- **Parar y preguntar si:** hace falta una pieza del kit (K3) o una dependencia para el PDF (no: se usa «Guardar como PDF» del navegador).

### 10.5 X4 · Cierre de la ola (integrador)

1. Recorrido por HTTP `apps/api/src/pruebas/recorridos/ola-4.int.spec.ts`: (a) dictado «Contrato 240, adelanto 100, cliente …» → borrador de voz → aprobar → deuda `parcial` y su movimiento → `borradores_metricas` lo cuenta sin corregir; (b) lista de precios → cotización de 2.500 → emitir → aceptar → `Relevo.procesarLote()` → borrador de `pedido_crear` → aprobar → confirmar → borrador de `deuda_crear` → aprobar; los importes coinciden al céntimo en los tres documentos.
2. Quitar `enConstruccion` del Cotizador, poner sus secciones en `construida: true` y ajustar `core/modulos/catalogo.spec.ts` (hoy espera **1** módulo en construcción: pasa a 0).
3. Botón de micrófono en la carcasa y tarjeta de medición en Inicio (solicitudes de W11).
4. `pnpm db:generar` no genera nada; `0024_cotizador` en la lista de Neon; tablero, `RELEVO.md`, `graphify update .`.
5. Revisión visual con el dueño y prueba de voz real en el host con HTTPS.

**Ola 4 lista cuando** se cumplen los «hecho cuando» técnicos del plan §6.4 para la voz y para el Cotizador B1; el uso real (100 dictados, 70 %, 30 s; 10 cotizaciones) se mide en el piloto.

## 11. Contradicciones halladas y cómo se resolvieron

Entre el plan aprobado, las fichas anteriores y el código real. Todo lo que aquí se decide ya está aplicado en las secciones de arriba.

| # | Qué decía | Qué hay en el código | Resolución |
|---|---|---|---|
| 1 | Plan §4.1: `captura_proponer { …, canal }` | `canal` está en `ARGUMENTOS_DE_CONTEXTO`: el registro no arranca con una herramienta que lo pida (`core/herramientas/registro.ts:72-79`) y el ejecutor responde `argumento_prohibido` | El campo se llama `origen` (R23) |
| 2 | Plan §4.1: `capturaIniciadaEn` como hora que manda el cliente («no futura ni de hace más de 15 min») | El tiempo se mide contra `resuelto_en`, que pone el servidor: dos relojes distintos | El cliente manda `transcurridoMs`; el servidor calcula `capturaIniciadaEn` |
| 3 | Plan §4.1: `borradores_metricas` aparece junto al contrato de captura | El área `borradores` tiene su archivo y su carril | Va en `contratos/borradores.ts` y en `core/borradores/` |
| 4 | Plan §4.4: C3 solo toca `core/captura/**`, `core/borradores/**` y `captura.ts` | Un área nueva obliga a editar `contratos/index.ts` y `app.module.ts`, que son del integrador | Paso previo C4 (§2) |
| 5 | Plan §4.1: «comprueba el permiso `registro:editar`» | El núcleo no debe conocer permisos de un módulo | Comprobación genérica: `puedeEscribir` del módulo y el permiso de **cada** herramienta propuesta (`datosDeHerramienta`) |
| 6 | Plan: orígenes de captura `voz` y `texto` | `ORIGENES_DE_MOVIMIENTO` y el `CHECK` de `registro.movimientos.origen` no tienen `texto` | Borrador con origen `texto`; el movimiento que nace de él lleva `teclado` |
| 7 | Plan: un abono dictado queda trazado como voz | `deuda_abonar` escribe siempre `origen: 'teclado'` (`deudas-abonar.ts`) | s5b agrega `origen` opcional a `deuda_abonar` (aditivo) |
| 8 | El encargo pide «fechas relativas» entre las reglas portadas | Tairos.RC **no** las resuelve (plan §2.2; `vocabulario-imprenta.ts:63` solo lista «ayer» como palabra a ignorar) | Regla **nueva** y mínima (`fecha.ts`: ayer y anteayer), marcada como no portada |
| 9 | El encargo pide el tipo «deuda» entre las reglas | En Tairos.RC una deuda es una transacción cobrada a medias; no hay regla que diga «esto es una deuda» | Regla **nueva** `deuda.ts`, evaluada después de la de abono |
| 10 | Plan: reutilizar `sugerirPorHistorial` | Trabaja con las 16 categorías cerradas de Tairos.RC, no con ids de Capaz | s5b escribe la versión con ids usando las mismas constantes (2 registros, 60 %) |
| 11 | Plan D-I9: sinónimos hacia «las 8 de Capaz» | «Cobros» y «Pagos» son las categorías de los abonos (`categoriaDeAbono`) | La tabla usa las otras seis (§4.3 a) |
| 12 | Plan §2.3: `big.js` «en modo estricto (rechaza `number`)» | `precio-por-escala.ts` pasa por coma flotante en la curva (`Math.log`, `Math.exp`): `big.js` no tiene logaritmos. Cotizín lo documenta como su único punto así | ADR-017 §3 lo incluye en la excepción; los vectores de la curva lo vigilan; `frontera-del-motor` lo confina a un archivo |
| 13 | Plan §4.2: `igv_pct` configurable en el Cotizador | Pedidos fija `IGV_POR_DEFECTO = 18` y `pedido_crear` no recibe porcentaje | En B1 el Cotizador solo admite 18 o 0; con otro valor el puente avisa |
| 14 | Plan §4.2: `configuracion.unidades` como columna; §3.2: «lista fija en el contrato» | — | Lista fija `UNIDADES_SUGERIDAS`; sin columna |
| 15 | Plan §4.2: `version_lineas.opción (100, 1.000 o 5.000)` y «una línea por opción aceptada» | No define cómo se suman ni cómo se acepta | `versiones.con_opciones` y aceptar eligiendo posiciones (§10.2) |
| 16 | Plan §4.2: nueve herramientas en s1 | La pantalla de ajustes no tendría cómo leer la configuración ni los ajustes por cliente | Once: se agregan `cotizador_configuracion_ver` y `ajustes_cliente_listar` |
| 17 | Plan §4.2: `listas_de_precio.origen_version_id` y tablas del cuadro «en la misma migración si D-I2 lo aprueba» | D-I2 quedó en «B1 ya; B2 solo si el piloto lo pide» | `0024` trae solo B1; B2 tendrá su migración |
| 18 | Plan y encargo: la migración del Cotizador es la `0023` | El dueño ordenó que la ronda 3 de cuentas vaya antes y use la `0023` | `0024_cotizador`; la ola se lanza tras integrar esa ronda |
| 19 | Plan §4.4: «unas 176» y «unos 207» pruebas | Contadas en los archivos: 183 en las reglas (176 sin `categorias.test.ts`) y 284 en el cierre completo del motor | Las fichas dan la cuenta por archivo |
| 20 | Plan §2.1: `big.js` «no está» | Instalado: `big.js 7.0.1` y `@types/big.js 7.0.0` (commit `02693ae`) | Ya no bloquea a s0 |
| 21 | Manifiesto del Cotizador: «con enlace para el cliente y PDF» | El enlace público es B3 y no entra | s1 cambia la descripción |
| 22 | Plan §4.1: tarjeta de medición «en Inicio o en Reportes» | `core/inicio/**` no es de W11 | W11 la muestra en su pantalla; Inicio, por solicitud de cambio en X4 |
| 23 | `FICHAS-OLA-2.md` §9: los módulos «en construcción» bajan «de 8 a 5» | `core/modulos/catalogo.spec.ts` espera hoy 1 (solo el Cotizador) | X4 lo baja a 0 |
| 24 | `AGENTS.md`: «`docs/adr/` (001 a 015; la 015 está propuesta)» | Existen la 016 (aceptada) y ahora la 017 | Lo corrige el integrador en X4; no es de este encargo |
| 25 | Regla 10 (identificadores en español) frente a «portar tal cual» | Las reglas de Tairos.RC exportan nombres en inglés (`inferTipo`, `normalizeMontoToCentimos`) | Renombre mecánico con tabla (§4.1); las claves de `Extraccion` se quedan en `snake_case` |
| 26 | Regla 9: «nunca decimales en `number`» | Las reglas de Tairos.RC leen el monto dictado con `Number.parseFloat(…) * 100` y `Math.round` (`normalize-monto.ts`, p. ej. en `parseContratoConAdelanto`). Es lectura de un texto de hasta dos decimales, no aritmética de dinero, y sus pruebas lo fijan | Se porta tal cual (R21) y queda anotado en ADR-017 como parte de la excepción del porte; no se «arregla» en s5a |

## 12. Decisiones abiertas del dueño y de Keny

**Del dueño (Moisés)**

| # | Decisión | Recomendación | Qué espera |
|---|---|---|---|
| A-1 | **Pista V:** 30 a 50 dictados reales con su resultado correcto, y 10 registros cronometrados en Tairos.RC | Hacerla ya; no necesita código | Medir A1 fuera de línea y decidir A2 |
| A-2 | **A2 · modelo de lenguaje de pago**, solo si A1 no llega al 70 % | No decidir hasta tener la pista V. Si se abre: proveedor, tope mensual, y aceptar que el texto dictado sale hacia ese proveedor | A2 y su migración (`core.uso`) |
| A-3 | **Proveedor de voz** (grabar y subir a un servicio) | Seguir con el reconocimiento del navegador; abrirlo solo si la pista V o el piloto muestran que falla (iPhone, ruido) | Otra implementación de `ReconocedorDeVoz` |
| A-4 | **Piloto de tres trabajos en Cotizín**, tal como está | Hacerlo ya | B2 (cuadro por partes) |
| A-5 | Tabla de categorías del §4.3 (a) (D-I9): ¿las 8 de Capaz con esa correspondencia, o crear las 16 del rubro? | Las 8, con esa tabla | s5a (se construye así; cambiarla después es una tabla) |
| A-6 | Los precios de la lista y de la cotización se guardan **sin IGV** y el documento muestra precio, IGV y total (como en Cotizín); el pedido sigue con IGV incluido (D17) | Confirmar | DB5, s1, w1 |
| A-7 | Qué catálogos de Cotizín son reales y se importan (D-I6) | Solo los que confirmes; las 236 variantes estimadas, no | Importación (después) |
| A-8 | Enlace público con aprobar o rechazar (B3, D-I10) | Después | B3 y su migración |
| A-9 | Reglas de convivencia y apagado de Tairos.RC y Cotizín (D-I11) | Un solo sistema para el dinero desde el día 1 del piloto | El inicio del piloto |
| A-10 | Un cliente nuevo dictado obliga a «corregir» el borrador y baja el porcentaje sin corregir | Aceptarlo en A1 y mirarlo en `camposCorregidos`; si pesa, se propone crear el cliente dentro del mismo borrador | La lectura de la meta del 70 % |

**De Keny (técnicas)**

| # | Decisión | Recomendación |
|---|---|---|
| K-1 | **X1:** host, dominio con **HTTPS** y despliegue. Sin HTTPS el micrófono no funciona en el celular | Antes del piloto de voz; no bloquea la construcción |
| K-2 | Aplicar `0024_cotizador` en Neon (después de la `0023`) y revisar sus dos funciones de disparador | Con la sesión de Neon |
| K-3 | `captura_proponer` es del núcleo (exento de `puedeEscribir`) y comprueba dentro el acceso al módulo y el permiso de cada herramienta | Revisar a mano el diff de C3 (lista de integración, punto 6) |
| K-4 | `deuda_crear_con_adelanto` como herramienta nueva, en vez de dos borradores encadenados | Aprobar |
| K-5 | Campo `origen` opcional en `deuda_abonar` (cambio aditivo a un contrato integrado) | Aprobar |
| K-6 | A2: la llamada al modelo no puede ir **dentro** de la transacción de la herramienta (mantendría una conexión abierta durante una llamada de red). Hoy `ModeloNulo` responde al instante | Diseñarlo con A2: extraer antes de abrir la transacción |
| K-7 | El contexto de sistema de los consumidores sigue con permisos de administrador (`RELEVO.md`, punto 1); el puente solo propone | Sin cambio en esta ola |
| K-8 | Aviso de privacidad: con Web Speech el audio lo procesa el proveedor del navegador (Ley 29733) | Texto en la política antes del piloto |
| K-9 | ¿`pedido.confirmado` debe llevar el origen para marcar la cotización como «convertida»? | No en esta ola (cambia un contrato congelado) |
| K-10 | Las claves de `Extraccion` en `snake_case` dentro de `dictado/reglas/` (excepción acotada a la regla 10) | Aceptar, o pedir el renombre en un carril aparte |

## 13. Riesgos

| # | Riesgo | Efecto | Mitigación |
|---|---|---|---|
| 1 | Las reglas locales no llegan al 70 % con habla real y ruido | A1 no cumple la meta | Pista V y medición fuera de línea antes de decidir A2; `camposCorregidos` dice qué campo falla; el texto siempre disponible |
| 2 | Los intentos que no producen borrador no entran en `borradores_metricas` | El porcentaje se ve mejor de lo que es | Quedan en la auditoría como `captura_proponer` con `borradores: 0`; el piloto los cuenta aparte |
| 3 | Web Speech: exige HTTPS, falla en iPhone con Safari y manda el audio al proveedor del navegador | Sin piloto, o una queja de privacidad | X1 antes del piloto; Chrome en Android como canal; aviso en la política (K-8) |
| 4 | Un porte «casi igual» cambia un número | Cotizaciones con otro precio | R21: `cp`, comparador, cuenta por archivo y las seis comprobaciones de §5.2; el integrador lo repite |
| 5 | Dos aritméticas (texto decimal dentro del motor, enteros fuera) | Diferencias de un céntimo | Adaptador único que no redondea en silencio; `frontera-del-motor`; P1 del puente |
| 6 | La curva de precios usa coma flotante | Un céntimo distinto en otra máquina o versión de Node | Los 60 vectores de `vectores-de-curva.ts` (oráculo independiente) corren en cada `pnpm check` |
| 7 | El renombre con `sed` en s5a toca algo que no debía | Una regla rota en silencio | `\b` en ambos lados, las 183 pruebas y el comparador |
| 8 | El Cotizador cubre poco de lo que vende Atlantisgraf (≈ 9 %; el troquelado es el 61 %) | Construir algo que casi no se usa | Solo B1 ahora; B2 depende del piloto de tres trabajos |
| 9 | La ronda 3 cambia las pruebas de catálogo que DB5 también edita | Conflicto al integrar | DB5 se lanza **después** de integrar esa ronda |
| 10 | Un contacto mal resuelto asigna dinero a otra persona | Deuda en el cliente equivocado | Coincidencia exacta o única; con dos candidatos no elige; la tarjeta muestra el nombre y la persona aprueba |
| 11 | `borrador_corregir` llamado sin cambios | La medición marca «corregido» de más | W11 solo corrige si hay diferencia (función pura probada) |
| 12 | Cambios aditivos a contratos integrados (`registro`) | Carriles abiertos con el contrato viejo | Solo agregar; s5b es el único abierto sobre `registro` |
| 13 | IGV distinto de 18 % en una cotización | El pedido no cuadra con la cotización | B1 limita a 18 o 0 y el puente avisa |
| 14 | Presupuesto: w1 es grande (dos sesiones) | Quedarse a medias | La voz primero; si aprieta, se recorta `cotizacion_duplicar`, el ajuste por cliente y la marca «Revisar» |
| 15 | Texto dictado con datos personales en registros o eventos | Incumplir la Ley 29733 | R26; la auditoría de `captura_proponer` solo lleva números |

## 14. Lo no verificado

- No se ejecutó ninguna prueba ni compilación: ni de Capaz, ni de Cotizín, ni de Tairos.RC. Las cuentas de pruebas son estáticas (`grep`).
- Que `import Big from 'big.js'` compile con `module: nodenext` (se leyeron `package.json` y los tipos; s0 lo comprueba en su paso 1).
- Que `oxlint` acepte el código copiado sin cambios, y que las pruebas de Cotizín (escritas para Vitest 5) corran igual en Vitest 4.
- El SQL de los dos disparadores de §6.2 y lo que `drizzle-kit` genere para `numeric` y `smallint`: está escrito, no ejecutado.
- Qué devuelve `inferirContacto` para «le debo a Pacheco 500 de papel» (caso nuevo; por eso las tablas dicen «anotar lo que salga»).
- El contenido de la ronda 3 y de su migración `0023`: no existía al escribir esto.
- El reconocimiento de voz en un celular real (necesita HTTPS) y su comportamiento en iPhone.
- Las bases de Cotizín y de Tairos.RC, y los costos de cualquier servicio externo: no se consultaron.
- El comparador de R21 sí se probó, sobre copias temporales fuera del repositorio: da `IGUAL` con solo cambios de `import` y renombres, y `DISTINTO` al cambiar un esperado.

---
**Corrección del integrador (2026-11-16):** la tabla de §5.1 omitía `COT/src/lib/semillas/index.ts` (6 líneas: exporta `SEMILLAS = { PE: semillaEsPE }` y `SEMILLA_POR_DEFECTO`), que la prueba `semilla-es-pe.spec.ts` importa. Se copia como `domain/motor/base/semillas.ts` (57 archivos de código, no 56) y la prueba apunta a `./semillas.js`. Lo detectó el carril s0.
