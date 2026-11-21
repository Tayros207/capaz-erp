import { z } from 'zod';
import { importe } from '../dinero.js';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';
import { fichaDeEntradaShape, fichaDeSalidaShape } from './ficha-de-maquina.js';
import { entradaDePreciosAnterioresSchema, salidaDePreciosAnterioresSchema } from './precios-anteriores.js';

// Producción: órdenes de trabajo del taller (el modelo de SF/Tairos.RC en Capaz). Una orden es de un cliente, lleva una o
// más líneas (cantidad, valor, material, medida, colores, acabado), un adelanto y lo que falta cancelar (saldo).
// Dinero en céntimos enteros; cantidades y precios unitarios en milésimas. El cobro real vive en Finanzas (registro):
// aquí se anota lo acordado y el adelanto, y Finanzas propone la deuda con su adelanto y el cobro del saldo.

export const ESTADOS_DE_ORDEN_DE_PRODUCCION = ['pendiente', 'en_maquina', 'listo', 'entregado', 'anulada'] as const;
export type EstadoDeOrdenDeProduccion = (typeof ESTADOS_DE_ORDEN_DE_PRODUCCION)[number];
/** En cola = lo que el taller tiene por hacer, en máquina o listo para entregar. */
export const FILTROS_DE_ORDENES_DE_PRODUCCION = ['en_cola', ...ESTADOS_DE_ORDEN_DE_PRODUCCION, 'todas'] as const;
export const ESTADOS_DE_PAGO = ['sin_adelanto', 'con_adelanto', 'pagado'] as const;
export type EstadoDePagoDeOrden = (typeof ESTADOS_DE_PAGO)[number];
/** Estados a los que se pasa con `produccion_orden_estado` (anular tiene su herramienta; «pendiente» también reactiva una anulada). */
export const ESTADOS_DESTINO_DE_ORDEN = ['pendiente', 'en_maquina', 'listo', 'entregado'] as const;
export const DESTINOS_DEL_ADELANTO = ['devuelto', 'retenido'] as const;
export const MAXIMO_DE_LINEAS_DE_ORDEN = 50;

const texto = (max: number) => z.string().trim().max(max);
const id = z.uuid();
const dia = z.iso.date();
const centimos = z.number().int().safe().min(0, { error: 'El monto no puede ser negativo.' });

export const lineaDeOrdenSchema = z.strictObject({
  posicion: z.number().int(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
  precioUnitarioMilesimas: z.number().int(),
  subtotalCentimos: z.number().int(),
  ...fichaDeSalidaShape,
});
export type LineaDeOrdenDto = z.infer<typeof lineaDeOrdenSchema>;

export const historialDeOrdenSchema = z.strictObject({
  tipo: z.enum(['creada', 'editada', 'estado', 'anulada', 'cobro']),
  estadoAnterior: z.enum(ESTADOS_DE_ORDEN_DE_PRODUCCION).nullable(),
  estadoNuevo: z.enum(ESTADOS_DE_ORDEN_DE_PRODUCCION),
  nota: z.string().nullable(),
  usuarioId: z.string(),
  creadoEn: z.iso.datetime(),
});

export const ordenDeProduccionSchema = z.strictObject({
  id: z.string(),
  /** «OT-2026-0007». */
  codigo: z.string(),
  numero: z.number().int(),
  anio: z.number().int(),
  estado: z.enum(ESTADOS_DE_ORDEN_DE_PRODUCCION),
  fecha: z.string(),
  entregaEl: z.string().nullable(),
  atrasada: z.boolean(),
  clienteId: z.string(),
  clienteNombre: z.string(),
  /** La primera línea y cuántas más hay: «Mil volantes a todo color (+2 más)». */
  resumen: z.string(),
  totalLineas: z.number().int(),
  totalCentimos: z.number().int(),
  adelantoCentimos: z.number().int(),
  /** Lo que falta cancelar: total menos adelanto. */
  saldoCentimos: z.number().int(),
  estadoDePago: z.enum(ESTADOS_DE_PAGO),
  notas: z.string().nullable(),
  entregadoEn: z.iso.datetime().nullable(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
  destinoAdelanto: z.enum(DESTINOS_DEL_ADELANTO).nullable(),
  creadoEn: z.iso.datetime(),
});
export type OrdenDeProduccionDto = z.infer<typeof ordenDeProduccionSchema>;

export const ordenDeProduccionCompletaSchema = z.strictObject({ ...ordenDeProduccionSchema.shape, lineas: z.array(lineaDeOrdenSchema), historial: z.array(historialDeOrdenSchema) });
export type OrdenDeProduccionCompletaDto = z.infer<typeof ordenDeProduccionCompletaSchema>;

export const lineaDeOrdenEntradaSchema = z.strictObject({
  descripcion: texto(200).min(1, { error: 'Indica el trabajo a realizar.' }),
  unidad: texto(20).optional(),
  cantidadMilesimas: z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' }),
  precioUnitarioMilesimas: z.number().int().safe().min(1, { error: 'El valor debe ser mayor que cero.' }),
  ...fichaDeEntradaShape,
});
export type LineaDeOrdenEntrada = z.infer<typeof lineaDeOrdenEntradaSchema>;

/** Total de una orden: la suma de los subtotales de cada línea, ya redondeados al céntimo (como en SF). */
export const totalDeLineas = (lineas: ReadonlyArray<Pick<LineaDeOrdenEntrada, 'cantidadMilesimas' | 'precioUnitarioMilesimas'>>): number =>
  lineas.reduce((s, l) => s + importe(l.cantidadMilesimas, l.precioUnitarioMilesimas), 0);

const lineas = z.array(lineaDeOrdenEntradaSchema).min(1, { error: 'La orden necesita al menos una línea.' }).max(MAXIMO_DE_LINEAS_DE_ORDEN, { error: `Una orden admite hasta ${MAXIMO_DE_LINEAS_DE_ORDEN} líneas.` });

export const crearOrdenDeProduccionSchema = z
  .strictObject({
    clienteId: id,
    lineas,
    adelantoCentimos: centimos.default(0),
    fecha: dia.optional(),
    entregaEl: dia.nullish(),
    notas: texto(1000).nullish(),
  })
  .refine((v) => v.adelantoCentimos <= totalDeLineas(v.lineas), { error: 'El adelanto no puede ser mayor que el total del trabajo.', path: ['adelantoCentimos'] });

export const editarOrdenDeProduccionSchema = z
  .strictObject({
    id,
    clienteId: id.optional(),
    lineas: lineas.optional(),
    adelantoCentimos: centimos.optional(),
    fecha: dia.optional(),
    entregaEl: dia.nullish(),
    notas: texto(1000).nullish(),
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

export const cambiarEstadoDeOrdenSchema = z.strictObject({ id, estado: z.enum(ESTADOS_DESTINO_DE_ORDEN), nota: texto(300).optional() });
/** Con adelanto hay que decir qué pasó con él: se devolvió o la empresa se lo queda. */
export const anularOrdenDeProduccionSchema = z.strictObject({ id, motivo: texto(300).min(1, { error: 'Indica el motivo.' }), destinoAdelanto: z.enum(DESTINOS_DEL_ADELANTO).optional() });

export const listarOrdenesDeProduccionSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(FILTROS_DE_ORDENES_DE_PRODUCCION).default('en_cola'),
  desde: dia.optional(),
  hasta: dia.optional(),
  clienteId: id.optional(),
  buscar: texto(100).optional(),
});

export const contratosDeProduccion = {
  produccion_precios_anteriores: contrato(entradaDePreciosAnterioresSchema, salidaDePreciosAnterioresSchema),
  produccion_ordenes_listar: contrato(listarOrdenesDeProduccionSchema, listadoSchema(ordenDeProduccionSchema)),
  produccion_orden_ver: contrato(z.strictObject({ id }), ordenDeProduccionCompletaSchema),
  produccion_orden_crear: contrato(crearOrdenDeProduccionSchema, ordenDeProduccionCompletaSchema),
  produccion_orden_editar: contrato(editarOrdenDeProduccionSchema, ordenDeProduccionCompletaSchema),
  produccion_orden_estado: contrato(cambiarEstadoDeOrdenSchema, ordenDeProduccionCompletaSchema),
  produccion_orden_cobrar: contrato(z.strictObject({ id }), ordenDeProduccionCompletaSchema),
  produccion_orden_anular: contrato(anularOrdenDeProduccionSchema, ordenDeProduccionCompletaSchema),
} as const;

export const eventosDeProduccion = {
  'produccion.orden_creada': z.strictObject({
    id: z.string(),
    codigo: z.string(),
    clienteId: z.string(),
    descripcion: z.string(),
    totalCentimos: z.number().int(),
    adelantoCentimos: z.number().int(),
    entregaEl: z.iso.date().nullable(),
  }),
  'produccion.orden_entregada': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), saldoCentimos: z.number().int() }),
  /** «Anotar que ya me pagó»: Finanzas propone cobrar lo que falta. */
  'produccion.orden_cobro_pedido': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), saldoCentimos: z.number().int() }),
  'produccion.orden_corregida': z.strictObject({
    id: z.string(),
    codigo: z.string(),
    clienteId: z.string(),
    totalAnteriorCentimos: z.number().int(),
    totalNuevoCentimos: z.number().int(),
    adelantoAnteriorCentimos: z.number().int(),
    adelantoNuevoCentimos: z.number().int(),
    entregaAnterior: z.iso.date().nullable(),
    entregaNueva: z.iso.date().nullable(),
  }),
  'produccion.orden_anulada': z.strictObject({ id: z.string(), codigo: z.string(), adelantoCentimos: z.number().int(), destinoAdelanto: z.enum(DESTINOS_DEL_ADELANTO).nullable() }),
} as const;
