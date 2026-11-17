import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listaDePrecioSchema } from './cotizador.js';
import {
  BASES_DE_UTILIDAD_DEL_CUADRO,
  COLUMNAS_DEL_CUADRO,
  ESCALAS_DEL_CUADRO,
  FACTORES_DEL_CUADRO,
  PLANTILLAS_DEL_CUADRO,
  SEMAFOROS,
  cantidadDeCuadro,
  costoUnitarioDeCuadro,
  dimensionesDeCuadroSchema,
  etapaDeCuadroSchema,
  medidaDeCuadro,
  pliegosDelCuadroSchema,
  porcentajeDeCuadro,
  precioComercialSchema,
  costosDelPrecioSchema,
  directoDelCuadroSchema,
  vistaDelCuadroSchema,
} from './cotizador-cuadro-vista.js';

// Contratos del cuadro por partes del Cotizador (carril cot-s4). Cada herramienta recibe el `id` de una cotización en borrador
// con modo «cuadro» y devuelve la vista del cuadro recalculada (costos y margen solo con `cotizador:costos`). Dinero en
// céntimos enteros; cantidades, medidas, costo unitario de una fila y porcentajes como texto decimal con punto (R22).

const texto = (max: number) => z.string().trim().max(max);
const soloId = z.strictObject({ id: z.uuid() });
const centimosPositivos = z.number().int().safe().min(1, { error: 'El importe debe ser mayor que cero.' });
const SIN_DATOS = { error: 'Indica al menos un dato.' };
const hayAlgo = (v: Record<string, unknown>) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined);

/** Cómo se indica una fila del cuadro: por su id, por su número («fila 3») o por un texto de su descripción. */
export const referenciaDeFilaSchema = z.union(
  [z.strictObject({ id: z.string().trim().min(1) }), z.strictObject({ numero: z.number().int().min(1) }), z.strictObject({ texto: z.string().trim().min(1) })],
  { error: 'La fila se indica con «id», «numero» o «texto».' },
);
export type ReferenciaDeFila = z.infer<typeof referenciaDeFilaSchema>;

/** Lo que devuelve toda herramienta que toca el cuadro: la vista y, si aplica, la fila afectada. */
export const salidaDelCuadroSchema = z.strictObject({
  cuadro: vistaDelCuadroSchema,
  linea: z.strictObject({ id: z.string(), numero: z.number().int().optional(), nombre: z.string(), detalle: z.string().optional() }).optional(),
});
export type SalidaDelCuadroDto = z.infer<typeof salidaDelCuadroSchema>;

export const CAMPOS_EDITABLES_DE_FILA = ['descripcion', 'cantidad', 'unidad', 'costoUnitario', 'escala', 'factor'] as const;
/** Cuántas celdas caben en una llamada: el cuadro entero (8 filas × 3 columnas) y un poco más. */
export const MAXIMO_DE_CELDAS_POR_LLAMADA = 36;
const claveDeFila = z.string().trim().min(1).max(64);

const iniciarSchema = z.strictObject({
  plantilla: z.enum(PLANTILLAS_DEL_CUADRO).default('en_blanco'),
  titulo: texto(200).min(1).optional(),
  producto: texto(120).optional(),
  clienteId: z.uuid().optional(),
});
const trabajoSchema = z
  .strictObject({
    id: z.uuid(),
    producto: texto(120).optional(),
    descripcion: texto(600).optional(),
    cantidad: cantidadDeCuadro.optional(),
    pieza: dimensionesDeCuadroSchema.optional(),
    tintas: z.number().int().min(0).max(12).optional(),
    caras: z.number().int().min(1).max(2).optional(),
  })
  .refine(hayAlgo, SIN_DATOS);
const imposicionSchema = z
  .strictObject({
    id: z.uuid(),
    /** Una máquina del taller: copia su formato máximo, pinza, sangrado, calle y etapas de merma. */
    maquinaId: z.uuid().optional(),
    pliegoMadreId: z.uuid().optional(),
    pliegoMaquinaId: z.uuid().optional(),
    pliegoMadre: dimensionesDeCuadroSchema.optional(),
    pliegoMaquina: dimensionesDeCuadroSchema.optional(),
    sangradoCm: medidaDeCuadro.optional(),
    calleCm: medidaDeCuadro.optional(),
    pinzaCm: medidaDeCuadro.optional(),
    formatoMaximo: dimensionesDeCuadroSchema.nullable().optional(),
    etapas: z.array(etapaDeCuadroSchema).max(10).optional(),
    /** Qué fila del cuadro es el papel para que el motor la llene con los pliegos madre; `null` la deja manual. */
    filaDePapel: z.union([referenciaDeFilaSchema, z.null()]).optional(),
  })
  .refine(hayAlgo, SIN_DATOS)
  .refine((a) => !(a.pliegoMadreId && a.pliegoMadre) && !(a.pliegoMaquinaId && a.pliegoMaquina), { error: 'Indica el pliego por su id o por sus medidas, no las dos cosas.' });
const agregarLineaSchema = z
  .strictObject({
    id: z.uuid(),
    /** Una tarifa del taller: se copian su nombre, unidad, costo y escala (lo que se diga aparte los reemplaza). */
    tarifaId: z.uuid().optional(),
    factor: z.enum(FACTORES_DEL_CUADRO).optional(),
    descripcion: texto(120).min(1).optional(),
    cantidad: cantidadDeCuadro,
    unidad: texto(20).min(1).optional(),
    costoUnitario: costoUnitarioDeCuadro.optional(),
    escala: z.enum(ESCALAS_DEL_CUADRO).optional(),
  })
  .refine((a) => a.tarifaId !== undefined || (a.factor !== undefined && a.descripcion !== undefined && a.costoUnitario !== undefined), {
    error: 'Sin tarifa, indica el factor, la descripción y el costo unitario.',
  });
const editarLineaSchema = z.strictObject({ id: z.uuid(), linea: referenciaDeFilaSchema, campo: z.enum(CAMPOS_EDITABLES_DE_FILA), valor: z.string().max(120) });
const quitarLineaSchema = z.strictObject({ id: z.uuid(), linea: referenciaDeFilaSchema });
const costoDirectoSchema = z
  .strictObject({
    id: z.uuid(),
    celdas: z.array(z.strictObject({ fila: claveDeFila, columna: z.enum(COLUMNAS_DEL_CUADRO), importeCentimos: z.number().int().safe().min(0).nullable() })).max(MAXIMO_DE_CELDAS_POR_LLAMADA).optional(),
    fijas: z.array(z.strictObject({ fila: claveDeFila, fija: z.boolean() })).max(MAXIMO_DE_CELDAS_POR_LLAMADA).optional(),
  })
  .refine((a) => (a.celdas?.length ?? 0) + (a.fijas?.length ?? 0) > 0, { error: 'Indica al menos una celda o una fila fija.' });
const columnasSchema = z.strictObject({
  id: z.uuid(),
  columnas: z
    .array(z.enum(COLUMNAS_DEL_CUADRO))
    .min(1, { error: 'Elige al menos una cantidad para enviar.' })
    .max(COLUMNAS_DEL_CUADRO.length)
    .refine((c) => new Set(c).size === c.length, { error: 'Una cantidad no puede estar dos veces.' }),
});
const utilidadSchema = z
  .strictObject({ id: z.uuid(), pct: porcentajeDeCuadro.nullable().optional(), base: z.enum(BASES_DE_UTILIDAD_DEL_CUADRO).optional(), columna: z.enum(COLUMNAS_DEL_CUADRO).optional() })
  .refine((a) => a.pct !== undefined || a.base !== undefined, { error: 'Indica el porcentaje, la base, o los dos.' })
  .refine((a) => a.columna === undefined || (a.pct !== undefined && a.base === undefined), { error: 'Para una columna indica solo el porcentaje (o null para quitarlo): la base es una por cotización.' })
  .refine((a) => a.columna !== undefined || a.pct !== null, { error: 'La utilidad general no se puede quitar: indica un porcentaje.' });
const precioFinalSchema = z
  .strictObject({ id: z.uuid(), precioCentimos: centimosPositivos.nullable().optional(), descuentoPct: porcentajeDeCuadro.optional() })
  .refine((a) => (a.precioCentimos !== undefined) !== (a.descuentoPct !== undefined), { error: 'Indica una sola cosa: el precio (o null para quitarlo) o un descuento.' });
const itemBase = { nombre: texto(60).min(1, { error: 'Falta el nombre del ítem.' }), factor: z.enum(FACTORES_DEL_CUADRO), despuesDe: z.enum(FACTORES_DEL_CUADRO), fija: z.boolean() };
const itemAgregarSchema = z.strictObject({
  id: z.uuid(),
  ...itemBase,
  despuesDe: itemBase.despuesDe.optional(),
  fija: itemBase.fija.default(false),
  /** También lo guarda en el cuadro de la empresa (taller) para que nazca en las cotizaciones nuevas; pide `cotizador:configurar`. */
  guardarEnTaller: z.boolean().default(false),
});
const itemEditarSchema = z
  .strictObject({ id: z.uuid(), item: texto(64).min(1), ...z.strictObject(itemBase).partial().shape })
  .refine((a) => a.nombre !== undefined || a.factor !== undefined || a.despuesDe !== undefined || a.fija !== undefined, SIN_DATOS);
const itemQuitarSchema = z.strictObject({ id: z.uuid(), item: texto(64).min(1) });

/** El recibo de costos: lo comercial lo ve cualquiera; lo interno solo con `cotizador:costos`. */
export const reciboDelCuadroSchema = z.strictObject({
  cotizacionId: z.string(),
  version: z.number().int(),
  cantidad: cantidadDeCuadro,
  moneda: z.string(),
  comercial: precioComercialSchema.nullable(),
  /** El desglose de pliegos (poses, pliegos de máquina y pliegos madre); `null` si la imposición está incompleta. */
  pliegos: pliegosDelCuadroSchema.nullable(),
  faltantes: z.array(z.string()),
  /** Las tres columnas con sus orígenes de celda (solo con costos), motivos de «no se puede calcular» y la coherencia A/B. */
  directo: directoDelCuadroSchema,
  interno: costosDelPrecioSchema.nullable().optional(),
});
export type ReciboDelCuadroDto = z.infer<typeof reciboDelCuadroSchema>;

const referenciasGeneradasSchema = z.strictObject({
  cotizacionId: z.string(),
  referencias: z.strictObject({ p100Centimos: z.number().int(), p1000Centimos: z.number().int(), p5000Centimos: z.number().int() }),
  validacion: z.strictObject({ bloqueos: z.array(z.string()), avisos: z.array(z.string()) }),
  /** Solo con `cotizador:costos`. */
  margenes: z.array(z.strictObject({ cantidad: z.string(), margenPct: z.string().nullable(), semaforo: z.enum(SEMAFOROS).nullable() })).optional(),
});
const guardarReferenciasSchema = z.strictObject({
  id: z.uuid(),
  /** Nombre de la lista; por defecto, el producto del trabajo. */
  nombre: texto(120).min(1).optional(),
  /** Producto del catálogo al que se enlaza la lista (una lista por producto). */
  productoId: z.uuid().optional(),
  /** Una lista existente que se actualiza con estos precios (crítica: cambia lo que se cobra). */
  listaId: z.uuid().optional(),
  modoIntermedio: z.enum(['curva', 'escalon']).default('curva'),
  precioMinimoCentimos: centimosPositivos.nullish(),
  confirmarUnitarioNoBaja: z.boolean().default(false),
});

export const contratosDeCotizadorCuadro = {
  cuadro_iniciar: contrato(iniciarSchema, salidaDelCuadroSchema),
  cuadro_ver: contrato(soloId, salidaDelCuadroSchema),
  cuadro_fijar_trabajo: contrato(trabajoSchema, salidaDelCuadroSchema),
  cuadro_fijar_imposicion: contrato(imposicionSchema, salidaDelCuadroSchema),
  cuadro_linea_agregar: contrato(agregarLineaSchema, salidaDelCuadroSchema),
  cuadro_linea_editar: contrato(editarLineaSchema, salidaDelCuadroSchema),
  cuadro_linea_quitar: contrato(quitarLineaSchema, salidaDelCuadroSchema),
  cuadro_fijar_costo_directo: contrato(costoDirectoSchema, salidaDelCuadroSchema),
  cuadro_fijar_columnas_a_enviar: contrato(columnasSchema, salidaDelCuadroSchema),
  cuadro_fijar_utilidad: contrato(utilidadSchema, salidaDelCuadroSchema),
  cuadro_fijar_precio_final: contrato(precioFinalSchema, salidaDelCuadroSchema),
  cuadro_item_agregar: contrato(itemAgregarSchema, salidaDelCuadroSchema),
  cuadro_item_editar: contrato(itemEditarSchema, salidaDelCuadroSchema),
  cuadro_item_quitar: contrato(itemQuitarSchema, salidaDelCuadroSchema),
  cuadro_calcular: contrato(soloId, reciboDelCuadroSchema),
  cuadro_generar_referencias: contrato(soloId, referenciasGeneradasSchema),
  cuadro_guardar_referencias: contrato(guardarReferenciasSchema, listaDePrecioSchema),
} as const;
