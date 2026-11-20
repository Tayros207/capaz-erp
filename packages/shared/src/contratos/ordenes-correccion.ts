import { z } from 'zod';
import { ponerIgv } from '../dinero.js';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';
import { MAXIMO_DE_LINEAS_DE_PEDIDO, MOTIVOS_DE_CORRECCION, correccionDePedidoSchema, pedidoCompletoSchema } from './ordenes.js';
import { ajusteDeDeudaSchema } from './registro.js';

// «Corregir pedido confirmado» (versión 2): `pedido_corregir` (Pedidos), la composición del núcleo `venta_corregir` (pedido +
// deuda en una sola confirmación) y la huella visible (`pedido_correcciones_listar`, `correcciones_listar`). La deuda se
// ajusta con `deuda_ajustar` (registro.ts). `ordenes.ts` no importa este archivo.

/** Un trabajador (ni dueño ni administrador) corrige sin aprobación hasta este porcentaje del total anterior… */
export const UMBRAL_DE_TRABAJADOR_PORCENTAJE = 10;
/** …y hasta este importe (S/ 100), lo que sea menor. */
export const UMBRAL_DE_TRABAJADOR_CENTIMOS = 10_000;

const texto = (max: number) => z.string().trim().max(max);
const dia = z.iso.date();

// --- Atajos de importe (la hoja «Corregir pedido» los ofrece; los precios de un pedido INCLUYEN IGV, D17) ---

/** «El IGV debía ir encima»: el precio que se tecleó era sin IGV; el nuevo lo incluye. Mitad hacia arriba. */
export const precioConIgvEncima = (precioMilesimas: number, igvPorcentaje: number): number => ponerIgv(precioMilesimas, igvPorcentaje);

/** «Se cobró IGV de más»: el precio ya incluía IGV y no debía; el nuevo es el precio sin IGV. Mitad hacia arriba. */
export function precioSinIgvIncluido(precioMilesimas: number, igvPorcentaje: number): number {
  if (!Number.isSafeInteger(precioMilesimas) || precioMilesimas < 0) throw new RangeError('El precio no es un entero seguro no negativo.');
  if (!Number.isInteger(igvPorcentaje) || igvPorcentaje < 0 || igvPorcentaje > 100) throw new RangeError('El IGV debe ser un entero de 0 a 100.');
  const divisor = BigInt(100 + igvPorcentaje);
  return Number((2n * BigInt(precioMilesimas) * 100n + divisor) / (2n * divisor));
}

// --- Contratos ---

export const lineaACorregirSchema = z.strictObject({
  /** Identificador de una línea que ya existe (se actualiza en el sitio); sin él, es una línea nueva. */
  id: z.uuid().optional(),
  descripcion: texto(300).min(1, { error: 'Escribe la descripción.' }),
  unidad: texto(20).min(1, { error: 'Indica la unidad.' }),
  cantidadMilesimas: z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' }),
  precioUnitarioMilesimas: z.number().int().safe().min(0, { error: 'El precio no puede ser negativo.' }),
  afectoIgv: z.boolean(),
  productoId: z.uuid().nullish(),
});
export type LineaACorregir = z.infer<typeof lineaACorregirSchema>;

const baseDeCorreccion = {
  id: z.uuid(),
  /**
   * La versión del pedido sobre la que se corrigió (la que se tenía a la vista). Si otra persona guardó antes otra corrección,
   * el pedido ya va en otra versión y esta se rechaza en vez de pisarla sin que nadie lo note.
   */
  versionEsperada: z.number({ error: 'Indica la versión del pedido que corriges.' }).int().min(1).max(1_000_000),
  motivoCodigo: z.enum(MOTIVOS_DE_CORRECCION),
  motivoTexto: texto(300).optional(),
  /** El pedido completo como debe quedar: las líneas con `id` se actualizan en el sitio, las que faltan se quitan, las sin `id` se agregan. */
  lineas: z.array(lineaACorregirSchema).min(1, { error: 'El pedido necesita al menos una línea.' }).max(MAXIMO_DE_LINEAS_DE_PEDIDO, { error: 'Un pedido admite hasta 100 líneas.' }).optional(),
  entregaEl: dia.nullish(),
  notas: texto(4000).nullish(),
  clienteId: z.uuid().optional(),
  /** Deja el total del pedido en ese importe repartiendo la diferencia entre los precios de las líneas (después de aplicar `lineas`). */
  fijarTotalCentimos: z.number().int().safe().min(1, { error: 'El total debe ser mayor que cero: para dejarlo en cero, cancela el pedido.' }).optional(),
};

type Corregible = { lineas?: unknown; entregaEl?: unknown; notas?: unknown; clienteId?: unknown; fijarTotalCentimos?: unknown; motivoCodigo: string; motivoTexto?: string };
const hayAlgoQueCorregir = (v: Corregible) => v.lineas !== undefined || v.entregaEl !== undefined || v.notas !== undefined || v.clienteId !== undefined || v.fijarTotalCentimos !== undefined;
const SIN_CORRECCION = { error: 'Indica qué se corrige: líneas, total, entrega, notas o cliente.' };
const OTRO_CON_TEXTO = { error: 'Con el motivo «otro» escribe qué pasó.', path: ['motivoTexto'] };
const conTexto = (v: Corregible) => v.motivoCodigo !== 'otro' || Boolean(v.motivoTexto?.trim());

/**
 * Corrige un pedido ya confirmado («versión 2»): mismo número, la versión anterior queda guardada. Lo que el cliente ya pagó NO
 * es un argumento (quien llama podría inventarlo para cambiar el cliente o dejar saldo a favor): solo lo informa por dentro
 * `venta_corregir`, que lo averigua en Finanzas. Sin ese dato no se cambia el cliente ni se calcula lo que queda a favor.
 */
export const corregirPedidoSchema = z.strictObject(baseDeCorreccion).refine(hayAlgoQueCorregir, SIN_CORRECCION).refine(conTexto, OTRO_CON_TEXTO);

/** Lo mismo para la composición del núcleo, que averigua lo abonado por su cuenta. */
export const corregirVentaSchema = z.strictObject(baseDeCorreccion).refine(hayAlgoQueCorregir, SIN_CORRECCION).refine(conTexto, OTRO_CON_TEXTO);

export const pedidoCorregidoSchema = z.strictObject({
  pedido: pedidoCompletoSchema,
  correccion: correccionDePedidoSchema,
  /** Avisos que la persona debe ver (p. ej. «el taller ya trabaja: reimprime la OT versión 2»). */
  avisos: z.array(z.string()),
});
export type PedidoCorregidoDto = z.infer<typeof pedidoCorregidoSchema>;

export const ventaCorregidaSchema = z.strictObject({
  pedido: pedidoCompletoSchema,
  correccion: correccionDePedidoSchema,
  avisos: z.array(z.string()),
  /** La deuda viva del pedido tal como quedó; `null` si no tiene o la persona no la ve. */
  deuda: z.strictObject({ id: z.string(), codigo: z.string(), totalCentimos: z.number().int(), abonadoCentimos: z.number().int(), saldoCentimos: z.number().int(), estado: z.string() }).nullable(),
  ajuste: ajusteDeDeudaSchema.nullable(),
  /** Lo que el cliente pagó de más y queda a su favor (no se devuelve). */
  aFavorCentimos: z.number().int(),
  /** El ajuste de la deuda queda como borrador porque quien corrige no lleva Finanzas (lo aprueba quien sí). */
  ajustePendiente: z.boolean(),
  /** Id del borrador de deuda que seguía pendiente y se actualizó con el total nuevo. */
  borradorActualizadoId: z.string().nullable(),
});
export type VentaCorregidaDto = z.infer<typeof ventaCorregidaSchema>;

export const listarCorreccionesSchema = z
  .strictObject({
    ...paginaSchema.shape,
    desde: dia.optional(),
    hasta: dia.optional(),
    /** Quien hizo la corrección (no se llama `usuarioId`: ese nombre lo reserva el sistema para la sesión). */
    autorId: texto(100).min(1).optional(),
    pedidoId: z.uuid().optional(),
  })
  .refine((v) => v.desde === undefined || v.hasta === undefined || v.desde <= v.hasta, { error: 'El período empieza antes de terminar.' });

export const correccionListadaSchema = z.strictObject({
  eventoId: z.string(),
  pedido: z.strictObject({ id: z.string(), codigo: z.string(), clienteNombre: z.string() }),
  versionAnterior: z.number().int(),
  version: z.number().int(),
  usuarioId: z.string(),
  usuarioNombre: z.string().nullable(),
  creadoEn: z.iso.datetime(),
  motivoCodigo: z.enum(MOTIVOS_DE_CORRECCION),
  motivoTexto: z.string().nullable(),
  totalAnteriorCentimos: z.number().int(),
  totalNuevoCentimos: z.number().int(),
  deltaCentimos: z.number().int(),
  /** Una frase con el antes y el después (líneas cambiadas y total). */
  resumen: z.string(),
  correccion: correccionDePedidoSchema,
});
export type CorreccionListadaDto = z.infer<typeof correccionListadaSchema>;

export const correccionConAjusteSchema = z.strictObject({ ...correccionListadaSchema.shape, ajuste: ajusteDeDeudaSchema.nullable() });
export type CorreccionConAjusteDto = z.infer<typeof correccionConAjusteSchema>;

export const contratosDeOrdenesCorreccion = {
  pedido_corregir: contrato(corregirPedidoSchema, pedidoCorregidoSchema),
  pedido_correcciones_listar: contrato(listarCorreccionesSchema, listadoSchema(correccionListadaSchema)),
  venta_corregir: contrato(corregirVentaSchema, ventaCorregidaSchema),
  correcciones_listar: contrato(listarCorreccionesSchema, listadoSchema(correccionConAjusteSchema)),
} as const;
