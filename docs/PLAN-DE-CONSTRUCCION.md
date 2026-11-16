# Plan de construcción de Capaz ERP

**Versión 3.1 · 2026-11-15 (puerta entre la ola 1 y la ola 2) · Para: los agentes que construyen (Sonnet, esfuerzo medio), el integrador y quien supervisa.**

> **Qué cambió en la 3.1:** la ola 1 está construida e integrada (tablero, §8). Las fichas de las fases 14 a 16 quedaron **congeladas** en `docs/FICHAS-OLA-2.md` y las de las fases 17 a 20 **casi congeladas** en `docs/FICHAS-OLA-3.md`: esos dos documentos mandan sobre la tabla resumen de este (sección 7). Se corrigieron tres firmas de §6.2 que el código cambió con motivo, y se agregaron decisiones (D15 a D24) y riesgos nuevos (§10.1). Las secciones 3 y 7 conservan, como historial, la especificación con la que se construyó la ola 1.

Este documento dice **qué se construye, en qué orden y con qué especificación**. **Cómo se reparte entre varios agentes a la vez** (carriles, propiedad de archivos, integración, plantilla de brief) está en `PLAN-PARALELO.md`. El porqué está en `PLAN-CIMIENTOS.md`, `ARQUITECTURA-DE-MODULOS.md`, `ARQUITECTURA-DE-IA.md`, `PLATAFORMA-Y-PLANES.md`, `MODULOS-Y-MERCADO.md` y `docs/adr/`. Si algo choca, **manda este documento**; en lo que toca al trabajo simultáneo, manda `PLAN-PARALELO.md`. Las versiones 1 y 2 están en `docs/archivo/` solo como historial: no se siguen.

---

## 0. Cómo usar este plan

1. El trabajo se organiza en **fases** (qué) agrupadas en **carriles** (quién y dónde, `PLAN-PARALELO.md` §5). Una sesión de agente = un carril o una parte de carril. Un carril no empieza si sus dependencias no están **integradas en `main`**.
2. Al abrir la sesión se lee solo lo que indica el brief del carril (`PLAN-PARALELO.md` §7). No se relee el plan entero.
3. Al cerrar: comando de verificación del carril en verde y pegado en el informe. El agente de carril **no integra, no toca Neon y no instala dependencias**; hace commit en su rama solo si el brief dice que hay permiso.
4. Informe de cierre, siempre con este formato: **qué se hizo · qué se verificó (comando y resultado) · qué no se hizo y por qué · desviaciones del plan · solicitudes de cambio a archivos ajenos · revisión visual pendiente (lista de pantallas) · qué necesita el usuario**.
5. Si un paso no se puede cumplir como está escrito, **se para y se pregunta**; no se inventa un rodeo. Cada fase trae su «Parar y preguntar si».
6. **Lo que el constructor no puede comprobar, no lo da por comprobado.** La revisión visual es de una persona (regla 17): la fase queda «hecha, falta revisión visual» hasta que el usuario la confirme. Los recorridos por HTTP real (servidor en un puerto libre y `fetch` con cookies) sí los comprueba el constructor: son pruebas de integración del servidor, no e2e.
7. Los números de fase de la versión 2 **se conservan** (el código y otros documentos los citan); lo que cambia es el orden (sección 4). Las fases nuevas son P, D y 13 a 23.

## 1. Reglas del constructor (no negociables)

Las reglas 1 a 20 son las de `AGENTS.md`. Las 21 a 24 son nuevas y valen para todo carril.

1. **Las versiones instaladas son más nuevas que tu memoria.** Instaladas hoy (leído en los `package.json`): NestJS 12.4, React 19.3, React Router 8.5, Vite 8, Tailwind 4.3, Zod 4.6, TypeScript 6.0.3, Vitest 4.1, `drizzle-orm` 0.45, `drizzle-kit` 0.31, `pg` 8.23, `better-auth` 1.7. Antes de usar una API, léela en `node_modules/<paquete>` o en su documentación oficial (NestJS: `https://docs.nestjs.com/llms.txt`). No escribas de memoria.
2. **Una sola puerta a la base:** el código de negocio solo toca la base dentro de `conEmpresa(ctx, fn)`. Solo `infra/database` crea conexiones. Solo `infra/config` (servidor) y `scripts/config.ts` (scripts) leen `process.env`.
3. **Una sola puerta a las operaciones:** toda operación de negocio es una herramienta registrada y pasa por `ejecutar()`. No se abren rutas de Better Auth que hagan lo mismo por otro lado (lista blanca de `core/auth/rutas-permitidas.ts`).
4. **La empresa, el usuario y los permisos salen de la sesión del servidor.** Nunca de argumentos, cabeceras propias ni del cuerpo. En TypeScript: `empresaId`, `usuarioId`. `tenant_id` es solo la columna y la variable de sesión de la base.
5. **Toda tabla con `tenant_id` se protege** con `select core.aplicar_aislamiento('esquema.tabla')`, **toda llave foránea entre tablas con `tenant_id` es compuesta** (`(tenant_id, x_id)` → `(tenant_id, id)`) y **todo índice empieza por `tenant_id`** (salvo la clave primaria; ADR-013). Las pruebas de catálogo lo exigen.
6. **Nunca `drizzle-kit push`.** Solo `generate` más SQL a mano.
7. **Un módulo no importa a otro.** `core` no importa de `modules`. `infra` no importa de nadie. Una prueba lo exige.
8. **Sin e2e** (ni Playwright ni pruebas de navegador). Vitest unitarias y de integración contra PostgreSQL real.
9. **Dinero:** céntimos enteros (`bigint` en la base, `bigint(..., { mode: 'number' })` en Drizzle, tipo `Centimos` en TypeScript). Precios unitarios y cantidades en milésimas enteras (tipo `Milesimas`). Nunca decimales en `number`. Salida `S/ 1,234.50`.
10. **Nombres:** dominio y módulos en español sin tildes en identificadores; `infra/` en inglés; archivos en `kebab-case`; textos de pantalla y errores en español.
11. **Archivos de más de 500 líneas se dividen.** Funciones de más de 50, también.
12. **No se copia ni se traduce código de ningún otro ERP.** Tampoco textos, iconos, CSS, nombres de pantallas o componentes, marca, colores distintivos, cifras de diseño (tamaños, radios, curvas) ni maquetas casi idénticas. Las referencias (`docs/REFERENCIAS.md`) son solo lectura e inspiración de ideas genéricas de uso; todo se nombra, dibuja y mide de forma propia. **Ningún carril necesita abrir código de otro ERP para cumplir su plan.**
13. **Cotizín y Tairos.RC son de solo lectura.** Se porta desde la copia `/home/datayros/Documentos/work/referencias/cotizin-2026-11-14/`.
14. **No se activan servicios externos ni de pago** (monitoreo, correo, modelos de IA, mensajería, ramas de Neon) sin orden del usuario. Los conectores se prueban contra un servidor simulado local.
15. **No se agregan dependencias** fuera de las que nombra este plan. No se adoptan paquetes 0.x de NestJS.
16. **Secretos solo en `.env`** (ignorado por git). El servidor en ejecución **no recibe** la credencial del dueño de la base. No se imprimen ni se registran valores de `.env`.
17. **Pantallas móvil primero.** Cada pantalla nueva se revisa a 390 px y 1280 px, en claro y oscuro; la revisa una persona y el constructor deja la lista en el informe.
18. **Ninguna función `security definer` sobre tablas con RLS.** Lo que cruza empresas lo hace `capaz_sistema` con política y permisos explícitos, tabla por tabla y por columna cuando la tabla lleva datos de negocio.
19. **Las cuentas son globales:** nadie de una empresa cambia el correo ni la contraseña de otra persona.
20. **Un solo catálogo de códigos de error** (`packages/shared/src/codigos.ts`).
21. **Propiedad exclusiva:** un carril solo crea o modifica los archivos de su lista (`PLAN-PARALELO.md` §5). Si necesita tocar otro, lo escribe como «solicitud de cambio» en su informe y para.
22. **Solo el carril de datos (DB1, DB2, DB3) escribe migraciones, esquema de Drizzle y las listas de las pruebas de catálogo.** Ningún otro carril toca `apps/api/drizzle/**`, `apps/api/src/db/esquema/**` ni `drizzle.config.ts`.
23. **Los contratos congelados no se cambian** (sección 6): firmas exportadas de `packages/shared`, de `core/herramientas/tipos.ts`, de `core/eventos/tipos.ts` y del kit de interfaz. Un cambio lo hace el integrador.
24. **Solo el integrador** toca `package.json` (cualquiera), `pnpm-lock.yaml`, `apps/api/src/app.module.ts`, `apps/api/src/configurar-app.ts`, `apps/api/src/infra/**`, `.env.example`, `AGENTS.md` y `docs/PLAN-*.md`.

## 2. Qué cambió en la versión 3, y por qué

Decisiones del usuario del 2026-11-15, que no se discuten:

1. **Capaz es un ERP completo, de vanguardia, con apariencia tradicional y comportamiento de trabajador digital.** La estructura básica entera (núcleo, permisos, carcasa con menú por familias, consola, conectores, automatizaciones y módulos clásicos) se construye **antes** de adaptar el Registro por voz y el Cotizador, que dejan de ser el centro.
2. **ADR-014 aceptado.** Conectores y automatizaciones entran en la ola 1 (marco) en vez de la ola 2.
3. **Compras va en la ola 3 con Insumos.** El menú muestra desde la ola 1 las familias Ventas, Compras, Inventario, Finanzas y Personal, con lo no contratado bloqueado.
4. **Facturación SUNAT y contabilidad formal: al final o fuera.**
5. **Varios agentes Sonnet de esfuerzo medio construyen a la vez**, ceñidos a estos planes (`PLAN-PARALELO.md`).

Cambios de fondo frente a la versión 2:

| Versión 2 | Versión 3 |
|---|---|
| «Ruta al piloto»: cimientos mínimos → Registro por voz → piloto; eventos, consola y conectores después | Estructura completa (olas 1 a 3) → Registro por voz y Cotizador (ola 4) → piloto |
| Una fase por sesión, en serie | Carriles en paralelo con propiedad exclusiva de archivos, contratos congelados y un integrador |
| Cada fase escribía sus migraciones | **Un solo carril de datos** escribe todas las migraciones, por tandas (fase D) |
| Manifiesto sin familia; tres esquemas | Familias en el manifiesto y un esquema por módulo clásico (ADR-015, aceptado el 2026-11-15) |
| Borradores solo en el plan del Registro | **Bandeja de borradores en el núcleo** (fase 13): es lo que hace «trabajador digital» a todo el ERP |
| Tokens «Pliego» y fuentes fijadas en la fase 6a | Tokens **semánticos** con valores provisionales; la identidad visual se decide después sin rehacer nada (decisión D5) |
| Fase 3b con el cliente de React de Better Auth | Sin esa dependencia: la web llama por `fetch` a las rutas de la lista blanca (como ya hacen las pruebas de integración) |
| `precio_centimos` en productos | `precio_unitario_milesimas` (lo pide ADR-012; la versión 2 se contradecía) |

Se conserva de la versión 2 (y sigue vigente): las 20 reglas, el formato de informe, los «Hecho cuando» y «Parar y preguntar», el diseño de seguridad (cuatro roles, política sin `TO`, cero `security definer`, llaves compuestas, lista de plataforma por permitidos), el orden de comprobaciones de `ejecutar()`, la transacción única por llamada, el relevo sin sondeo fijo, la consola sin ver datos de negocio y el despliegue con restauración probada. El detalle histórico de por qué (errores de la versión 1, huecos cerrados, hallazgos verificados) está en `docs/archivo/PLAN-DE-CONSTRUCCION-v2.md`, sección 2.

## 3. Estado verificado (2026-11-15)

> **Al cerrar la ola 1 (misma fecha, noche):** integrados C0, DB1a, DB1b, S1 a S9 (con S5b), W1 a W10; falta X1. Migraciones `0000` a `0012`. Suite en `main` según el integrador: 437 de integración, 229 unitarias de `api`, 180 de `web`, 76 de `shared`; el arquitecto **no** la ejecutó en la puerta (solo leyó código). Nada probado en navegador ni contra Neon. Módulos: `registro`, `crm`, `ordenes`, `insumos`, `compras`, `personal`, `reportes` y `cotizador` siguen siendo solo manifiesto (`registro` ni siquiera tiene `registro.module.ts`); `webhooks` es el único con código. La tabla de abajo es el estado **anterior** a la ola 1.

Comprobado leyendo el código y las migraciones, no solo los documentos:

| Pieza | Estado | Evidencia |
|---|---|---|
| Fases 0, 1, 2, 3a (servidor) y 4 | **hechas** | `apps/api/src/{infra,core/auth,core/empresas,core/modulos,arquitectura,pruebas}`, `scripts/{config,preparar-base,migrar,plataforma}.ts`, `packages/shared/src/{respuesta,codigos,dinero,modulos,yo}.ts` |
| Migraciones | `0000` a `0005` en `apps/api/drizzle/` y en `meta/_journal.json` | 5 tablas con `tenant_id` (todas en `core`), 8 tablas de `auth`, vista `core.v_miembros`, 11 funciones |
| Pruebas unitarias | 40 en `shared`, 85 en `api`, 0 en `web` | **ejecutadas hoy** (`pnpm --filter … test`) |
| Pruebas de integración | 82 | **no ejecutadas hoy** (el contenedor `capaz-erp-db-1` está detenido); el recuento estático de los `*.int.spec.ts` coincide (9 + 21 + 17 + 5 + 7 + 6 + 17) |
| Neon al día con `0000`-`0005` | según `NEON-MIGRACION.md` §8 | **no verificado** aquí (el arquitecto no toca Neon) |
| Web | solo `pages/inicio.tsx` (pantalla de salud) y un `@theme` provisional | `apps/web/src/` tiene 3 archivos |
| Git | sin commits; todo sin seguimiento | `git status` |

No existe todavía: `core/herramientas`, `core/auditoria`, `core/eventos`, `core/clientes`, `core/plataforma`, `packages/shared/src/contratos/`, ninguna pantalla real, `docs/COMO-CREAR-UN-MODULO.md`. De la fase 4 falta `pnpm plataforma restablecer`.

## 4. Orden de construcción

```
OLA 1 · ESTRUCTURA DEL ERP
  Etapa P   P (andamiaje y contratos) → DB1a (datos: herramientas, eventos, maestros)
  Etapa A   servidor:  5a herramientas ─┬─ 7 maestros (herramientas) ─ 11b importar/exportar
            (en paralelo) 8 eventos ────┤─ 6b miembros
                         7 maestros     ├─ 13 borradores ─ 11a-2 automatizaciones
                         (dominio)      ├─ 9a plataforma
                                        └─ 11a-1 conexiones            (DB1b: datos de 9a, 11a, 13)
  Etapa B   web:  6a-1 base ─┬─ 6a-2 kit de datos ─┬─ 7 maestros · 13 bandeja · 9b consola · 11c conecta
                             ├─ 3b acceso          │
                             └─ 6a-3 carcasa ──────┴─ 5b herramientas en pantalla ─ 6b usuarios
  Cierre    uso interno en Atlantisgraf (clientes y productos importados) · puerta de revisión

OLA 2 · CLÁSICOS I        C1 · K1 · DB2a (0013, 0014) → 14 Finanzas (registro, tecleado) → DB2b (0015, 0016) → 15 CRM · 16 Pedidos
                          → pantallas de los tres · N1 (Inicio y bandeja con pendientes) · X2 (recorrido pedido → cobro)
OLA 3 · CLÁSICOS II       DB3 → 17 Inventario (insumos) · 18 Compras · 19 Personal · 20 Reportes
OLA 4 · ADAPTACIÓN        10a despliegue → 21 Registro por voz · 22 Cotizador · 23 puente → piloto de 30 días
OLA 5 · CRECER            10b endurecer · WhatsApp · pagos · Producción · Portal · Archivos · Mostrador · MCP
FINAL                     12 Facturación SUNAT (conector OSE/PSE). Contabilidad formal: no se construye.

Pista V   en paralelo desde hoy; la hace el usuario; sin código (ver abajo).
```

- **Puerta de revisión entre olas:** al cerrar cada ola, el arquitecto (Fable) revisa lo aprendido, corrige las fichas de la ola siguiente y las congela antes de lanzar carriles. **Puerta de la ola 2 pasada el 2026-11-15:** fichas en `docs/FICHAS-OLA-2.md` (congelada) y `docs/FICHAS-OLA-3.md` (casi congelada); rondas en `PLAN-PARALELO.md` §4.1.
- **Olas 2 y 3 en una línea:** primero los módulos clásicos con captura tecleada; los micro-productos Registro por voz y Cotizador se suben después (ola 4) y solo si encajan.
- **Cada ola termina con uso real**, aunque sea interno: ola 1, la empresa de Atlantisgraf con sus clientes y productos importados y sus usuarios; ola 2, caja y cuentas por cobrar a mano junto a Tairos.RC; ola 4, el piloto de voz medido (70 % sin corregir, 30 s por registro).
- **La fase 10a puede adelantarse** en cuanto el usuario decida el alojamiento (D7): sirve para revisar pantallas desde el celular por HTTPS. Es obligatoria antes de datos reales y antes de probar la voz.
- **ADR-015 quedó aprobado el 2026-11-15** (D2): las olas 2 y 3 ya no esperan por él. ADR-016 (reglas de los módulos clásicos) está propuesto (D21).

**Pista V · Validar la voz con audios reales (usuario, en paralelo, sin código).** Sigue siendo el mayor riesgo del producto y ahora tiene más tiempo:
1. Cronometrar 10 registros reales con el método actual: es la línea base de los 30 segundos.
2. Grabar entre 30 y 50 dictados reales en el taller, con el ruido de siempre, y anotar para cada uno lo correcto (monto, tipo, contacto, categoría).
3. Guardarlos **fuera del repositorio** (son datos personales), por ejemplo en `/home/datayros/Documentos/work/referencias/voz-taller/`.
Probarlos contra servicios de reconocimiento es parte de la fase 21 y necesita orden del usuario (regla 14).

## 5. Estructura de carpetas objetivo

```
apps/api/
  drizzle/                    migraciones (solo el carril de datos)
  scripts/                    config.ts, preparar-base.ts, migrar.ts, plataforma.ts
  src/
    main.ts  app.module.ts  configurar-app.ts
    infra/                    config/ logger/ database/ http/ health/
    db/esquema/               un archivo por tanda de datos (solo el carril de datos)
    core/
      auth/  empresas/  modulos/                          hechos
      herramientas/  auditoria/                           fase 5a
      eventos/  correlativos/                             fase 8
      clientes/  productos/  sucursales/                  fase 7
      miembros/                                           fase 6b
      borradores/                                         fase 13
      plataforma/                                         fase 9a
      conectores/  automatizaciones/  intercambio/        fases 11a, 11b
    modules/
      registro/ crm/ ordenes/ insumos/ compras/ personal/ reportes/ webhooks/ cotizador/
                              ola 1: solo manifiesto y módulo vacío; se llenan en su ola
    pruebas/  arquitectura/
apps/web/src/
  main.tsx
  app/                        rutas.tsx, proveedores.tsx, carcasa/
  shared/                     estilos/ ui/ api/ sesion/ formato/     (no importa de core, modules ni app)
  core/                       acceso/ inicio/ ajustes/ clientes/ productos/ bandeja/ conecta/ automatizaciones/
  modules/                    registro/ crm/ ordenes/ insumos/ compras/ personal/ reportes/ cotizador/
  plataforma/                 consola (fase 9b)
packages/shared/src/
  respuesta.ts codigos.ts dinero.ts modulos.ts yo.ts          hechos (P amplía modulos, yo y dinero)
  herramientas.ts listado.ts conectores.ts                    fase P
  contratos/                  index.ts + un archivo por área: herramienta → { entrada, salida } y evento → carga
```

## 6. Especificaciones congeladas

Lo de esta sección se escribe **una vez** (fases P y D) y después nadie lo cambia sin pasar por el integrador. Los carriles programan contra estas firmas aunque la implementación de otro carril todavía no esté integrada.

### 6.1 Contratos en `@capaz/shared` (los crea la fase P)

```ts
// modulos.ts · se agrega
export const FAMILIAS = ['ventas', 'compras', 'inventario', 'produccion', 'finanzas', 'personal', 'analisis', 'conexiones'] as const;
export type Familia = (typeof FAMILIAS)[number];
/** Las que el menú muestra siempre, tengan o no módulos contratados. */
export const FAMILIAS_CLASICAS = ['ventas', 'compras', 'inventario', 'finanzas', 'personal'] as const;
export const NOMBRE_DE_FAMILIA: Record<Familia, string>;  // 'Ventas', 'Compras', 'Inventario', 'Producción', 'Finanzas', 'Personal', 'Análisis', 'Conexiones'
// manifiestoDeModuloSchema gana:  familia: z.enum(FAMILIAS).nullable()   (nulo SOLO en `core`; superRefine lo exige)
//                                 orden:   z.number().int().min(0).default(0)   (posición dentro de la familia)
// yo.ts · moduloDeYoSchema gana:  familia: z.enum(FAMILIAS)  ·  orden: z.number().int()

// dinero.ts · se agrega
export const milesimasSchema = z.number().int().safe().brand<'Milesimas'>();
export type Milesimas = z.infer<typeof milesimasSchema>;
/** cantidad (milésimas) × precio unitario (milésimas) → céntimos, al céntimo más cercano (mitad hacia arriba). Calcula con BigInt. */
export function importe(cantidadMilesimas: number, precioUnitarioMilesimas: number): Centimos;

// listado.ts · nuevo
export const paginaSchema = z.strictObject({ limite: z.number().int().min(1).max(100).default(25), cursor: z.string().max(200).optional() });
export const listadoSchema = <T extends z.ZodType>(item: T) => z.strictObject({ items: z.array(item), siguiente: z.string().nullable() });
// Toda herramienta `*_listar` recibe paginaSchema.extend({ buscar?, incluirArchivados?, …filtros }) y devuelve listadoSchema(item).

// herramientas.ts · nuevo
export const CRITICIDADES = ['lectura', 'normal', 'critica'] as const;   // los nombres de Cotizín
export type Criticidad = (typeof CRITICIDADES)[number];
export const CANALES = ['ui', 'agente', 'mcp', 'sistema'] as const;
export type Canal = (typeof CANALES)[number];
export const ARGUMENTOS_DE_CONTEXTO = ['empresaId', 'empresa_id', 'tenantId', 'tenant_id', 'usuarioId', 'usuario_id', 'permisos', 'canal', 'contexto', 'ctx'] as const;
export const ayudaSchema;            // portado tal cual de cotizin/src/shared/herramientas/tipos.ts
export type Ayuda = z.infer<typeof ayudaSchema>;
export type ContratoDeHerramienta<E extends z.ZodType = z.ZodType, S extends z.ZodType = z.ZodType> = { entrada: E; salida: S };
export const contrato: <E extends z.ZodType, S extends z.ZodType>(entrada: E, salida: S) => ContratoDeHerramienta<E, S>;
/** Cuerpo de POST /api/v1/herramientas/:nombre (ADR-009). */
export const cuerpoDeHerramientaSchema = z.strictObject({ args: z.unknown().optional(), confirmacion: z.string().min(1).optional() });

// conectores.ts · nuevo (ADR-014)
export type ManifiestoDeConector = {
  codigo: string; nombre: string; descripcion: string; version: string;
  capacidades: readonly string[];                       // 'importar_clientes', 'enviar_mensaje', …
  autenticacion: 'clave_api' | 'oauth2' | 'ninguna';
  configuracion: z.ZodType;                             // lo NO secreto
  credenciales: z.ZodType;                              // lo secreto: se cifra, nunca sale
  herramientas: readonly string[]; escucha: readonly string[]; emite: readonly string[];
};

// contratos/index.ts · nuevo. Un archivo por área; cada uno exporta `contratosDe<Area>` y `eventosDe<Area>`
// (al crearse, `{} as const`). Áreas: empresa, modulos, auditoria, miembros, clientes, productos, sucursales,
// borradores, conexiones, automatizaciones, intercambio, plataforma, registro, crm, ordenes, insumos,
// compras, personal, reportes, cotizador.
export const CONTRATOS = { ...contratosDeEmpresa, /* …todas menos plataforma… */ } as const satisfies Record<string, ContratoDeHerramienta>;
export const CONTRATOS_DE_PLATAFORMA = { ...contratosDePlataforma } as const satisfies Record<string, ContratoDeHerramienta>;
export const EVENTOS = { ...eventosDeClientes, /* … */ } as const satisfies Record<string, z.ZodType>;
export type NombreDeHerramienta = keyof typeof CONTRATOS;
export type EntradaDe<N extends NombreDeHerramienta> = z.input<(typeof CONTRATOS)[N]['entrada']>;
export type ArgsDe<N extends NombreDeHerramienta> = z.output<(typeof CONTRATOS)[N]['entrada']>;
export type SalidaDe<N extends NombreDeHerramienta> = z.output<(typeof CONTRATOS)[N]['salida']>;
export type TipoDeEvento = keyof typeof EVENTOS;
export type CargaDe<T extends TipoDeEvento> = z.output<(typeof EVENTOS)[T]>;
```

`packages/shared/src/index.ts` reexporta todo con `export * from './contratos/index.js'` y `contratos/index.ts` con `export * from './<area>.js'`: **un carril que agrega un contrato solo edita su archivo de área.** Convenciones: nombre de herramienta `entidad_accion` en minúsculas (`clientes_crear`); nombre de evento `entidad.hecho` (`cliente.creado`); esquemas `z.strictObject`; ids `z.uuid()`; dinero con `centimosSchema` o `milesimasSchema`; fechas `z.iso.datetime()`.

### 6.2 Contratos del servidor (firmas; P crea los tipos, cada fase la implementación)

```ts
// core/herramientas/tipos.ts  (P)
export type ContextoDeHerramienta = Readonly<{
  requestId: string; empresaId: string; usuarioId: string;      // 'sistema' cuando no hay persona
  rol: string | null; permisos: readonly string[]; modulos: readonly AccesoDeModulo[]; canal: Canal;
}>;
export type Resumen = { resumen: string; huella: string };       // huella = estado sobre el que se confirma
export type DatosDeAuditoria = { entidadTipo?: string; entidadId?: string; resumen?: Record<string, string | number | boolean | null> };
export type Herramienta<N extends NombreDeHerramienta> = {
  modulo: string;                       // código de manifiesto; 'core' para el núcleo
  permiso: string | null;               // debe estar en el manifiesto de `modulo`
  criticidad: Criticidad;
  idempotente?: boolean;                // acepta la cabecera Idempotency-Key
  mueveDinero?: boolean;                // una regla automática nunca la ejecuta en modo `automatico`
  ayuda: Ayuda;
  resumir?: (args: ArgsDe<N>, ctx: ContextoDeHerramienta, tx: Transaccion) => Promise<{ ok: true; resumen: Resumen } | { ok: false; error: ErrorDeRespuesta }>;  // obligatorio si es crítica
  auditar?: (args: ArgsDe<N>, datos: SalidaDe<N> | null) => DatosDeAuditoria;   // solo campos seguros
  ejecutar: (args: ArgsDe<N>, ctx: ContextoDeHerramienta, tx: Transaccion) => Promise<Respuesta<SalidaDe<N>>>;
};
export type HerramientaRegistrada;      // la misma sin tipos concretos, con `nombre`, `entrada` y `salida` tomados de CONTRATOS
export function definirHerramienta<N extends NombreDeHerramienta>(nombre: N, h: Herramienta<N>): HerramientaRegistrada;

// core/herramientas/registro.ts  (P)
@Injectable() export class RegistroDeHerramientas {            // global
  agregar(herramientas: readonly HerramientaRegistrada[]): void;   // lanza si un nombre se repite
  obtener(nombre: string): HerramientaRegistrada | undefined;
  todas(): readonly HerramientaRegistrada[];
  // Al terminar el arranque valida: cada herramienta tiene contrato y cada contrato herramienta; el módulo existe;
  // el permiso está en el manifiesto de ese módulo; críticas con `resumir`; ayuda válida. Si falla, el servidor no arranca.
}
// Cada área registra las suyas desde un proveedor propio de Nest:
//   @Injectable() class HerramientasDeClientes implements OnModuleInit { constructor(registro, …) {}  onModuleInit() { this.registro.agregar([...]) } }

// core/herramientas/ejecutor.ts  (fase 5a)
@Injectable() export class EjecutorDeHerramientas {
  ejecutar(nombre: string, args: unknown, opciones: { ctx: ContextoDeHerramienta; confirmacion?: string; claveDeIdempotencia?: string }): Promise<Respuesta<unknown>>;
  /** Para una herramienta que ejecuta otra (bandeja de borradores): mismas comprobaciones y auditoría, dentro de la transacción
   *  de quien llama. Si responde rechazo, quien llama debe responder ese mismo rechazo: así se revierte todo junto. */
  ejecutarDentro(tx: Transaccion, nombre: string, args: unknown, opciones: { ctx: ContextoDeHerramienta; confirmacion?: string }): Promise<Respuesta<unknown>>;
}

// core/modulos/acceso.service.ts  (P; extraído de core/auth/guardia.ts, que pasa a usarlo)
@Injectable() export class ServicioDeAcceso {
  /** Rol, módulos y permisos vigentes de una persona en una empresa. Nulo si ya no es miembro. */
  contextoDe(empresaId: string, usuarioId: string, canal: Canal, requestId: string): Promise<ContextoDeHerramienta | null>;
}

// core/eventos/tipos.ts  (P) · implementación en la fase 8
export type EventoEntregado = { id: string; tipo: TipoDeEvento; carga: unknown; creadoEn: Date };
export type Consumidor = { nombre: string; modulo: string; evento: TipoDeEvento | '*'; manejar: (e: EventoEntregado, ctx: ContextoDeHerramienta, tx: Transaccion) => Promise<void> };
export type TareaPeriodica = { nombre: string; cadaSegundos: number; ejecutar: () => Promise<void> };
// core/eventos/emisor.ts  (fase 8)
export function emitir<T extends TipoDeEvento>(tx: Transaccion, tipo: T, carga: CargaDe<T>): Promise<void>;   // exige la transacción de conEmpresa
@Injectable() export class RegistroDeConsumidores { agregar(c: readonly Consumidor[]): void }
@Injectable() export class RegistroDeTareas { agregar(t: TareaPeriodica): void }
// core/correlativos/siguiente-numero.ts  (fase 8)
export function siguienteNumero(tx: Transaccion, clave: string, opciones: { serie?: string; anio: number }): Promise<number>;   // `anio` obligatorio (así quedó en S2)

// core/borradores/proponer.ts  (fase 13)
export function proponerBorrador(tx: Transaccion, b: {
  herramienta: NombreDeHerramienta; args: unknown; resumen: string;
  origen: 'voz' | 'texto' | 'agente' | 'regla' | 'conector' | 'importacion' /* + 'modulo' desde C1, ola 2 */; origenRef?: string;
  prioridad?: 'normal' | 'alta'; propuestoPor: string; capturaIniciadaEn?: Date;
}): Promise<{ id: string }>;

// core/automatizaciones/tipos.ts  (fase 11a-2)
export type FuenteDeTiempo = {              // «N días después de una fecha»: cada módulo declara las suyas
  clave: string; modulo: string; descripcion: string;       // p. ej. 'registro.deuda_vence'
  candidatos: (tx: Transaccion, hoy: Date) => Promise<Array<{ entidadTipo: string; entidadId: string; fecha: Date; datos: Record<string, unknown> }>>;
};
@Injectable() export class RegistroDeFuentesDeTiempo { agregar(f: readonly FuenteDeTiempo[]): void }
```

**Cómo quedó tras la ola 1 (manda el código):** `ejecutarDentro` corre la herramienta en un punto de guardado registrado como transacción en curso, así que dentro de ella valen `emitir` y `siguienteNumero`; el ejecutor reenvía la petición de confirmación de una herramienta crítica propuesta (borradores); `proponerBorrador` rechaza las herramientas de `HERRAMIENTAS_CON_SECRETOS`; el relevo entrega a los consumidores un contexto de sistema calculado **como administrador** de la empresa (`usuarioId: 'sistema'`, `canal: 'sistema'`), por lo que un consumidor de módulo solo propone borradores (`FICHAS-OLA-2.md` R5); en la comprobación de módulo, `core` está **eximido** de `puedeEscribir` (lo que un `member` escribe en el núcleo lo decide el permiso) y cualquier otro módulo no. Ayudantes nuevos de la ola 2 (los crea C1): `alcanceDe` y `hoyDeLaEmpresa`.

Variables de entorno nuevas (P las agrega a `infra/config/config.ts` y a `.env.example`; nadie más toca ese archivo): `RELEVO_ACTIVO` (booleano, por defecto `true`; las pruebas lo ponen en `false`), `RELEVO_BARRIDO_SEGUNDOS` (60), `CONEXIONES_CLAVE` (32 bytes en base64; opcional hasta la fase 11a, entonces obligatoria en producción), `CONEXIONES_CLAVE_VERSION` (entero, 1), `PERMITIR_DESTINOS_LOCALES` (booleano, `false`; solo las pruebas lo activan para el servidor simulado).

### 6.3 Contratos de la interfaz (los crea la fase 6a-1)

**Tokens semánticos** (`apps/web/src/shared/estilos/tokens.css`, único lugar con valores de color, tipografía y medida). Los componentes solo usan estos nombres; la paleta por defecto de Tailwind se anula (`--color-*: initial`). La identidad visual (D5) cambia **solo los valores de este archivo**.

| Grupo | Tokens |
|---|---|
| Superficies | `fondo`, `superficie`, `superficie-alta`, `borde`, `borde-fuerte` |
| Texto | `texto`, `texto-suave`, `texto-inverso` |
| Acción y estados | `accion`, `accion-texto`, `peligro`, `aviso`, `exito`, `info`, `foco` |
| Menú | `menu`, `menu-texto`, `menu-activo` |
| Acento por módulo (campo `acento` del manifiesto) | `acento-esmeralda`, `acento-cian`, `acento-ambar`, `acento-rosa`, `acento-gris` |
| Tipografía y medida | `--font-sans`, `--font-titulo`, `--font-mono`, `--alto-control`, `--radius-control`, `--radius-tarjeta`, `--shadow-elevada` |

Valores provisionales propios hasta D5 y fuentes del sistema (`system-ui`): no se instala ninguna fuente todavía. Tema por atributo `data-tema` en `<html>` (`claro`, `oscuro`; `sistema` lo resuelve un script en línea antes del primer pintado).

**Kit** (`apps/web/src/shared/ui/`, un archivo por pieza, nombres propios). Firma de propiedades congelada al integrarse cada carril:

| Carril | Piezas |
|---|---|
| 6a-1 base | `Boton` (`variante: 'primario' \| 'secundario' \| 'fantasma' \| 'peligro'`, `tamano`, `cargando`, `icono`), `Campo` (`etiqueta`, `error`, `ayuda` + `<input>`), `CampoMonto` (valor en céntimos), `CampoSelect` (nativo), `Dialogo`, `HojaInferior`, `Insignia` (`tono`), `EstadoVacio`, `Esqueleto`, `Icono` (SVG propios en `iconos.tsx`), `notificar()`, `confirmar()` |
| 6a-2 datos | `EncabezadoDePagina` (título, migas, acción principal, acciones secundarias), `Lista<T>` (columnas tipadas; tabla en escritorio, tarjetas en móvil), `CargarMas` (cursor), `BarraDeBusqueda`, `Ficha` (secciones; modos lectura y edición), `BarraDeEstado` (pasos), `MenuDeAcciones` (`popover` nativo), `Pestanas` |

**Cliente y sesión** (`shared/api`, `shared/sesion`):

```ts
// shared/api/cliente.ts (6a-1): nunca lanza; una caída de red es el rechazo `sin_conexion`
export function pedir<S extends z.ZodType>(metodo: 'GET' | 'POST', ruta: string, esquema: S, cuerpo?: unknown): Promise<Respuesta<z.output<S>>>;
// shared/api/herramientas.ts (5b): tipado por CONTRATOS, cola en serie para escrituras, misma Idempotency-Key en los reintentos
export function llamar<N extends NombreDeHerramienta>(nombre: N, args: EntradaDe<N>, opciones?: { confirmacion?: string }): Promise<Respuesta<SalidaDe<N>>>;
// shared/sesion/ (6a-1)
export function cargarYo(): Promise<Respuesta<Yo>>;
export function destinoSegunSesion(yo: Yo | null, ruta: string): string | null;   // guarda pura: adónde redirigir, o nulo
export function puede(yo: Yo, permiso: string): boolean;
```

**Registro de pantallas:** cada área o módulo exporta `rutas` desde su `rutas.tsx` (`core/<area>/rutas.tsx`, `modules/<codigo>/rutas.tsx`, `plataforma/rutas.tsx`); `app/rutas.tsx` las importa todas con carga diferida. La fase 6a-1 crea esos archivos vacíos para todas las áreas: después nadie más toca `app/rutas.tsx`.

### 6.4 Datos de la ola 1 (los crea la fase D; números de migración orientativos)

Convenciones para todas: `id uuid` con `default uuidv7()` salvo que se diga otra clave; `tenant_id text not null`; `timestamptz` con `default now()`; `unique (tenant_id, id)` en toda tabla que otra referencie; llaves foráneas compuestas; índices que empiezan por `tenant_id`; entidades del núcleo con `datos_extra jsonb not null default '{}'`; `actualizado_en` con el disparador `core.tocar_actualizado_en`. «Modo» es el segundo argumento de `core.aplicar_aislamiento`. «Plataforma» es lo que recibe `capaz_sistema` (nada, si no se dice).

**Tanda DB1a**

`0006_herramientas`
- `core.auditoria` · modo `insercion` · disparador `core.rechazar_cambio` en `update` y `delete` · sin llaves foráneas (particionable) · columnas: `usuario_id text not null`, `modulo`, `herramienta`, `canal` (`ui|agente|mcp|sistema`), `resultado` (`ok|rechazada|pendiente_confirmacion`), `codigo text null`, `hash_args text not null`, `entidad_tipo`, `entidad_id text` (nulos), `resumen jsonb not null default '{}'`, `request_id`, `duracion_ms integer not null default 0`, `creado_en` · índices `(tenant_id, creado_en desc)` y `(tenant_id, entidad_tipo, entidad_id, creado_en desc)`.
- `core.confirmaciones_usadas` · clave `(tenant_id, jti)` · `usado_en` · modo `insercion` · plataforma: `delete` y lectura de `(tenant_id, usado_en)` para la purga.
- `core.idempotencia` · clave `(tenant_id, clave)` · `herramienta`, `hash_args`, `respuesta jsonb null` (nulo mientras la primera petición está en curso), `creado_en` · modo `completo` · plataforma: `delete` y lectura de `(tenant_id, creado_en)`.

`0007_eventos_y_contadores`
- `core.eventos_salida` · `tipo`, `carga jsonb not null`, `creado_en`, `disponible_en default now()`, `procesado_en`, `intentos integer not null default 0`, `ultimo_error`, `fallido_en` · índice parcial `(tenant_id, disponible_en) where procesado_en is null and fallido_en is null` · modo `insercion` · plataforma: lectura de `(id, tenant_id, tipo, creado_en, disponible_en, procesado_en, intentos, fallido_en)`, `update (disponible_en, procesado_en, intentos, ultimo_error, fallido_en)` y `delete`. **`capaz_sistema` no puede leer `carga`.**
- `core.eventos_procesados` · clave `(tenant_id, evento_id, consumidor)` · `procesado_en` · modo `insercion` · sin llave foránea · plataforma: `delete` y lectura de `(tenant_id, procesado_en)`.
- `core.contadores` · clave `(tenant_id, clave, serie, anio)` con `serie text not null default ''` · `ultimo bigint not null default 0` · modo `completo`.

`0008_datos_maestros`
- `core.clientes` · `tipo` (`cliente|proveedor|ambos`, por defecto `cliente`), `clase` (`persona|empresa`), `nombre`, `nombre_normalizado text not null`, `documento_tipo` (`dni|ruc|ce|pasaporte|otro`, nulo), `documento_numero`, `telefono`, `correo`, `direccion`, `notas`, `datos_extra`, `fusionado_en uuid null` (llave compuesta a la misma tabla), `archivado_en`, `creado_por text not null`, `creado_en`, `actualizado_en` · único `(tenant_id, nombre_normalizado) where fusionado_en is null` (un archivado conserva su nombre; un fusionado lo libera) · único `(tenant_id, documento_tipo, documento_numero) where documento_numero is not null and fusionado_en is null` · índice de parecido `using gin (tenant_id gin_trgm_ops, nombre_normalizado gin_trgm_ops) where archivado_en is null` (lleva `tenant_id` delante para cumplir la prueba de índices) · modo `completo`.
- `core.productos` · `codigo text null`, `nombre`, `nombre_normalizado`, `tipo` (`producto|servicio`), `unidad text not null default 'unidad'`, `precio_unitario_milesimas bigint not null default 0` (≥ 0), `afecto_igv boolean not null default true`, `descripcion`, `datos_extra`, `archivado_en`, `creado_por`, `creado_en`, `actualizado_en` · único `(tenant_id, nombre_normalizado) where archivado_en is null` · único `(tenant_id, codigo) where codigo is not null` · índice de parecido como en clientes · modo `completo`.
- `core.sucursales` · `codigo text not null` (2 a 6 letras o cifras en mayúsculas; sirve de serie), `nombre`, `direccion`, `telefono`, `es_principal boolean not null default false`, `archivado_en`, `creado_en`, `actualizado_en` · único `(tenant_id, codigo)` · único `(tenant_id) where es_principal` · modo `completo`.

**Tanda DB1b**

`0009_plataforma`
- `core.auditoria_plataforma` (sin `tenant_id`: no es de ninguna empresa) · `actor_usuario_id text not null`, `herramienta`, `empresa_id text null`, `resultado` (`ok|rechazada`), `codigo`, `resumen jsonb`, `request_id`, `creado_en` · disparador de solo inserción · permisos: `select, insert` solo para `capaz_sistema`.
- Vista `core.v_empresas_plataforma` (del dueño): `empresa_id`, `nombre`, `alta_en`, `miembros` (conteo), desde `auth.organization` y `auth.member` · `grant select` a `capaz_sistema`.
- `select core.abrir_a_plataforma('core.auditoria', null, 'tenant_id, creado_en')`: última actividad por empresa, nada más.

`0010_conexiones` (ADR-014)
- `core.conectores` (catálogo, sin `tenant_id`) · clave `codigo` · `nombre`, `descripcion`, `version`, `capacidades text[]`, `autenticacion` (`clave_api|oauth2|ninguna`), `activo`, `creado_en` · lee `capaz_app` y `capaz_sistema`; escribe `capaz_sistema` (se sincroniza al arrancar).
- `core.conexiones` · `conector` (→ `core.conectores`), `estado` (`pendiente|activa|con_error|desactivada`), `configuracion jsonb`, `credenciales_cifradas text null`, `clave_version smallint null`, `ultimo_error`, `ultimo_uso_en`, `creado_por`, `creado_en`, `actualizado_en` · único `(tenant_id, conector)` · modo `completo` · plataforma: lectura de `(id, tenant_id, conector, estado, ultimo_uso_en, creado_en)`. **Nunca las credenciales.**
- `core.referencias_externas` · `conector`, `entidad`, `id_interno text`, `id_externo text`, `creado_en` · único `(tenant_id, conector, entidad, id_externo)` · índice `(tenant_id, conector, entidad, id_interno)` · modo `completo`.
- `core.sincronizaciones` · `conector text not null` (`archivo` para CSV), `conexion_id uuid null` (compuesta), `tipo` (`importar|exportar|sincronizar`), `entidad`, `estado` (`en_curso|ok|con_errores|fallida`), `cursor`, `total`, `procesados`, `errores jsonb not null default '[]'`, `iniciado_por`, `iniciado_en`, `terminado_en` · índice `(tenant_id, iniciado_en desc)` · modo `completo`.
- `core.claves_api` · **clave primaria `hash text`** (SHA-256 de la clave; así la búsqueda entre empresas no necesita un índice sin `tenant_id`) · `id uuid not null default uuidv7()` con único `(tenant_id, id)`, `nombre`, `prefijo text not null`, `alcance text[] not null default '{}'`, `creado_por`, `creado_en`, `ultimo_uso_en`, `revocada_en` · modo `completo` · plataforma: lectura de `(hash, tenant_id, id, alcance, revocada_en)` y `update (ultimo_uso_en)`.
- `core.webhooks_entrantes` · `clave_api_id uuid not null`, `evento text not null`, `clave_idempotencia text not null`, `carga jsonb not null`, `recibido_en`, `procesado_en`, `error` · único `(tenant_id, clave_api_id, clave_idempotencia)` · índice `(tenant_id, recibido_en desc)` · modo `completo`.
- `core.webhooks_salientes` · `nombre`, `url`, `eventos text[] not null`, `secreto_cifrado text not null`, `clave_version smallint not null`, `activo boolean not null default true`, `creado_por`, `creado_en`, `actualizado_en`, `ultimo_envio_en`, `ultimo_error` · modo `completo`.
- `core.webhooks_envios` · `webhook_id uuid not null` (compuesta), `evento_id uuid not null`, `tipo`, `estado` (`pendiente|enviado|fallido`), `intentos`, `codigo_http integer null`, `ultimo_error`, `creado_en`, `enviado_en` · único `(tenant_id, webhook_id, evento_id)` · índice `(tenant_id, estado, creado_en desc)` · modo `completo`.

`0011_automatizaciones_y_borradores`
- `core.borradores` · `herramienta`, `modulo`, `args jsonb not null`, `args_originales jsonb not null`, `resumen text not null`, `origen` (`voz|texto|agente|regla|conector|importacion`), `origen_ref`, `prioridad` (`normal|alta`), `estado` (`pendiente|aprobado|descartado`), `corregido boolean not null default false`, `propuesto_por`, `propuesto_en`, `captura_iniciada_en`, `resuelto_por`, `resuelto_en`, `motivo_descarte`, `entidad_tipo`, `entidad_id` · índices `(tenant_id, estado, propuesto_en desc)` y `(tenant_id, modulo, estado)` · modo `completo` (el código nunca borra).
- `core.reglas_automaticas` · `nombre`, `descripcion`, `activa boolean not null default false`, `disparador_tipo` (`evento|tiempo|webhook|manual`), `disparador jsonb not null`, `condiciones jsonb not null default '[]'`, `acciones jsonb not null`, `modo` (`borrador|pide_aprobacion|automatico`, por defecto `borrador`), `limite_diario integer not null default 50` (> 0), `creado_por`, `creado_en`, `actualizado_en`, `archivado_en` · índice `(tenant_id, activa, disparador_tipo)` · modo `completo` · plataforma: lectura de `(id, tenant_id, activa, disparador_tipo)` (para saber en qué empresas evaluar las reglas por tiempo).
- `core.reglas_ejecuciones` · `regla_id` (compuesta), `disparado_por jsonb not null`, `simulada boolean not null default false`, `resultado` (`ok|rechazada|omitida_por_limite|borrador_creado|sin_coincidencia`), `detalle jsonb`, `borrador_id uuid null`, `creado_en` · índices `(tenant_id, regla_id, creado_en desc)` y `(tenant_id, creado_en desc)` · modo `insercion`.
- `core.reglas_disparos` · clave `(tenant_id, regla_id, clave)` (`clave` = entidad y fecha: una regla por tiempo dispara una sola vez por entidad) · `creado_en` · modo `insercion`.

Los esquemas `crm`, `ordenes`, `insumos`, `compras` y `personal` **no se crean en la ola 1** (tandas DB2 y DB3, tras aprobar ADR-015).

## 7. Fases

Tamaños para un Sonnet de esfuerzo medio: **S** media sesión, **M** una sesión, **L** dos sesiones (el carril ya viene partido). El carril de cada fase está entre corchetes.

---

### Fases 0, 1, 2, 3a y 4 · hechas

Repositorio y reglas (0), infraestructura del servidor (1), base, roles y aislamiento (2), identidad y empresas en el servidor (3a), módulos, contratación y permisos (4). El código manda; sus pasos originales están en `docs/archivo/PLAN-DE-CONSTRUCCION-v2.md`. Pendiente menor de la fase 4: `pnpm plataforma restablecer` (se hace en la fase 9a).

---

### Fase P · Andamiaje y contratos para el trabajo en paralelo (M) [C0] · va primero y sola

**Objetivo:** que después de esta fase ningún carril tenga que tocar un archivo compartido.

**Entrega**
1. `@capaz/shared`: todo lo de la sección 6.1, con pruebas unitarias (familia obligatoria salvo en `core`; `importe` con casos de redondeo y montos grandes; `paginaSchema`; ningún nombre repetido entre los archivos de `contratos/`).
2. Manifiestos: `familia` y `orden` en `registro` (finanzas, 1) y `cotizador` (ventas, 3). Manifiestos nuevos **en construcción** (`enConstruccion: true`, `secciones: []`, permisos `<codigo>:ver` y `<codigo>:editar`): `crm` (ventas, 1, «CRM»), `ordenes` (ventas, 2, «Pedidos»), `compras` (compras, 1, «Compras»), `insumos` (inventario, 1, «Inventario»), `personal` (personal, 1, «Personal»), `reportes` (analisis, 1, «Reportes»), `webhooks` (conexiones, 1, «Webhooks y claves»). Cada uno en `apps/api/src/modules/<codigo>/<codigo>.manifest.ts`, con su `<codigo>.module.ts` vacío.
3. `manifiesto-core.ts`: permisos nuevos del núcleo, todos de una vez: `productos:ver`, `productos:editar`, `sucursales:ver`, `sucursales:gestionar`, `auditoria:ver`, `borradores:ver`, `conexiones:ver`, `conexiones:gestionar`, `automatizaciones:ver`, `automatizaciones:gestionar`, `datos:importar`, `datos:exportar`. Nivel `lectura`: los `:ver`. Nivel `completo`: todos.
4. Servidor: `core/herramientas/{tipos.ts, registro.ts, herramientas.module.ts}` y `core/eventos/tipos.ts` (sección 6.2); `core/modulos/acceso.service.ts` extraído del guardia (el guardia lo usa; sus 21 pruebas por HTTP siguen pasando sin cambios); un `<area>.module.ts` vacío para cada carpeta nueva de `core/` de la sección 5; `app.module.ts` los importa todos y registra los nueve manifiestos.
5. `GET /api/v1/yo` devuelve `familia` y `orden` por módulo.
6. Variables nuevas de la sección 6.2 en `infra/config/config.ts` (con pruebas) y `.env.example`.
7. **Base de pruebas por carril:** `CAPAZ_TEST_DB` (por defecto `capaz_test`; debe cumplir `^capaz_test(_[a-z0-9]+)?$`) en `src/pruebas/{base-de-pruebas,app-de-pruebas,global-setup}.ts`; `scripts/preparar-base.ts` crea también esa base si la variable existe.

**Verificación:** `pnpm check` en verde con `CAPAZ_TEST_DB` sin definir y con `CAPAZ_TEST_DB=capaz_test_c0`; `pnpm db:generar` no genera nada (esta fase no cambia tablas).
**Hecho cuando:** lo anterior, y `yo` de una empresa nueva lista los nueve módulos con su familia.
**Parar y preguntar si:** extraer `ServicioDeAcceso` obliga a cambiar el comportamiento del guardia; o el registro de herramientas no puede validarse al terminar el arranque con el ciclo de vida de NestJS 12 instalado.

---

### Fase D · Datos (por tandas) [DB1, DB2, DB3] · un solo escritor

**Objetivo:** todas las tablas, políticas y permisos de una ola, escritos por un único carril, en serie.

**Pasos de cada tanda** (DB1a y DB1b están especificadas en 6.4; DB2 y DB3 salen de las fichas de las fases 14 a 19)
1. Declarar las tablas en un archivo nuevo por migración: `src/db/esquema/core-herramientas.ts`, `core-eventos.ts`, `core-maestros.ts`, `core-plataforma.ts`, `core-conexiones.ts`, `core-automatizaciones.ts`; exportarlos en `src/db/esquema/index.ts`.
2. `pnpm db:generar --name=<nombre>` y, al final del archivo generado, la seguridad a mano (receta de `MODULOS-Y-MERCADO.md` §8): `aplicar_aislamiento`, `abrir_a_plataforma`, permisos por columna, disparadores.
3. `EJEMPLOS` (`aislamiento.int.spec.ts`) y `PERMITIDO` (`contratacion.int.spec.ts`) al día.
4. **Cerrar un hueco de la prueba de plataforma** (DB1a): hoy compara solo permisos de tabla (`has_table_privilege`), así que un permiso **por columna** no se ve. Agregar `PERMITIDO_POR_COLUMNA` (tabla → privilegio → columnas) comparado contra `information_schema.column_privileges` para `capaz_sistema`, y dejar ahí lo de `core.solicitudes_modulo` (migración 0002) y lo nuevo.
5. `pnpm db:migrar` dos veces; `pnpm check`; `pnpm db:generar` otra vez no debe generar nada.
6. Avisar en el informe: «migraciones nuevas listas para Neon: NNNN…». **Las aplica la sesión de Neon** con `docs/NEON-MIGRACION.md`; el carril de datos no toca Neon.

**Pruebas:** las de catálogo, aislamiento y plataforma pasan con las tablas nuevas; `capaz_sistema` no puede leer `carga` de `core.eventos_salida`, ni `credenciales_cifradas`, ni `core.clientes`, ni `core.borradores`.
**Hecho cuando:** una tabla nueva sin `aplicar_aislamiento` hace fallar la prueba (se comprueba a mano y se repone).
**Parar y preguntar si:** `drizzle-kit` quiere borrar o recrear algo hecho a mano; el índice de parecido con `tenant_id` delante no se puede crear en PostgreSQL 18 local; una tabla necesita `BYPASSRLS`, superusuario o `security definer`.

**Cambio de esquema pedido por otro carril:** llega como «solicitud de cambio»; el integrador la encola y el carril de datos escribe **otra** migración (una migración aplicada no se edita).

---

### Fase 5a · Herramientas, auditoría e idempotencia (L) [S1]

**Objetivo:** la única puerta a las operaciones, lista para pantalla, voz, agente y MCP.
**Fuentes para portar (con sus pruebas):** `cotizin/src/shared/herramientas/` entero y `cotizin/src/app/api/herramientas/route.ts` (origen y tamaño).

**Especificación**
1. `EjecutorDeHerramientas.ejecutar()` con este orden de comprobaciones: existe la herramienta → argumentos reservados (`ARGUMENTOS_DE_CONTEXTO`) → módulo (las de `criticidad: 'lectura'` piden `puedeEntrar`; las demás `puedeEscribir`, y si no responden `modulo_solo_lectura`; **como quedó construido, esta exigencia no se aplica al módulo `core`**) → permiso → esquema de entrada → idempotencia → confirmación (si es crítica) → ejecución → esquema de salida → auditoría.
2. **Una transacción por llamada:** idempotencia, reserva de la confirmación, ejecución y auditoría del éxito ocurren en el mismo `conEmpresa`. Si la herramienta rechaza o lanza, la transacción se revierte **entera** y la auditoría del rechazo va en una transacción propia. No existe un cambio sin auditar ni una auditoría de algo que no ocurrió.
3. Confirmación: token firmado con `CONFIRMACION_SECRET`, vigencia 120 s, ligado a usuario, empresa, herramienta, hash canónico de los argumentos y huella de `resumir`; **solo vale con `canal: 'ui'`**; su `jti` se inserta en `core.confirmaciones_usadas` dentro de la transacción (si ya existe: `confirmacion_ya_usada`).
4. Idempotencia (herramientas con `idempotente: true` y cabecera `Idempotency-Key`): la clave se inserta al empezar (`on conflict do nothing`); si ya existía con los mismos argumentos se devuelve la respuesta guardada; con otros, `conflicto`. Dos peticiones simultáneas con la misma clave: la segunda espera y recibe la respuesta de la primera.
5. Auditoría en `core.auditoria`: nunca argumentos en claro, solo `hash_args` y lo que la herramienta declare en `auditar`. `ejecutarDentro` (§6.2) hace las mismas comprobaciones dentro de una transacción ajena y no abre otra.
6. `POST /api/v1/herramientas/:nombre`: cuerpo `cuerpoDeHerramientaSchema`; responde `Respuesta` con `Cache-Control: no-store`; rechaza si `Origin` no está en `ORIGENES_PERMITIDOS` (`origen_invalido`); el límite de 256 KB ya lo pone `configurar-app.ts`.
7. Herramientas del núcleo que entrega esta fase: `empresa_ver_configuracion` (lectura, `empresa:ver`), `empresa_actualizar_configuracion` (crítica, `empresa:configurar`; recibe solo lo que cambia y fusiona con la fila bloqueada `for update`), `modulo_solicitar` (normal, idempotente, sin permiso; inserta en `core.solicitudes_modulo`), `auditoria_listar` (lectura, `auditoria:ver`).

**Pruebas:** las de Cotizín, adaptadas: **cada caso queda portado o anotado como «no aplica» con su motivo.** Más: herramienta sin contrato o contrato sin herramienta impide arrancar; argumento reservado rechazado y auditado; confirmación con otro usuario, otra empresa u otros argumentos rechazada; confirmación con `canal: 'agente'` rechazada; el mismo token usado dos veces a la vez solo vale una; idempotencia (repetición, conflicto, dos simultáneas); escritura sobre módulo en baja responde `modulo_solo_lectura` y la lectura funciona; una herramienta que falla a medias no deja cambios y sí auditoría del rechazo; la auditoría no admite `update` ni `delete`; todo por HTTP real.
**Hecho cuando:** las pruebas pasan y una herramienta nueva se agrega tocando solo su contrato y su archivo.
**Parar y preguntar si:** una firma de 6.2 no alcanza para portar un caso de Cotizín (se pide el cambio al integrador; no se cambia por cuenta propia).

---

### Fase 8 · Eventos entre módulos y correlativos (M) [S2]

**Objetivo:** que un módulo avise a otro sin conocerlo y sin perder avisos.

**Especificación**
1. `emitir(tx, tipo, carga)`: valida la carga con `EVENTOS[tipo]`, exige la transacción de `conEmpresa` (falla sin ella) e inserta en `core.eventos_salida`.
2. Relevo dentro del mismo proceso, apagado si `RELEVO_ACTIVO` es falso:
   - **Despierta por señal** cuando la transacción de `emitir` se confirma, más un barrido de respaldo cada `RELEVO_BARRIDO_SEGUNDOS` que solo sigue activo mientras queden pendientes. Sin sondeo fijo.
   - **Reserva corta:** con el grupo de sistema toma un lote (`for update skip locked`), mueve `disponible_en` unos minutos adelante, suma un intento y confirma. No mantiene una transacción abierta mientras corren los consumidores.
   - **Entrega:** por cada evento y consumidor abre `conEmpresa` con `canal: 'sistema'` y `usuarioId: 'sistema'`, lee ahí la `carga` (como `capaz_app`), inserta en `core.eventos_procesados` y ejecuta el consumidor en esa misma transacción. Si el módulo del consumidor no está vigente para esa empresa, se marca procesado sin ejecutar. Un consumidor con `evento: '*'` recibe todos.
   - Reintentos con espera creciente; tras 8 intentos pone `fallido_en` y lo registra. Un consumidor que falla no bloquea a los demás.
   - Se detiene limpio al apagar el servidor. En las pruebas no arranca: se llama a `procesarLote()`.
3. `RegistroDeTareas`: tareas periódicas del mismo relevo. Trae una: mantenimiento diario (borra `core.idempotencia` de más de 30 días, `core.confirmaciones_usadas` de más de 1 día y eventos procesados de más de 90).
4. `siguienteNumero(tx, clave, { serie, anio })`: un `insert … on conflict … do update set ultimo = ultimo + 1 returning ultimo` sobre `core.contadores`; sin huecos por reintentos dentro de la transacción.

**Pruebas:** si la transacción se revierte no hay evento; el mismo evento entregado dos veces se procesa una vez; un consumidor que falla se reintenta y no bloquea; `capaz_sistema` no puede leer `carga`; dos llamadas simultáneas a `siguienteNumero` dan números distintos y consecutivos; el mantenimiento borra solo lo vencido (reloj controlado).
**Hecho cuando:** las pruebas pasan con un evento y un consumidor de prueba declarados dentro de la propia prueba.
**Parar y preguntar si:** hace falta que `capaz_sistema` lea `carga` para que algo funcione (no hace falta: es señal de diseño equivocado).

---

### Fase 7 · Datos maestros: Clientes, Productos y Sucursales (L) [S3 servidor · W7 web]

**Objetivo:** el primer recorrido completo, plantilla de todo módulo, y las tres entidades que todos comparten.
**Fuentes de referencia:** `cotizin/src/shared/db/esquema/clientes.ts`, `cotizin/src/features/clientes/`, la tabla `contactos` de Tairos.RC.

**Servidor**
1. Capas por entidad en `core/<entidad>/`: `domain/` (reglas puras: normalizar nombre sin tildes ni mayúsculas y con espacios simples; normalizar teléfono; validar documento por tipo: DNI 8 dígitos, RUC 11), `repositories/` (reciben la transacción), `herramientas/`.
2. Herramientas (contratos en `contratos/{clientes,productos,sucursales}.ts`):
   - `clientes_listar`, `clientes_ver`, `clientes_buscar` (por parecido del nombre; devuelve los mejores candidatos: la usarán la voz y `candidatas`), `clientes_crear` (idempotente), `clientes_editar`, `clientes_archivar`, `clientes_restaurar`. Permisos `clientes:ver` y `clientes:editar`. Fusionar clientes queda para la fase 14 (hay que mover referencias); aquí solo existe la columna.
   - `productos_listar`, `productos_ver`, `productos_buscar`, `productos_crear` (idempotente), `productos_editar`, `productos_archivar`, `productos_restaurar`. Permisos `productos:ver` y `productos:editar`.
   - `sucursales_listar`, `sucursal_crear`, `sucursal_editar`, `sucursal_archivar`, `sucursal_marcar_principal` (crítica). Permisos `sucursales:ver` y `sucursales:gestionar`. No se archiva la principal.
3. `EmpresasService.asegurar` crea la sucursal `PRI` «Principal» si la empresa no tiene ninguna (idempotente).
4. Eventos: `cliente.creado`, `cliente.actualizado`, `producto.creado`, `producto.actualizado` (carga: `id` y campos no sensibles).
5. `docs/COMO-CREAR-UN-MODULO.md`: la receta seguida aquí (capas, contrato, herramienta, registro en el proveedor, pruebas por HTTP, evento, pantalla con `Lista` y `Ficha`), para los carriles de las olas 2 y 3.

**Web:** `core/clientes` y `core/productos`: lista con búsqueda y estado vacío, alta en hoja inferior (móvil) o diálogo (escritorio), ficha con edición, archivar y restaurar. `core/ajustes/sucursales`: lista y edición. Todo con el kit; sin estilos sueltos.

**Pruebas:** dominio (unitarias); herramientas contra base real con dos empresas; nombre duplicado responde `conflicto` con `candidatas`; «Jose Perez» encuentra a «José Pérez»; un `member` con nivel `lectura` no puede crear; otra empresa no ve el cliente; crear emite el evento y revertir no lo deja; empresa nueva tiene su sucursal principal.
**Revisión visual (persona):** crear un cliente y un producto desde el celular.
**Hecho cuando:** las pruebas pasan y la receta está escrita.
**Parar y preguntar si:** hace falta una columna que 6.4 no trae.

---

### Fase 6b · Usuarios y accesos (M) [S4 servidor · W6 web]

**Servidor:** herramientas `miembros_listar` (por `core.v_miembros`), `miembro_asignar_modulo` (`sin acceso | lectura | completo`, y alcance `todos | propios`), `miembro_cambiar_rol`, `miembro_quitar`, `invitacion_crear`, `invitacion_anular`, `invitaciones_listar`. Usan la API de servidor de Better Auth por dentro (sus rutas públicas están cerradas). Reglas: respetan `max_usuarios` del módulo; no se quita ni se degrada al último `owner`; un `admin` no cambia a un `owner`; **ninguna toca el correo ni la contraseña de otra persona** (regla 19). Quitar, cambiar rol e invitar son críticas. Permisos `miembros:ver` y `miembros:gestionar`.
**Web:** `/ajustes/usuarios` (solo `owner` y `admin`): miembros, cambio de rol y, por miembro, los módulos contratados con el selector de nivel. Invitar genera un **enlace** que el administrador copia (sin correo). Pantalla `/invitacion/:id`: pide iniciar sesión o registrarse con el correo invitado y acepta.

**Pruebas de integración:** un `member` no puede usar estas herramientas; no se quita al último `owner`; `max_usuarios` se respeta; una invitación de la empresa A no sirve para la B; una anulada o vencida no funciona.
**Hecho cuando:** un `member` sin módulos ve el menú bloqueado, el administrador le asigna uno con nivel `lectura` y, al recargar, entra y no puede escribir.
**Parar y preguntar si:** una pantalla necesita una ruta de `/api/auth` que no está en la lista blanca.

---

### Fase 13 · Bandeja de borradores: el trabajador digital del núcleo (M) [S5 servidor · W8 web]

**Objetivo:** que cualquier origen (voz, agente, regla, conector, importación) pueda **proponer** una operación y una persona la apruebe, corrija o descarte desde la pantalla. Un borrador es una llamada a herramienta pendiente; no toca los datos del negocio hasta aprobarse.

**Servidor**
1. `proponerBorrador` (sección 6.2): comprueba que la herramienta existe y guarda `args` y `args_originales` iguales. Los argumentos se validan al aprobar, no al proponer (un dictado puede venir incompleto).
2. Herramientas: `borradores_listar` (filtros: estado, módulo, origen; un `member` ve solo los de módulos a los que puede entrar), `borrador_ver`, `borrador_corregir` (cambia `args`, marca `corregido`), `borrador_aprobar`, `borrador_descartar` (con motivo). Permiso `borradores:ver` para todas: **lo que protege es el permiso de la herramienta propuesta**, que se comprueba al aprobar con los permisos de quien aprueba.
3. `borrador_aprobar` solo vale con `canal: 'ui'` (si no, `confirmacion_solo_ui`). Ejecuta la herramienta propuesta con `EjecutorDeHerramientas.ejecutarDentro` **en la misma transacción** en que marca el borrador `aprobado`; si la propuesta es crítica y no llega `confirmacion`, devuelve su `requiereConfirmacion` tal cual. Si la herramienta rechaza, `borrador_aprobar` responde ese mismo rechazo: nada cambia, el borrador sigue `pendiente` y el rechazo queda en la auditoría.
4. Medición lista para el piloto: `origen`, `captura_iniciada_en`, `propuesto_en`, `resuelto_en` y `corregido` dan el porcentaje aprobado sin corregir y el tiempo por registro.
5. Evento `borrador.propuesto` (para avisos futuros).

**Web** (`core/bandeja`): lista de pendientes con lo que entendió el sistema, su origen y los campos clave en grande; **Aprobar** y **Corregir** (abre la ficha de esa herramienta en una hoja); descartar con motivo; aviso «Aprobado» tras aprobar. Contador de pendientes en el menú.

**Pruebas:** aprobar ejecuta una sola vez aunque se pulse dos veces; aprobar sin permiso de la herramienta propuesta responde `sin_permiso` y el borrador sigue pendiente; por `canal: 'agente'` no se aprueba; corregir conserva `args_originales`; otra empresa no ve el borrador.
**Hecho cuando:** un borrador propuesto por código para `clientes_crear` aparece en la bandeja, se corrige el teléfono, se aprueba y el cliente existe, con auditoría de quién aprobó.
**Parar y preguntar si:** se pide aprobar en lote o «deshacer»: no están en esta fase.

---

### Fase 9a · Consola de plataforma: servidor (M) [S6]

**Objetivo:** operar empresas, módulos, planes y precios sin ver datos de negocio. Detalle en `PLATAFORMA-Y-PLANES.md`.

1. `GuardiaDePlataforma` propia (se aplica en el controlador; el guardia global no se toca): el usuario debe estar en `core.plataforma_admins`. Ruta `POST /api/v1/plataforma/herramientas/:nombre`, con registro propio (`CONTRATOS_DE_PLATAFORMA`), que ejecuta con el grupo de sistema y audita en `core.auditoria_plataforma`.
2. Herramientas: `plataforma_empresas_listar`, `plataforma_empresa_ver` (nombre, alta, número de usuarios, módulos con estado, plan, precio, vigencia, última actividad e historial; **nunca filas de negocio**), `plataforma_empresa_crear`, `plataforma_modulo_activar | suspender | dar_de_baja | reactivar`, `plataforma_contrato_fijar` (plan, precio acordado, vigencia, límite de usuarios), `plataforma_planes_listar | guardar`, `plataforma_solicitudes_listar | atender`, `plataforma_restablecer_contrasena` (genera el enlace de un solo uso de Better Auth y lo devuelve una vez; cierra el pendiente de la fase 4). Las que cambian algo son críticas.

**Pruebas:** un usuario normal recibe `sin_permiso` en toda ruta de plataforma; **la prueba de la lista de plataforma sigue pasando con lo agregado**; bajar un módulo deja a esa empresa en solo lectura; todo cambio queda auditado con el actor.
**Hecho cuando:** se da a una empresa el módulo `crm` en prueba de 15 días por HTTP y su `yo` lo refleja.
**Parar y preguntar si:** se pide «entrar como la empresa» o ver sus datos: no está en el alcance.

### Fase 9b · Consola de plataforma: pantallas (M) [W9]

`/plataforma` (solo administradores de plataforma; misma carcasa visual, menú propio): Empresas; ficha con un interruptor por módulo, plan, precio, vigencia, límites e historial; Planes y precios; Solicitudes y vencimientos; Resumen.
**Hecho cuando:** se puede dar a una empresa un módulo sin otro, con precio y vigencia, desde la pantalla.

---

### Fase 11a · Conectores y automatizaciones: marco (L) [S7 conexiones · S8 automatizaciones]

**Objetivo:** «conecta tu empresa» sin que los módulos sepan de conectores (ADR-014).

**Conexiones [S7]**
1. Un conector contratable es **un módulo de la familia `conexiones`** (se activa por empresa en `core.empresa_modulos` como cualquier otro, ADR-014 §1) **más** un `ManifiestoDeConector` con el mismo código. `RegistroDeConectores` valida esos manifiestos al arrancar y sincroniza `core.conectores`. El primero es `webhooks`, que deja de estar en construcción. Importar y exportar es del núcleo y no se contrata.
2. Cifrado AES-256-GCM (`node:crypto`) con `CONEXIONES_CLAVE` y su versión guardada junto al dato. Las credenciales **nunca** salen en respuestas, registros ni auditoría; la pantalla solo sabe «configurada».
3. Herramientas: `conectores_listar`, `conexion_ver`, `conexion_configurar` (crítica), `conexion_desactivar`, `claves_api_listar`, `clave_api_crear` (devuelve la clave **una sola vez**; se guarda su hash), `clave_api_revocar` (crítica), `webhooks_salientes_listar | crear | editar | archivar`, `webhook_envios_listar`, `webhook_envio_reintentar`. Permisos `conexiones:ver` y `conexiones:gestionar`.
4. Entrada: `POST /api/v1/entrada/:evento` (pública; autentica con `Authorization: Bearer <clave>` buscando el hash con el grupo de sistema; exige `Idempotency-Key`; 256 KB). Guarda en `core.webhooks_entrantes` y emite `webhook.recibido`, todo dentro de `conEmpresa` de la empresa dueña de la clave. Repetido: responde lo mismo sin duplicar.
5. Salida: un consumidor `'*'` crea un `webhooks_envios` por suscripción que coincida y envía con `fetch` (10 s de espera, firma HMAC-SHA256 del cuerpo en una cabecera). Si alguno falla, lanza y el relevo reintenta; lo ya `enviado` no se repite. **Solo `https`**, y se rechazan destinos privados, de bucle local y de enlace local resolviendo el nombre antes de enviar (salvo `PERMITIR_DESTINOS_LOCALES` en pruebas). Tope de envíos por conexión y minuto contado en la base.

**Automatizaciones [S8]**
6. Regla = disparador (`evento`, `tiempo`, `webhook`, `manual`) + condiciones + acciones + modo + límite diario. Condiciones: lista de `{ campo, op, valor }` unidas por «y», con `op` en `igual | distinto | mayor | menor | contiene | existe`; sin código. Acciones: lista de `{ herramienta, args }` con sustitución de `{{ruta.del.dato}}` en valores de texto; sin expresiones.
7. Modos: `borrador` y `pide_aprobacion` llaman a `proponerBorrador` (el segundo con prioridad alta); `automatico` ejecuta con `EjecutorDeHerramientas`, `canal: 'sistema'` y **los permisos vigentes de quien creó la regla**. Una regla con una acción `mueveDinero` o crítica no puede guardarse ni activarse en `automatico`.
8. Disparo por evento: consumidor `'*'`. Por tiempo: tarea periódica cada 60 s que, solo en las empresas con reglas de tiempo activas, recorre los `candidatos` de la `FuenteDeTiempo` y dispara cuando hoy (zona horaria de la empresa) = fecha + N días, una vez por entidad (`core.reglas_disparos`). Trae una fuente del núcleo: `core.prueba_de_modulo_vence`.
9. Herramientas: `reglas_listar`, `regla_ver`, `regla_guardar`, `regla_activar` (crítica si el modo es `automatico`), `regla_desactivar`, `regla_probar` («qué haría»: no escribe nada salvo una ejecución `simulada`), `regla_ejecutar` (manual), `regla_ejecuciones_listar`. Permisos `automatizaciones:ver` y `automatizaciones:gestionar`.

**Pruebas:** las credenciales nunca salen en respuestas ni registros; una empresa no ve la conexión de otra; `capaz_sistema` no lee credenciales; un webhook entrante repetido se procesa una vez; una clave revocada no entra; un destino privado se rechaza; una regla que mueve dinero no puede quedar en `automatico`; el límite diario corta; una regla por tiempo dispara una sola vez por entidad (reloj controlado); todo contra un servidor simulado local.
**Hecho cuando:** una regla por tiempo deja un borrador en la bandeja y un webhook de salida llega firmado al servidor simulado, todo auditado.
**Parar y preguntar si:** hay que llamar a un servicio externo real o elegir proveedor: lo decide el usuario.

### Fase 11b · Importar y exportar (M) [S9]

`exportar_csv` (`datos:exportar`; clientes o productos; hasta 5 000 filas, devuelve el texto), `importar_csv_previsualizar` (valida fila por fila y devuelve errores sin escribir) e `importar_csv_aplicar` (crítica, `datos:importar`; hasta 1 000 filas; crea lo válido, omite duplicados por nombre normalizado y deja el resultado en `core.sincronizaciones`). Lector y escritor de CSV propios (RFC 4180, comillas, comas y saltos de línea dentro de campos, separador `;` detectado, BOM), con pruebas. **Solo CSV** (Excel necesita una dependencia: decisión D10). WhatsApp, pagos y contabilidad externa no entran en la ola 1 (D12).
**Hecho cuando:** un archivo de 200 clientes con 5 filas malas previsualiza los 5 errores e importa 195, sin duplicar al repetirlo.

### Fase 11c · Pantallas de conexión y automatizaciones (M) [W10]

`/ajustes/conecta` (conectores, estado, configurar, claves de API, webhooks de salida, cola de envíos con «Reintentar», importar y exportar) y `/ajustes/automatizaciones` (reglas, editor por pasos, «Probar», historial).

---

### Fase 6a · Carcasa de interfaz tradicional (L, en tres partes) [W1 · W2 · W4]

**Objetivo:** que quien haya usado un ERP se sienta en casa: menú de aplicaciones por familias, listas, fichas y estados; diseño propio (regla 12).

**6a-1 · Base web (M) [W1]:** estructura de carpetas de la sección 5; `tokens.css` y tema claro y oscuro sin parpadeo; kit base de 6.3; `shared/api/cliente.ts`; `shared/sesion`; `shared/formato` (fechas y horas en `es-PE` con la zona horaria de la empresa; soles con `formatearSoles`); `app/rutas.tsx` con todos los `rutas.tsx` vacíos; página `/kit` solo en desarrollo con cada pieza en todos sus estados. Pruebas unitarias de lo que es función pura (guardas, formato, tema).
**6a-2 · Kit de datos (M) [W2]:** las piezas de datos de 6.3, mostradas en `/kit` con datos de ejemplo marcados «Ejemplo».
**6a-3 · Carcasa (M) [W4]:**
1. Disposición con sesión: barra superior (Inicio, migas, selector de empresa, usuario, tema) y **menú lateral por familias**: primero el núcleo (Inicio, Bandeja, Clientes, Productos), después las cinco familias clásicas siempre visibles y las demás solo si tienen módulos, y al final Ajustes (Empresa, Usuarios, Sucursales, Conecta, Automatizaciones, Historial). Móvil: barra inferior con cuatro destinos y «Más». Tableta: menú solo con iconos.
2. Cada módulo aparece dentro de su familia según `yo`: **entra** (`activo`, `prueba` con días), **solo lectura** (`baja_solo_lectura`, `suspendido`), **bloqueado** con su motivo y acción: `no_contratado` → «Solicitar» (`modulo_solicitar`), `sin_asignar` → «Pide acceso a tu administrador», `enConstruccion` → «Próximamente» (sin acción). Una familia clásica sin ningún módulo disponible se ve igual, con sus módulos bloqueados.
3. `/inicio`: saludo y las mismas familias como tarjetas, con el estado de cada módulo.
4. Rutas de módulo desde los manifiestos; un módulo sin acceso redirige a `/inicio` con aviso.
5. Selector de empresa: `POST /api/auth/organization/set-active` y recarga de `yo`.

**Revisión visual (persona):** todas las pantallas a 390 y 1280 px, claro y oscuro; texto sin cortes; foco visible; nada se desborda en horizontal; **ningún parecido reconocible con otro ERP** (regla 12).
**Hecho cuando:** con dos módulos en estados distintos puestos por `pnpm plataforma`, `yo`, el menú y las tarjetas coinciden.
**Parar y preguntar si:** una pieza del kit pasa de 150 líneas por accesibilidad (selector con búsqueda, menú con flechas): se evalúa una dependencia con el usuario (D6); o si el usuario entrega una imagen de referencia que difiere.

### Fase 3b · Pantallas de acceso (M) [W3]

`/registro`, `/iniciar-sesion`, `/nueva-empresa` y cierre de sesión, llamando por `fetch` a las rutas de la lista blanca (`sign-up/email`, `sign-in/email`, `sign-out`) y a `POST /api/v1/empresas`. Si el usuario no puede crear empresas, `/nueva-empresa` muestra «Tu cuenta aún no tiene empresa: acepta una invitación o pide a Capaz que la cree». Guardas: sin sesión → `/iniciar-sesion`; sin empresa → `/nueva-empresa`; con todo → `/inicio`. Permite pegar y gestores de contraseñas.
**Fuentes para portar:** pantallas de `cotizin/src/app/(auth)/`.
**Hecho cuando:** `pnpm check` en verde y la lista de revisión visual entregada. **Parar y preguntar si:** la cookie de sesión no viaja por el proxy de Vite.

### Fase 5b · Herramientas en la pantalla (S) [W5]

`shared/api/herramientas.ts` (sección 6.3) portando `cotizin/src/shared/hooks/use-llamador.tsx` y `utils/estado-del-llamador.ts` con sus pruebas; indicador «Guardando… / Guardado / Sin conexión»; confirmación en dos pasos con `confirmar()` (muestra el `resumen`, reenvía con el `token`, y si venció lo vuelve a pedir); pantalla `/ajustes/empresa` (zona horaria) y `/ajustes/historial` (`auditoria_listar`).
**Hecho cuando:** cambiar la zona horaria pide confirmación y aparece en el historial.

---

### Fases 14 a 20 · Módulos clásicos (olas 2 y 3)

**La especificación ya no vive aquí.** Fases 14, 15 y 16: `docs/FICHAS-OLA-2.md` (**congelada**: tablas columna por columna, contratos Zod, permisos, eventos, correlativos, pantallas, pruebas y «hecho cuando»). Fases 17 a 20: `docs/FICHAS-OLA-3.md` (**casi congelada**; se cierra en la puerta de la ola 3). Carriles y rondas: `PLAN-PARALELO.md` §4.1 y §5. Reglas de fondo: `docs/adr/ADR-015` (aceptado) y `ADR-016` (propuesto).

Reglas comunes (resumen; el texto que manda es `FICHAS-OLA-2.md` §1): cada módulo en `modules/<codigo>/` con su esquema de base; herramientas con `modulo: '<codigo>'`; todo disparador de escritura llama a `core.exigir_modulo` a través de `core.exigir_modulo_en_escritura('<codigo>')`; un módulo no importa a otro ni le pone llaves foráneas (se hablan por eventos, por la bandeja y por las entidades del núcleo); **un consumidor de eventos solo propone borradores**; alcance «propios» por `creado_por` o responsable; cada módulo ofrece `<codigo>_resumen` para Reportes y para Inicio; captura tecleada (la voz, en la ola 4).

| Fase · módulo · familia | Carriles | Tablas (esquema propio) | Herramientas | Eventos y fuentes de tiempo | Pantallas |
|---|---|---|---|---|---|
| **14 · `registro` · Finanzas** | M-registro-s1, s2, s3 · w1, w2 | `cuentas`, `categorias`, `movimientos` (inmutables salvo anular), `deudas` | 22: `registro_iniciar`, cuentas (5), categorías (4), `movimiento_registrar / ver / anular`, `movimientos_listar`, `deuda_crear / ver / editar / abonar / anular`, `deudas_listar`, `caja_del_dia`, `registro_resumen` | emite `movimiento.registrado / anulado`, `deuda.creada / abonada / pagada / anulada` · consume `pedido.confirmado` y `pedido.cancelado` (→ borrador) · fuente `registro.deuda_vence` | Movimientos, Por cobrar, Por pagar, ficha de deuda con abonos, Caja del día, Cuentas y categorías |
| **15 · `crm` · Ventas** | M-crm-s1, s2 · w | `etapas`, `oportunidades`, `actividades` | 18: `crm_iniciar`, etapas (5), `oportunidad_crear / ver / editar / mover / ganar / perder / reabrir`, `oportunidades_listar`, `actividad_crear / completar`, `actividades_listar`, `crm_resumen` | emite `oportunidad.creada / movida / ganada / perdida` · fuentes `crm.actividad_vence`, `crm.oportunidad_sin_movimiento` | Tablero por etapa (con «Mover a…», sin arrastre), lista, ficha con actividades, actividades, etapas |
| **16 · `ordenes` · Ventas** («Pedidos») | M-ordenes-s1, s2 · w | `pedidos`, `pedido_lineas`, `pedido_eventos` | 9: `pedido_crear / editar / ver / anotar / confirmar / cambiar_estado / cancelar`, `pedidos_listar`, `ordenes_resumen` | emite `pedido.confirmado / entregado / cancelado` · fuente `ordenes.entrega_vence` | Lista, nuevo y ficha con líneas y totales, tablero por estado, entregas |
| **17 · `insumos` · Inventario** | M-insumos-s · w | `articulos`, `existencias`, `movimientos` (solo inserción) | `articulo_activar / editar / archivar`, `existencias_listar`, `existencia_mover`, `existencias_recibir`, `existencia_ajustar` (crítica), `insumos_resumen` | emite `existencia.bajo_minimo` · consume `compra.recibida` (→ borrador) | Existencias, movimientos, ficha de artículo, alertas |
| **18 · `compras` · Compras** | M-compras-s · w (tras `insumos`) | `ordenes`, `orden_lineas`, `recepciones`, `recepcion_lineas` | `compra_crear / editar / enviar / recibir / cancelar`, `compras_listar`, `compras_resumen` | emite `compra.enviada / recibida / cancelada` · fuente `compras.entrega_vence` | Lista, ficha, recepción |
| **19 · `personal` · Personal** | M-personal-s · w | `colaboradores`, `asistencias`, `adelantos` | `colaborador_*`, `asistencia_marcar / corregir`, `adelanto_registrar` (`mueveDinero`) `/ anular`, `personal_resumen` | emite `adelanto.registrado / anulado` (→ `registro` propone el egreso) | Colaboradores, asistencia del día, adelantos. **Sin planilla** |
| **20 · `reportes` · Análisis** | M-reportes-s · w | ninguna | `reportes_panel` (compone los `_resumen`), `reportes_exportar_csv` | — | Indicadores por período con gráficos en SVG propio |

Cambios frente a la versión 1 de estas fichas, y por qué: `clientes_fusionar` **sale** de la fase 14 (cruza módulos: pasa al núcleo y se decide en la puerta de la ola 3); `etapas_guardar` se parte en cuatro herramientas simples; `alertas_de_minimo` es un filtro de `existencias_listar`; los pedidos ganan el estado «Listo»; las «pruebas de equivalencia contra el SQL de Tairos.RC» pasan a ser casos de referencia escritos (D15, ADR-016); se agregan `<codigo>_iniciar` para los catálogos por defecto, y los carriles C1, K1, N1 y X2 que no existían.

---

### Fase 10a · Despliegue (M) [X1] · antes de datos reales · necesita D7

1. Host en São Paulo (misma región que Neon), elegido comparando 2 o 3 opciones y midiendo latencia desde Perú y arranque en frío. Límite de gasto y alertas en Neon.
2. `Dockerfile` de varias etapas: compila `shared`, `web` y `api`; la API sirve la web compilada (mismo origen) y responde `index.html` a las rutas que no empiezan por `/api`.
3. Migraciones como paso de despliegue separado del arranque; el contenedor en ejecución no recibe `DATABASE_URL_OWNER`. Probar `conEmpresa` con el pooler.
4. Dominio con HTTPS; cookies `Secure` y `SameSite=Lax`; `ORIGENES_PERMITIDOS` y `BETTER_AUTH_URL` reales; `ALTA_DE_EMPRESAS=plataforma`; `CONEXIONES_CLAVE` de producción.
5. Copias de seguridad y **una prueba real de restauración** antes del primer dato del taller.

**Hecho cuando:** el dueño entra desde su celular por HTTPS, crea un cliente, y una restauración de prueba lo recupera.

### Fases 21 a 23 · Adaptación del Registro por voz y del Cotizador (ola 4) · plan propio

Su plan detallado lo escribe el arquitecto al cerrar la ola 3, con lo aprendido. Alcance fijado:

- **21 · Registro por voz:** sobre las herramientas de la fase 14 y la bandeja de la fase 13. Captura (grabar y subir, D11), reconocimiento detrás de una interfaz de conector (el proveedor se elige con la prueba comparativa de la pista V), agente que convierte el dictado en un borrador con `proponerBorrador`, uso y costo por empresa (`core.uso`) con tope, y lo que falte de Tairos.RC (proformas, recibos, papelera). **Metas medidas con datos de `core.borradores`:** 70 % aprobado sin corregir y 30 s por registro. Sigue `ARQUITECTURA-DE-IA.md`.
- **22 · Cotizador:** porte de Cotizín (motores, herramientas, pantallas) a `modules/cotizador`, sobre `core.clientes` y `core.productos`. El motor conserva `NUMERIC` con `big.js` (dependencia por aprobar, D12) y un único adaptador a céntimos.
- **23 · Puente:** `cotizacion.aceptada` → pedido (`ordenes`) → deuda por cobrar (`registro`), por eventos e idempotente.

### Fase 10b · Endurecer (M) · antes del primer cliente externo

Cabeceras de seguridad y límite de peticiones por usuario y empresa; monitoreo de errores (si el usuario lo aprueba) con datos personales ocultos; exportar y borrar datos por empresa (Ley 29733) e inventario en `docs/DATOS-PERSONALES.md`; proveedor de correo (verificación, invitaciones y restablecimiento; reabrir el cambio de correo); segundo factor para administradores de plataforma; lista de salida.

### Fase 12 · Facturación electrónica SUNAT (final)

Conector de un proveedor OSE/PSE sobre el marco de la fase 11a, con todo lo anterior estable. Antes: confirmar con SUNAT la obligación de cada cliente y elegir proveedor. Los datos fiscales mínimos ya están desde la ola 1 (documento del cliente, IGV por línea, correlativos con serie).

## 8. Tablero de avance

Actualizado en la puerta de la ola 2 (2026-11-15). «Integrado» = en `main` con la suite en verde según el integrador; **nada de la ola 1 tiene todavía revisión visual ni se probó contra Neon.**

| Ola | Fase | Entrega | Carril | Tamaño | Estado |
|---|---|---|---|---|---|
| — | 0, 1, 2, 3a, 4 | Reglas, infraestructura, base y roles, identidad, módulos y contratación | — | — | hechas 2026-11-14 |
| 1 | P | Andamiaje y contratos | C0 | M | **integrado** |
| 1 | D | Datos de la ola 1 (`0006` a `0012`) | DB1a · DB1b | M + M | **integrado** · falta aplicarlas en Neon |
| 1 | 5a | Herramientas, auditoría, idempotencia | S1 | L | **integrado** |
| 1 | 8 | Eventos y correlativos | S2 | M | **integrado** |
| 1 | 7 | Clientes, Productos, Sucursales | S3a · S3b · W7 | L · M | **integrado** · falta revisión visual |
| 1 | 6b | Usuarios y accesos | S4 · W6 | M · M | **integrado** · falta revisión visual |
| 1 | 13 | Bandeja de borradores | S5 · S5b · W8 | M · S | **integrado** · falta revisión visual |
| 1 | 9a · 9b | Consola de plataforma | S6 · W9 | M · M | **integrado** · falta revisión visual |
| 1 | 11a | Conexiones · Automatizaciones | S7 · S8 | M · M | **integrado** · envío de webhooks a nombres de host por arreglar (C1) |
| 1 | 11b · 11c | Importar y exportar · pantallas | S9 · W10 | M · M | **integrado** · falta revisión visual |
| 1 | 6a | Base web · kit de datos · carcasa | W1 · W2 · W4 | M · M · M | **integrado** · falta revisión visual |
| 1 | 3b · 5b | Acceso · herramientas en pantalla | W3 · W5 | M · S | **integrado** · falta revisión visual |
| 1 | 10a | Despliegue | X1 | M | pendiente · necesita D7 (host, con Keny) |
| 2 | puerta | Paso previo de servidor (eventos, ayudantes, arreglo de webhooks) | C1 | S | **por lanzar · ronda 7** |
| 2 | 6a+ | Kit y base web de la ola 2 | K1a · K1b | M + M | **por lanzar · ronda 7** (K1a) |
| 2 | D | Datos de la ola 2 (`0013` a `0016`) | DB2a · DB2b | M + M | **por lanzar · ronda 7** (DB2a) |
| 2 | 14 | Finanzas ligeras (`registro`, tecleado) | M-registro-s1, s2, s3 · w1, w2 | M, M, S · M, M | pendiente · rondas 8 a 11 |
| 2 | 15 | CRM | M-crm-s1, s2 · w | M, M · M | pendiente · rondas 9 a 11 |
| 2 | 16 | Pedidos (`ordenes`) | M-ordenes-s1, s2 · w | M, M · L | pendiente · rondas 9 a 11 · necesita D17 |
| 2 | 13+ | Inicio y bandeja con pendientes | N1 | S | pendiente · ronda 11 |
| 2 | cierre | Recorrido pedido → cobro, banderas, puerta de la ola 3 | X2 | S | pendiente · ronda 12 |
| 3 | 17, 18, 19, 20 | Inventario, Compras, Personal, Reportes | C2 · K2 · DB3 · M-* · X3 | ver `FICHAS-OLA-3.md` | pendiente · necesita su puerta |
| 4 | 21, 22, 23 | Registro por voz, Cotizador, puente | plan propio | L | pendiente · solo si encajan · necesita D11, D12 |
| 5 | 10b | Endurecer | — | M | pendiente |
| Final | 12 | Facturación SUNAT | — | M | pendiente |
| — | V | Audios reales y línea base (usuario) | — | — | pospuesta por el usuario (voz más adelante) |

> **Resueltas el 2026-11-15 (noche) por delegación del usuario («tú toma la mejor decisión técnica y estratégica»):** D15 a D25 se aceptan **con la recomendación del arquitecto**; en particular **D17: los precios de un pedido incluyen IGV 18 %, guardado en cada pedido**; D21: ADR-016 aceptado con revisión de Keny; D22: arreglar `enviar.ts` en C1; D23: revisión visual por tandas con Keny; D25: decidir con Keny si X1 se adelanta (host y migraciones 0006 a 0016 en Neon).

## 9. Decisiones del usuario

**RESUELTAS el 2026-11-15** (Moisés delegó lo técnico en el agente principal y aprobó el resto):

| # | Resolución |
|---|---|
| D1 | **Sí a commits locales.** Commit base en `main` y uno por carril en su rama (modo A). Nada se sube a GitHub hasta que Keny lo revise. |
| D2 | **ADR-015 aprobado** con ajustes: un esquema de base de datos por módulo clásico; `familia` y `orden` en el manifiesto; Ventas = CRM + Pedidos. Registro y Cotizador se suben **después** de terminar el ERP clásico y solo si encajan; si no encajan, quizá no se incluyen. |
| Voz | Se **empieza con captura tecleada (forma clásica)**. La voz se implementa cuando la construcción haya avanzado: **el agente principal debe recordárselo al usuario** (ver memoria). Pista V y prueba de audios, después. |
| D3 | **Aprobada** `@tanstack/react-query`; la instala el integrador antes de lanzar W6. |
| D4 | Se aprueba al integrar W1 (no antes). |
| D5 | **Azul noche + esmeralda** como identidad del ERP. |
| D6 | Primitivas nativas, iconos propios, kit dentro de `apps/web`. |
| D7 | **Host: se decide con Keny** al llegar a X1 (comparar 2 o 3 en São Paulo). |
| D9 | Se deja como está; se revisa al cerrar la ola 2. |
| D10 | Solo CSV en la ola 1. |
| D13 | `@nestjs/mau` se quita ahora. **Neon (resetear contraseña, rama `ensayo-migraciones`) lo ve Keny:** el agente principal debe recordarlo; no se toca Neon hoy. |
| Bandeja | `core.borradores` (S5 y W8) **aprobada** en la ola 1. |

Las decisiones de la tabla original que siguen abiertas son D11, D12 y D14 (y D7, que se decide con Keny).

### Decisiones nuevas de la puerta de la ola 2 (2026-11-15) · ABIERTAS

Cada una trae la recomendación con la que quedó escrita la ficha: **si no hay respuesta, se construye lo recomendado**, salvo D17, que debe confirmarse antes de la ronda 9.

| # | Decisión | Recomendación | Bloquea |
|---|---|---|---|
| D15 | Equivalencia con Tairos.RC: ¿casos de referencia escritos, o ejecutar el SQL antiguo? | Casos de referencia (ocho, en `FICHAS-OLA-2.md` §4.2). El modelo ya no es el de Tairos.RC; cambia una frase de ADR-008 (ADR-016 §7) | Nada. Rechazada: un carril más después de M-registro-s2 |
| D16 | Anular una deuda que ya tiene abonos | Exigir anular antes sus abonos. Tairos.RC preguntaba «devuelto o retenido»; se revisa al adaptar el Registro por voz | Nada |
| **D17** | **¿Los precios de un pedido incluyen IGV?** | **Sí, 18 %**, guardando el porcentaje en cada pedido. Es como cotiza un taller al público | **M-ordenes-s1 (ronda 9)**, la tabla `ordenes.pedidos` y la pantalla de líneas |
| D18 | Estados del pedido | `borrador`, `confirmado`, `en_proceso`, `listo`, `entregado`, `cancelado` (se agrega «Listo»: terminado y esperando recojo) | Nada |
| D19 | `registro` por defecto con prueba de 30 días (era D9) | Mantener, y quitar «en construcción» al integrar sus pantallas | X2 |
| D20 | Nombre visible del módulo `registro` | «Caja y cuentas» mientras el Registro por voz no exista; el código sigue siendo `registro`. ADR-015 decía «Registro» | Nada: una línea del manifiesto |
| D21 | Aprobar ADR-016 (reglas de los módulos clásicos) | Aprobar, con revisión de Keny de los puntos 1 a 3 | Nada si se aprueba como está |
| D22 | Arreglar ya el envío de webhooks a nombres de host (fallo de la ola 1) | Sí, dentro de C1 | Nada; sin el arreglo, los webhooks de salida no funcionan en producción |
| D23 | Revisión visual de la ola 1 por tandas (kit, acceso y carcasa primero) antes de lanzar las pantallas de la ola 2 | Hacerla durante las rondas 7 a 10 | Nada; sin ella, las pantallas nuevas heredan lo que haya que corregir |
| D24 | Qué significa «las deudas vencidas avisan solas» sin mensajería | En la ola 2: tarjetas de pendientes en Inicio y lista «Vencidas» (N1). Un aviso que salga del sistema (WhatsApp, correo) llega con sus conectores | Nada en la ola 2 |
| D25 | Uso real al cerrar la ola 2 | Necesita X1 (host), las migraciones `0006` a `0016` en Neon y `CONEXIONES_CLAVE` de producción. Decidir con Keny si X1 se adelanta a la ronda 9 | El «uso real» de la ola, no su construcción |

### Tabla original (para consulta)

Ninguna se inventó en este plan: cada una trae una recomendación y lo que bloquea. **La ola 1 entera puede avanzar sin D2, D5, D7 ni D9 a D14; solo las cinco últimas pantallas (W6 a W10) esperan a D3.**

| # | Decisión | Recomendación | Bloquea |
|---|---|---|---|
| D1 | **Permiso de commits:** uno base ahora y uno por carril en su rama | Sí. Sin commits no hay ramas ni worktrees | El modo A de `PLAN-PARALELO.md`. Sin él se trabaja en modo B (copias de carpeta), más lento de integrar |
| D2 | **Aprobar ADR-015** (orden, familias, un esquema por módulo, Finanzas = `registro` en dos pasos, Ventas = CRM + Pedidos, bandeja en el núcleo) | Aprobar | Olas 2 y 3 (tandas DB2 y DB3 y todos los carriles `M-*`). La ola 1 no |
| D3 | **Dependencia `@tanstack/react-query`** en `apps/web` (la nombraba ya la versión 2) | Aprobar; la instala el integrador | W6 a W10 (listas con caché). W1 a W5 no la usan: leen con el cargador de la ruta. Rechazada, W6 a W10 se hacen igual con cargadores de ruta (más código por pantalla) |
| D4 | **Dependencias de prueba de componentes** (`@testing-library/react`, `user-event`, `jest-dom`, `jsdom`) | Aprobar al integrar W1 | Nada: sin ellas se prueba solo lo que es función pura |
| D5 | **Identidad visual:** «Pliego» (papel cálido, colores de proceso) o «azul noche + esmeralda» | Azul noche + esmeralda como identidad del ERP (sobria, tradicional, sirve para otros sectores); los colores de proceso quedan como acento del vertical gráfico. Con ella, las dos fuentes variables | Solo el cierre visual: se cambian valores de `tokens.css`. Ningún carril espera |
| D6 | Primitivas nativas (`<dialog>`, `popover`) frente a `@base-ui/react`; iconos propios frente a `lucide-react`; kit en `apps/web/src/shared/ui` | Nativas, iconos propios, kit dentro de `apps/web` | Nada: se construye así salvo orden contraria |
| D7 | **Host del servidor** en São Paulo | Comparar 2 o 3 opciones cuando la ola 1 tenga pantallas que enseñar | X1 (fase 10a) y, con ella, la ola 4 |
| D8 | Alta de empresas cerrada; restablecer contraseña solo desde la plataforma | Mantener | Nada: ya está construido así |
| D9 | `registro` se entrega hoy por defecto en prueba de 30 días, pero estará «en construcción» toda la ola 1 | Quitar `porDefecto` hasta cerrar la ola 2 | Nada: C0 lo deja como está si no hay respuesta |
| D10 | Importar y exportar Excel (`.xlsx`) exige una dependencia | Solo CSV en la ola 1 | Nada |
| D11 | Voz: grabar y subir como camino principal; pista V (audios y cronometraje); autorizar la prueba comparativa (tiene costo); proveedor de voz y de modelo | Grabar y subir; empezar la pista V ya | Fase 21 |
| D12 | Proveedores externos y dependencias de la ola 4 y 5: WhatsApp (BSP), pasarela de pagos, correo, `big.js` | Decidir al llegar a cada una | WhatsApp, pagos, 10b, fase 22 |
| D13 | Higiene: resetear la contraseña del dueño de Neon (pasó por el chat); borrar o no la rama `ensayo-migraciones`; quitar `@nestjs/mau` (0.x, sin uso) de `apps/api/package.json` | Hacer las tres | Nada |
| D14 | ¿«Extender» incluye terceros que construyan módulos? ¿Cuál es el siguiente sector? (ADR-013) | Responder antes de la ola 5 | Nada por ahora |

## 10. Revisión crítica: los cinco mayores riesgos

1. **El primer uso real y la meta medible quedan lejos.** La versión 2 llegaba al piloto de voz tras siete fases; ahora hay unas veinticinco entregas antes. Se puede construir un ERP entero sin que nadie lo use. *Mitigación:* cada ola cierra con uso interno en Atlantisgraf (sección 4); puerta de revisión entre olas, donde el usuario puede recortar; la pista V empieza ya, para saber pronto si la voz llega al 70 %; la fase 10a se adelanta en cuanto haya host.
2. **Dos modelos para lo mismo.** «Finanzas ligeras» y el Registro por voz son el mismo dinero; «Ventas» y el Cotizador rozan el mismo documento. Construirlos dos veces duplica las reglas de dinero, que es lo más caro de corregir. Además ADR-008 dice «voz primero». *Mitigación:* ADR-015 propone un solo módulo `registro` en dos pasos, con las pruebas de equivalencia contra Tairos.RC desde el paso clásico, y un Cotizador que entra por eventos sin su propio pedido. **Mientras ADR-015 no se apruebe, las olas 2 y 3 no arrancan.**
3. **Contratos congelados antes de usarlos, y dos cuellos de botella.** Las firmas de 6.2 se diseñaron leyendo Cotizín, no portándolo; si la fase 5a descubre que no alcanzan, se rehacen carriles. Y todo pasa por un carril de datos y un integrador únicos. *Mitigación:* P y DB1a son cortas y van primero; S1 valida el contrato con cuatro herramientas reales **antes** de lanzar los carriles que definen herramientas (S3 segunda parte, S4 a S9); los cambios de contrato solo los hace el integrador; nunca más de cuatro carriles a la vez.
4. **Calidad de interfaz sin e2e, sin pruebas de componentes y sin identidad decidida.** Diez carriles web dejan decenas de pantallas para una sola persona que revisa a mano; y «apariencia tradicional» empuja a parecerse a productos existentes (regla 12). *Mitigación:* tokens semánticos y un solo kit (ninguna pantalla trae estilos propios), página `/kit` para revisar piezas una vez, revisión visual por tandas (al integrar W2, W4 y W7), y un punto de la lista del integrador dedicado a la regla 12.
5. **Agentes de esfuerzo medio con una pila más nueva que su memoria, sobre código de seguridad.** NestJS 12, Better Auth 1.7, Zod 4, Drizzle 0.45, React Router 8 y Tailwind 4 invitan a escribir API que ya no existen; y un permiso por columna mal puesto no lo ve hoy ninguna prueba. *Mitigación:* ningún carril salvo el de datos toca migraciones ni permisos; ninguno toca el guardia ni `infra/`; «parar y preguntar» en cada fase; la fase D cierra el hueco de permisos por columna; el integrador revisa a mano todo diff de `core/auth`, `core/herramientas` y `drizzle/`.

### 10.1 Riesgos nuevos (puerta de la ola 2)

1. **Primer uso real del camino «módulo que no es el núcleo».** `puedeEscribir`, los permisos de manifiesto de módulo y el disparador de solo lectura solo se han ejercido con herramientas de prueba: las de `webhooks` se declararon como `core`. *Mitigación:* M-registro-s1 lo valida antes de abrir `crm` y `ordenes`; pruebas R17.4 y R17.6.
2. **El disparador de escritura frente a las pruebas de catálogo.** Sembrar ejemplos exige activar antes el módulo de cada empresa de prueba; si DB2a tropieza ahí, se detiene toda la ola. *Mitigación:* el paso está escrito (`FICHAS-OLA-2.md` §3.1, paso 6) y DB2a va primero y solo.
3. **Reglas de dinero nuevas sin el SQL de Tairos.RC como juez.** *Mitigación:* ocho casos de referencia, las dos desviaciones deliberadas conservadas, inmutabilidad por permisos de columna y `CHECK` de coherencia en la base.
4. **Consumidores con contexto de administrador.** Un consumidor que ejecutara una herramienta movería dinero sin persona. *Mitigación:* regla R5, punto 14 de la lista de integración y, propuesto para Keny, un contexto de sistema sin permisos.
5. **La bandeja genérica muestra identificadores y céntimos crudos.** Los borradores que vienen de otro módulo se leen mal hasta N1. *Mitigación:* el `resumen` del borrador va en lenguaje claro desde el primer día; N1 formatea montos.
6. **«Uso real» sin despliegue.** La ola 2 puede cerrarse sin que nadie la use: X1 espera el host, hay más de veinte pantallas sin revisión visual y siete migraciones sin aplicar en Neon (once al terminar la ola). *Mitigación:* D23 y D25.
7. **Redondeo del IGV por línea.** Con precios que incluyen IGV, la suma de bases redondeadas puede diferir en céntimos de la base del total. *Mitigación:* la regla está fijada (se redondea por línea; el total es la suma de importes) y probada; se revisa al llegar a SUNAT.
8. **Nombres que chocan entre módulos:** «movimientos» y «órdenes» existen en dos módulos. *Mitigación:* prefijo de módulo en las constantes de Drizzle (R16), nombres de herramienta distintos y la prueba que ya impide repetirlos.
9. **Pendientes de seguridad de la ola 1** que la ola 2 hereda: envío de webhooks roto con nombres de host; rotación de la clave de cifrado sin camino (se carga una sola clave); limitador de la entrada pública por `req.ip` sin `trust proxy`; todo `member` lee el historial completo de la empresa (`auditoria:ver` en el nivel de lectura del núcleo). *Mitigación:* lista para Keny en `RELEVO.md`.

**Lo que no encaja de la arquitectura existente con el nuevo orden** (comprobado en el código antes de la ola 1; las fases P y D ya lo corrigieron): el manifiesto no tiene familia; solo hay tres esquemas, fijados en dos ADR, en `drizzle.config.ts` y en tres pruebas; `registro` nace como módulo base por defecto con prueba de 30 días; el cálculo de acceso vive privado dentro del guardia HTTP y no sirve para el relevo ni para las reglas; la base de pruebas tiene nombre fijo, así que dos carriles no pueden probar a la vez; la prueba de la lista de plataforma no ve permisos por columna; el índice de parecido de Cotizín no cumple la regla de índices por `tenant_id`; `EmpresasService` guarda en memoria qué empresas ya aprovisionó (inofensivo con varias instancias porque es idempotente, pero roza la regla de servidor sin estado de ADR-013). Las fases P y D lo corrigen, salvo los esquemas (ADR-015).

## 11. Puntos ciegos que siguen vigilados

| Punto | Decisión |
|---|---|
| Código de negocio leyendo contraseñas o sesiones | Rol y esquema aparte para la autenticación (ADR-011) |
| La plataforma viendo datos de sus clientes | `capaz_sistema` solo tiene lo de la lista de plataforma, por tabla y por columna; lo comprueba una prueba por permitidos |
| Entorno local distinto de producción en permisos | Dueño sin superusuario en local |
| Correo para invitaciones y recuperación | Fuera hasta la fase 10b: la invitación es un enlace que el administrador copia; el restablecimiento lo genera solo la plataforma |
| Registro con el correo de otra persona | Riesgo aceptado mientras el alta de empresas sea cerrada; se cierra con el proveedor de correo |
| Costo de IA, voz y mensajería por empresa | `core.uso` con tope, al construir la fase 21 o el primer conector de costo variable |
| El micrófono exige HTTPS | La fase 10a va antes de la fase 21 |
| Que la voz no llegue al 70 % con ruido real | Pista V desde ya; respaldo con texto |
| Dinero con decimales en el Cotizador | `NUMERIC` con `big.js` dentro del motor y un único adaptador a céntimos (fase 22) |
| Cortes de día | Zona horaria por empresa (ADR-012) |
| Numeración de documentos | `core.contadores` con serie y año; sin huecos por reintentos |
| Reintentos desde el celular con mala señal | Idempotencia por clave en las herramientas que crean dinero |
| Guardar un cambio y no avisar al otro módulo | Evento en la misma transacción (fase 8) |
| Crear la empresa y que falle a medias | Aprovisionamiento idempotente que se repite solo |
| Protección de datos personales (Ley 29733) | Audio sin guardar por defecto; exportar y borrar por empresa antes del primer cliente externo |
| Copias de seguridad | Restauración probada antes de datos reales (fase 10a) |
| Varios agentes editando a la vez | `PLAN-PARALELO.md`: propiedad exclusiva, un escritor de migraciones, un integrador |
| Ataques por texto dictado, por datos de contactos o por webhooks | Argumentos reservados rechazados; la confirmación y la aprobación solo valen desde la pantalla; el contenido externo nunca cambia qué herramientas se pueden usar; destinos privados rechazados |
| Una regla automática que mueve dinero | Prohibido el modo `automatico`; queda como borrador |
| Sin e2e | Contratos compartidos, recorridos por HTTP real y revisión visual de una persona |
