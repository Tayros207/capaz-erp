// Contratos del área «compras»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
import { z } from 'zod';
import { importe } from '../dinero.js';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';
import { calcularTotalesDePedido, type TotalesDePedido } from './ordenes.js';

export const ESTADOS_DE_COMPRA = ['borrador', 'enviada', 'recibida_parcial', 'recibida', 'cancelada'] as const;
export type EstadoDeCompra = (typeof ESTADOS_DE_COMPRA)[number];

/** La orden sigue viva (ni recibida del todo ni cancelada). */
export const ESTADOS_ABIERTOS_DE_COMPRA = ['borrador', 'enviada', 'recibida_parcial'] as const satisfies readonly EstadoDeCompra[];
/** Enviada al proveedor y con algo pendiente de llegar: son las que admiten recepciones y pueden atrasarse. */
export const ESTADOS_POR_RECIBIR_DE_COMPRA = ['enviada', 'recibida_parcial'] as const satisfies readonly EstadoDeCompra[];
/** Solo una orden sin recepciones se cancela. */
export const ESTADOS_CANCELABLES_DE_COMPRA = ['borrador', 'enviada'] as const satisfies readonly EstadoDeCompra[];
export const FILTROS_DE_ESTADO_DE_COMPRA = ['abiertas', 'por_recibir', ...ESTADOS_DE_COMPRA, 'todas'] as const;

export const IGV_DE_COMPRA_POR_DEFECTO = 18;
export const MAXIMO_DE_LINEAS_DE_COMPRA = 100;

// --- Totales (P3-5: los costos de compra incluyen IGV, como los precios de Pedidos) ---

export type LineaParaTotalesDeCompra = { cantidadMilesimas: number; costoUnitarioMilesimas: number; afectoIgv: boolean };

/**
 * Totales de una orden de compra: la misma función y el mismo redondeo que Pedidos (IGV incluido, base
 * por línea al céntimo, mitad hacia arriba). Lanza si un importe no es un entero seguro.
 */
export function calcularTotalesDeCompra(lineas: readonly LineaParaTotalesDeCompra[], igvPorcentaje: number): TotalesDePedido {
  return calcularTotalesDePedido(
    lineas.map((l) => ({ cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.costoUnitarioMilesimas, afectoIgv: l.afectoIgv })),
    igvPorcentaje,
  );
}

/** Valor de lo recibido (IGV incluido): Σ `importe(cantidad, costo)`. Lanza si un importe o la suma no es un entero seguro. */
export function importeDeRecepcion(lineas: ReadonlyArray<{ cantidadMilesimas: number; costoUnitarioMilesimas: number }>): number {
  const total = lineas.reduce((s, l) => s + BigInt(importe(l.cantidadMilesimas, l.costoUnitarioMilesimas)), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('El importe es demasiado grande.');
  return Number(total);
}

// --- Esquemas ---

const texto = (max: number) => z.string().trim().max(max);
const dia = z.iso.date();
const cantidad = z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' });

export const lineaDeCompraEntradaSchema = z
  .strictObject({
    productoId: z.uuid().nullish(),
    descripcion: texto(300).optional(),
    unidad: texto(20).optional(),
    cantidadMilesimas: cantidad,
    costoUnitarioMilesimas: z.number().int().safe().min(0, { error: 'El costo no puede ser negativo.' }),
    afectoIgv: z.boolean().optional(),
  })
  .refine((l) => Boolean(l.productoId) || Boolean(l.descripcion), { error: 'Una línea sin producto necesita descripción.' });
export type LineaDeCompraEntrada = z.infer<typeof lineaDeCompraEntradaSchema>;

/** `pendienteMilesimas` = pedido − recibido. */
export const lineaDeCompraSchema = z.strictObject({
  id: z.string(),
  posicion: z.number().int(),
  productoId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
  costoUnitarioMilesimas: z.number().int(),
  afectoIgv: z.boolean(),
  importeCentimos: z.number().int(),
  recibidoMilesimas: z.number().int(),
  pendienteMilesimas: z.number().int(),
});
export type LineaDeCompraDto = z.infer<typeof lineaDeCompraSchema>;

/** Una recepción no se edita ni se borra. `importeCentimos` es el valor de lo recibido en ella. */
export const recepcionDeCompraSchema = z.strictObject({
  id: z.string(),
  numero: z.number().int(),
  fecha: z.iso.date(),
  nota: z.string().nullable(),
  importeCentimos: z.number().int(),
  lineas: z.array(z.strictObject({ ordenLineaId: z.string(), cantidadMilesimas: z.number().int() })),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
});
export type RecepcionDeCompraDto = z.infer<typeof recepcionDeCompraSchema>;

/** `lineas` es la cantidad de líneas; `atrasada` = por recibir con `entregaEl` anterior a hoy. */
export const compraSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  numero: z.number().int().nullable(),
  serie: z.string().nullable(),
  anio: z.number().int().nullable(),
  proveedorId: z.string(),
  proveedorNombre: z.string(),
  estado: z.enum(ESTADOS_DE_COMPRA),
  fecha: z.iso.date(),
  entregaEl: z.iso.date().nullable(),
  atrasada: z.boolean(),
  igvPorcentaje: z.number().int(),
  subtotalCentimos: z.number().int(),
  igvCentimos: z.number().int(),
  totalCentimos: z.number().int(),
  notas: z.string().nullable(),
  sucursalId: z.string().nullable(),
  canceladoEn: z.iso.datetime().nullable(),
  motivoCancelacion: z.string().nullable(),
  lineas: z.number().int(),
  lineasPorRecibir: z.number().int(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type CompraDto = z.infer<typeof compraSchema>;

/** Recepciones de la primera a la última. */
export const compraCompletaSchema = z.strictObject({
  ...compraSchema.shape,
  detalle: z.array(lineaDeCompraSchema),
  recepciones: z.array(recepcionDeCompraSchema),
});
export type CompraCompletaDto = z.infer<typeof compraCompletaSchema>;

const lineasDeCompra = z.array(lineaDeCompraEntradaSchema).max(MAXIMO_DE_LINEAS_DE_COMPRA, { error: 'Una orden de compra admite hasta 100 líneas.' });

export const crearCompraSchema = z.strictObject({
  proveedorId: z.uuid(),
  fecha: dia.optional(),
  entregaEl: dia.nullish(),
  notas: texto(4000).nullish(),
  sucursalId: z.uuid().nullish(),
  lineas: lineasDeCompra.default([]),
});

/** Solo lo que cambia: al menos un campo. `lineas` reemplaza todas las líneas. */
export const editarCompraSchema = z
  .strictObject({
    id: z.uuid(),
    proveedorId: z.uuid().optional(),
    entregaEl: dia.nullish(),
    notas: texto(4000).nullish(),
    sucursalId: z.uuid().nullish(),
    lineas: lineasDeCompra.optional(),
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

export const listarComprasSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(FILTROS_DE_ESTADO_DE_COMPRA).default('abiertas'),
  proveedorId: z.uuid().optional(),
  entregaDesde: dia.optional(),
  entregaHasta: dia.optional(),
});

export const lineaRecibidaSchema = z.strictObject({ ordenLineaId: z.uuid(), cantidadMilesimas: cantidad });

export const recibirCompraSchema = z
  .strictObject({
    id: z.uuid(),
    fecha: dia.optional(),
    nota: texto(300).nullish(),
    lineas: z
      .array(lineaRecibidaSchema)
      .min(1, { error: 'Indica al menos una línea recibida.' })
      .max(MAXIMO_DE_LINEAS_DE_COMPRA, { error: 'Una recepción admite hasta 100 líneas.' }),
  })
  .refine((v) => new Set(v.lineas.map((l) => l.ordenLineaId)).size === v.lineas.length, { error: 'Cada línea de la orden va una sola vez en la recepción.' });

export const resumenDeComprasSchema = z.strictObject({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  porEstado: z.array(z.strictObject({ estado: z.enum(ESTADOS_DE_COMPRA), cantidad: z.number().int(), totalCentimos: z.number().int() })),
  /** Enviadas o recibidas (en parte o del todo) con fecha en el período. */
  compradas: z.number().int(),
  totalCompradoCentimos: z.number().int(),
  /** Recepciones con fecha en el período y el valor de lo recibido en ellas. */
  recepciones: z.number().int(),
  recibidoCentimos: z.number().int(),
  /** De hoy, no del período. */
  porRecibir: z.number().int(),
  atrasadas: z.number().int(),
});
export type ResumenDeCompras = z.infer<typeof resumenDeComprasSchema>;

const soloId = z.strictObject({ id: z.uuid() });

export const contratosDeCompras = {
  compra_crear: contrato(crearCompraSchema, compraCompletaSchema),
  compra_editar: contrato(editarCompraSchema, compraCompletaSchema),
  compra_ver: contrato(soloId, compraCompletaSchema),
  compras_listar: contrato(listarComprasSchema, listadoSchema(compraSchema)),
  compra_enviar: contrato(soloId, compraCompletaSchema),
  compra_recibir: contrato(recibirCompraSchema, compraCompletaSchema),
  compra_cancelar: contrato(z.strictObject({ id: z.uuid(), motivo: texto(300).min(1, { error: 'Indica el motivo.' }) }), compraCompletaSchema),
  compras_resumen: contrato(
    z.strictObject({ desde: dia, hasta: dia }).refine((v) => v.desde <= v.hasta, { error: 'El período empieza antes de terminar.' }),
    resumenDeComprasSchema,
  ),
} as const;

export const eventosDeCompras = {
  'compra.enviada': z.strictObject({ ordenId: z.string(), numero: z.string(), proveedorId: z.string(), totalCentimos: z.number().int() }),
  'compra.recibida': z.strictObject({
    ordenId: z.string(),
    recepcionId: z.string(),
    numero: z.string(),
    proveedorId: z.string(),
    totalRecibidoCentimos: z.number().int(),
    lineas: z.array(z.strictObject({ productoId: z.string().nullable(), cantidadMilesimas: z.number().int(), costoUnitarioMilesimas: z.number().int() })),
  }),
  'compra.cancelada': z.strictObject({ ordenId: z.string(), numero: z.string() }),
} as const;
