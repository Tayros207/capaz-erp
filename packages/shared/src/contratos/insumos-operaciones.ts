import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Inventario · operaciones de empresa grande (0026): transferencias entre sucursales, inventario físico (conteos)
// y kardex valorizado. Cantidades y costos unitarios en milésimas enteras; dinero en céntimos.

export const ESTADOS_DE_CONTEO = ['abierto', 'cerrado', 'anulado'] as const;
export type EstadoDeConteo = (typeof ESTADOS_DE_CONTEO)[number];
export const FILTROS_DE_CONTEOS = ['abiertos', 'cerrados', 'anulados', 'todos'] as const;
export const MAXIMO_DE_LINEAS_DE_OPERACION = 200;

const texto = (max: number) => z.string().trim().max(max);
const id = z.uuid();
const soloId = z.strictObject({ id });
const fechaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'La fecha debe ser AAAA-MM-DD.' });
const cantidad = z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' });

// --- Transferencias ---

export const transferenciaLineaSchema = z.strictObject({
  articuloId: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
});

export const transferenciaDeInsumosSchema = z.strictObject({
  id: z.string(),
  numero: z.number().int(),
  anio: z.number().int(),
  origenSucursalId: z.string(),
  origenCodigo: z.string(),
  destinoSucursalId: z.string(),
  destinoCodigo: z.string(),
  fecha: z.string(),
  nota: z.string().nullable(),
  lineas: z.array(transferenciaLineaSchema),
  creadoEn: z.iso.datetime(),
});
export type TransferenciaDeInsumosDto = z.infer<typeof transferenciaDeInsumosSchema>;

export const crearTransferenciaSchema = z.strictObject({
  origenSucursalId: id,
  destinoSucursalId: id,
  fecha: fechaDia.optional(),
  nota: texto(500).optional(),
  lineas: z
    .array(z.strictObject({ articuloId: id, cantidadMilesimas: cantidad }))
    .min(1, { error: 'Indica al menos un artículo.' })
    .max(MAXIMO_DE_LINEAS_DE_OPERACION, { error: `Máximo ${MAXIMO_DE_LINEAS_DE_OPERACION} artículos por transferencia.` }),
});

// --- Inventario físico ---

export const conteoLineaSchema = z.strictObject({
  articuloId: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  sistemaMilesimas: z.number().int(),
  contadaMilesimas: z.number().int().nullable(),
  /** Contada menos lo que decía el sistema al abrir; nulo si aún no se contó. */
  diferenciaMilesimas: z.number().int().nullable(),
  /** Al cerrar: el ajuste que se registró; nulo si no hubo diferencia o no se contó. */
  movimientoId: z.string().nullable(),
});

export const conteoSchema = z.strictObject({
  id: z.string(),
  numero: z.number().int(),
  anio: z.number().int(),
  sucursalId: z.string(),
  sucursalCodigo: z.string(),
  estado: z.enum(ESTADOS_DE_CONTEO),
  nota: z.string().nullable(),
  lineas: z.array(conteoLineaSchema),
  totalLineas: z.number().int(),
  lineasContadas: z.number().int(),
  cerradoEn: z.iso.datetime().nullable(),
  anuladoEn: z.iso.datetime().nullable(),
  creadoEn: z.iso.datetime(),
});
export type ConteoDto = z.infer<typeof conteoSchema>;
export type ConteoLineaDto = z.infer<typeof conteoLineaSchema>;

/** Fila de `conteos_listar`: sin las líneas. */
export const conteoResumenSchema = conteoSchema.omit({ lineas: true });
export type ConteoResumenDto = z.infer<typeof conteoResumenSchema>;

export const abrirConteoSchema = z.strictObject({
  sucursalId: id.optional(),
  nota: texto(500).optional(),
  /** Sin artículos: entran todos los activos que tienen existencia registrada en la sucursal. */
  articuloIds: z.array(id).min(1).max(MAXIMO_DE_LINEAS_DE_OPERACION).optional(),
});

export const registrarConteoSchema = z.strictObject({
  id,
  lineas: z
    .array(z.strictObject({ articuloId: id, contadaMilesimas: z.number().int().safe().min(0, { error: 'Lo contado no puede ser negativo.' }) }))
    .min(1, { error: 'Indica al menos un artículo contado.' })
    .max(MAXIMO_DE_LINEAS_DE_OPERACION),
});

export const anularConteoSchema = z.strictObject({ id, motivo: texto(300).min(1, { error: 'Indica el motivo.' }) });

export const listarConteosSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(FILTROS_DE_CONTEOS).default('todos'),
  sucursalId: id.optional(),
});

export const listarTransferenciasSchema = z.strictObject({ ...paginaSchema.shape, sucursalId: id.optional() });

// --- Kardex valorizado ---

export const TIPOS_DE_FILA_DE_KARDEX = ['entrada', 'salida', 'ajuste'] as const;

export const kardexFilaSchema = z.strictObject({
  movimientoId: z.string(),
  fecha: z.iso.datetime(),
  tipo: z.enum(TIPOS_DE_FILA_DE_KARDEX),
  motivo: z.string().nullable(),
  entradaMilesimas: z.number().int(),
  salidaMilesimas: z.number().int(),
  saldoMilesimas: z.number().int(),
  /** Costo unitario del movimiento (solo entradas que lo traen). */
  costoUnitarioMilesimas: z.number().int().nullable(),
  /** Costo promedio ponderado móvil después del movimiento. */
  costoPromedioMilesimas: z.number().int(),
  saldoValorizadoCentimos: z.number().int(),
});

export const kardexSchema = z.strictObject({
  articuloId: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  sucursalId: z.string().nullable(),
  items: z.array(kardexFilaSchema),
  saldoMilesimas: z.number().int(),
  costoPromedioMilesimas: z.number().int(),
  valorTotalCentimos: z.number().int(),
  /** Hay movimientos de entrada sin costo: el valor es una estimación con el promedio disponible. */
  costosIncompletos: z.boolean(),
});
export type KardexDto = z.infer<typeof kardexSchema>;

export const kardexPedidoSchema = z.strictObject({ articuloId: id, sucursalId: id.optional() });

export const contratosDeInsumosOperaciones = {
  transferencia_crear: contrato(crearTransferenciaSchema, transferenciaDeInsumosSchema),
  transferencia_ver: contrato(soloId, transferenciaDeInsumosSchema),
  transferencias_listar: contrato(listarTransferenciasSchema, listadoSchema(transferenciaDeInsumosSchema)),
  conteo_abrir: contrato(abrirConteoSchema, conteoSchema),
  conteo_registrar: contrato(registrarConteoSchema, conteoSchema),
  conteo_cerrar: contrato(soloId, conteoSchema),
  conteo_anular: contrato(anularConteoSchema, conteoSchema),
  conteo_ver: contrato(soloId, conteoSchema),
  conteos_listar: contrato(listarConteosSchema, listadoSchema(conteoResumenSchema)),
  existencias_kardex: contrato(kardexPedidoSchema, kardexSchema),
} as const;

export const eventosDeInsumosOperaciones = {
  'transferencia.creada': z.strictObject({ id: z.string(), origenSucursalId: z.string(), destinoSucursalId: z.string(), lineas: z.number().int() }),
  'conteo.cerrado': z.strictObject({ id: z.string(), sucursalId: z.string(), ajustes: z.number().int() }),
} as const;
