import { z } from 'zod';
import { importe } from '../dinero.js';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';
import { entradaDePreciosAnterioresSchema, salidaDePreciosAnterioresSchema } from './precios-anteriores.js';

// Contratos del área «ordenes»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

export const ESTADOS_DE_PEDIDO = ['borrador', 'confirmado', 'en_proceso', 'listo', 'entregado', 'cancelado'] as const;
export type EstadoDePedido = (typeof ESTADOS_DE_PEDIDO)[number];

/** Estados en los que el pedido sigue vivo (ni entregado ni cancelado). */
export const ESTADOS_ABIERTOS_DE_PEDIDO = ['borrador', 'confirmado', 'en_proceso', 'listo'] as const satisfies readonly EstadoDePedido[];
/** Estados con trabajo comprometido: son los que pueden estar atrasados. */
export const ESTADOS_EN_CURSO_DE_PEDIDO = ['confirmado', 'en_proceso', 'listo'] as const satisfies readonly EstadoDePedido[];
/** Destinos que admite `pedido_cambiar_estado`. */
export const ESTADOS_DE_AVANCE_DE_PEDIDO = ['confirmado', 'en_proceso', 'listo', 'entregado'] as const satisfies readonly EstadoDePedido[];
export const FILTROS_DE_ESTADO_DE_PEDIDO = ['abiertos', ...ESTADOS_DE_PEDIDO, 'todos'] as const;
export const TIPOS_DE_EVENTO_DE_PEDIDO = ['creado', 'editado', 'confirmado', 'estado', 'cancelado', 'nota'] as const;

/**
 * A qué estados puede pasar un pedido con `pedido_cambiar_estado`. La usan el servidor (que la hace
 * cumplir) y la pantalla (que solo ofrece lo permitido). `borrador → confirmado` es de
 * `pedido_confirmar` y la cancelación de `pedido_cancelar`: no están aquí.
 */
export const AVANCES_DE_PEDIDO: Readonly<Record<EstadoDePedido, readonly EstadoDePedido[]>> = {
  borrador: [],
  confirmado: ['en_proceso', 'listo', 'entregado'],
  en_proceso: ['listo', 'entregado', 'confirmado'],
  listo: ['entregado', 'en_proceso'],
  entregado: [],
  cancelado: [],
};
/** Estados desde los que se puede cancelar. */
export const ESTADOS_CANCELABLES_DE_PEDIDO: readonly EstadoDePedido[] = ESTADOS_ABIERTOS_DE_PEDIDO;

export const IGV_POR_DEFECTO = 18;
export const MAXIMO_DE_LINEAS_DE_PEDIDO = 100;

// --- Totales (D17: los precios unitarios incluyen IGV) ---

export type LineaParaTotales = { cantidadMilesimas: number; precioUnitarioMilesimas: number; afectoIgv: boolean };
export type TotalesDeLinea = { importeCentimos: number; baseCentimos: number; igvCentimos: number };
export type TotalesDePedido = { lineas: TotalesDeLinea[]; subtotalCentimos: number; igvCentimos: number; totalCentimos: number };

const aEnteroSeguro = (v: bigint): number => {
  if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('El importe es demasiado grande.');
  return Number(v);
};

/**
 * Totales de un pedido cuyos precios ya incluyen IGV. Por cada línea: importe = cantidad × precio
 * (`importe`); si está afecta, base = importe × 100 / (100 + igv) redondeada al céntimo (mitad hacia
 * arriba) e igv = importe − base; si no, base = importe. El redondeo es por línea: subtotal e IGV son
 * sumas, así que total = subtotal + igv = Σ importes siempre. Todo con enteros (`BigInt`).
 */
export function calcularTotalesDePedido(lineas: readonly LineaParaTotales[], igvPorcentaje: number): TotalesDePedido {
  if (!Number.isInteger(igvPorcentaje) || igvPorcentaje < 0 || igvPorcentaje > 100) {
    throw new RangeError('El porcentaje de IGV es un entero entre 0 y 100.');
  }
  const divisor = BigInt(100 + igvPorcentaje);
  let subtotal = 0n;
  let igv = 0n;
  const detalle = lineas.map((l): TotalesDeLinea => {
    if (l.cantidadMilesimas < 0 || l.precioUnitarioMilesimas < 0) throw new RangeError('Cantidad y precio no pueden ser negativos.');
    const bruto = BigInt(importe(l.cantidadMilesimas, l.precioUnitarioMilesimas));
    // Mitad hacia arriba con enteros no negativos: floor((2·n + d) / 2d).
    const base = l.afectoIgv ? (2n * bruto * 100n + divisor) / (2n * divisor) : bruto;
    subtotal += base;
    igv += bruto - base;
    return { importeCentimos: Number(bruto), baseCentimos: Number(base), igvCentimos: Number(bruto - base) };
  });
  return { lineas: detalle, subtotalCentimos: aEnteroSeguro(subtotal), igvCentimos: aEnteroSeguro(igv), totalCentimos: aEnteroSeguro(subtotal + igv) };
}

// --- Esquemas ---

const texto = (max: number) => z.string().trim().max(max);
const dia = z.iso.date();

export const lineaDeEntradaSchema = z
  .strictObject({
    productoId: z.uuid().nullish(),
    descripcion: texto(300).optional(),
    unidad: texto(20).optional(),
    cantidadMilesimas: z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' }),
    precioUnitarioMilesimas: z.number().int().safe().min(0, { error: 'El precio no puede ser negativo.' }).optional(),
    afectoIgv: z.boolean().optional(),
  })
  .refine((l) => Boolean(l.productoId) || (Boolean(l.descripcion) && l.precioUnitarioMilesimas !== undefined), {
    error: 'Una línea sin producto necesita descripción y precio.',
  });
export type LineaDeEntrada = z.infer<typeof lineaDeEntradaSchema>;

export const lineaDePedidoSchema = z.strictObject({
  id: z.string(),
  posicion: z.number().int(),
  productoId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
  precioUnitarioMilesimas: z.number().int(),
  afectoIgv: z.boolean(),
  importeCentimos: z.number().int(),
});
export type LineaDePedidoDto = z.infer<typeof lineaDePedidoSchema>;

/** `lineas` es la cantidad de líneas; `atrasado` = en curso con `entregaEl` anterior a hoy. */
export const pedidoSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  numero: z.number().int().nullable(),
  serie: z.string().nullable(),
  anio: z.number().int().nullable(),
  clienteId: z.string(),
  clienteNombre: z.string(),
  estado: z.enum(ESTADOS_DE_PEDIDO),
  fecha: z.iso.date(),
  entregaEl: z.iso.date().nullable(),
  atrasado: z.boolean(),
  responsableId: z.string().nullable(),
  igvPorcentaje: z.number().int(),
  subtotalCentimos: z.number().int(),
  igvCentimos: z.number().int(),
  totalCentimos: z.number().int(),
  notas: z.string().nullable(),
  sucursalId: z.string().nullable(),
  origenTipo: z.string().nullable(),
  origenId: z.string().nullable(),
  confirmadoEn: z.iso.datetime().nullable(),
  entregadoEn: z.iso.datetime().nullable(),
  canceladoEn: z.iso.datetime().nullable(),
  motivoCancelacion: z.string().nullable(),
  lineas: z.number().int(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type PedidoDto = z.infer<typeof pedidoSchema>;

export const eventoDePedidoSchema = z.strictObject({
  id: z.string(),
  tipo: z.string(),
  estadoAnterior: z.string().nullable(),
  estadoNuevo: z.string().nullable(),
  nota: z.string().nullable(),
  usuarioId: z.string(),
  creadoEn: z.iso.datetime(),
});
export type EventoDePedidoDto = z.infer<typeof eventoDePedidoSchema>;

export const pedidoCompletoSchema = z.strictObject({
  ...pedidoSchema.shape,
  detalle: z.array(lineaDePedidoSchema),
  historial: z.array(eventoDePedidoSchema),
});
export type PedidoCompletoDto = z.infer<typeof pedidoCompletoSchema>;

const lineasDeEntrada = z.array(lineaDeEntradaSchema).max(MAXIMO_DE_LINEAS_DE_PEDIDO, { error: 'Un pedido admite hasta 100 líneas.' });

export const crearPedidoSchema = z
  .strictObject({
    clienteId: z.uuid(),
    fecha: dia.optional(),
    entregaEl: dia.nullish(),
    responsableId: texto(100).nullish(),
    notas: texto(4000).nullish(),
    sucursalId: z.uuid().nullish(),
    lineas: lineasDeEntrada.default([]),
    origenTipo: texto(40).min(1).optional(),
    origenId: texto(100).min(1).optional(),
  })
  .refine((v) => (v.origenTipo === undefined) === (v.origenId === undefined), { error: 'El origen lleva tipo e identificador, los dos o ninguno.' });

/** Solo lo que cambia: al menos un campo. `lineas` reemplaza todas las líneas. */
export const editarPedidoSchema = z
  .strictObject({
    id: z.uuid(),
    clienteId: z.uuid().optional(),
    entregaEl: dia.nullish(),
    responsableId: texto(100).nullish(),
    notas: texto(4000).nullish(),
    sucursalId: z.uuid().nullish(),
    lineas: lineasDeEntrada.optional(),
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

export const listarPedidosSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(FILTROS_DE_ESTADO_DE_PEDIDO).default('abiertos'),
  clienteId: z.uuid().optional(),
  responsableId: texto(100).min(1).optional(),
  entregaDesde: dia.optional(),
  entregaHasta: dia.optional(),
});

export const resumenDeOrdenesSchema = z.strictObject({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  porEstado: z.array(z.strictObject({ estado: z.enum(ESTADOS_DE_PEDIDO), cantidad: z.number().int(), totalCentimos: z.number().int() })),
  confirmados: z.number().int(),
  totalConfirmadoCentimos: z.number().int(),
  entregados: z.number().int(),
  atrasados: z.number().int(),
  entregasDeHoy: z.number().int(),
});
export type ResumenDeOrdenes = z.infer<typeof resumenDeOrdenesSchema>;

const soloId = z.strictObject({ id: z.uuid() });

export const contratosDeOrdenes = {
  pedido_crear: contrato(crearPedidoSchema, pedidoCompletoSchema),
  pedido_editar: contrato(editarPedidoSchema, pedidoCompletoSchema),
  pedido_ver: contrato(soloId, pedidoCompletoSchema),
  pedidos_listar: contrato(listarPedidosSchema, listadoSchema(pedidoSchema)),
  pedido_anotar: contrato(z.strictObject({ id: z.uuid(), nota: texto(1000).min(1, { error: 'Escribe la nota.' }) }), pedidoCompletoSchema),
  pedido_confirmar: contrato(soloId, pedidoCompletoSchema),
  pedido_cambiar_estado: contrato(z.strictObject({ id: z.uuid(), estado: z.enum(ESTADOS_DE_AVANCE_DE_PEDIDO) }), pedidoCompletoSchema),
  pedido_cancelar: contrato(z.strictObject({ id: z.uuid(), motivo: texto(300).min(1, { error: 'Indica el motivo.' }) }), pedidoCompletoSchema),
  ordenes_resumen: contrato(
    z.strictObject({ desde: dia, hasta: dia }).refine((v) => v.desde <= v.hasta, { error: 'El período empieza antes de terminar.' }),
    resumenDeOrdenesSchema,
  ),
  ordenes_precios_anteriores: contrato(entradaDePreciosAnterioresSchema, salidaDePreciosAnterioresSchema),
} as const;

export const eventosDeOrdenes = {
  'pedido.confirmado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), totalCentimos: z.number().int(), entregaEl: z.iso.date().nullable(), sucursalId: z.string().nullable() }),
  'pedido.entregado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string() }),
  'pedido.cancelado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), teniaNumero: z.boolean() }),
} as const;
