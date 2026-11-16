// Contratos del área «insumos»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Inventario (FICHAS-OLA-3 §2). Cantidades y costos unitarios en milésimas enteras. P3-1: sin existencia
// negativa. P3-2: solo el último costo, informativo. Un movimiento no se edita ni se borra.

export const TIPOS_DE_MOVIMIENTO_DE_INSUMO = ['entrada', 'salida', 'ajuste'] as const;
export type TipoDeMovimientoDeInsumo = (typeof TIPOS_DE_MOVIMIENTO_DE_INSUMO)[number];
/** Lo que se teclea en la hoja «Entrada / Salida»; el ajuste va por `existencia_ajustar`. */
export const TIPOS_DE_MOVIMIENTO_MANUAL = ['entrada', 'salida'] as const;
export const FILTROS_DE_ARTICULOS = ['activos', 'archivados', 'todos'] as const;
export const MAXIMO_DE_LINEAS_DE_RECEPCION = 200;

const texto = (max: number) => z.string().trim().max(max);
const cantidad = z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' });
const noNegativa = (que: string) => z.number().int().safe().min(0, { error: `${que} no puede ser negativo.` });

// --- Salidas ---

/** La existencia de un artículo en una sucursal. Solo hay fila donde alguna vez hubo movimiento (y en la principal al activar). */
export const existenciaPorSucursalSchema = z.strictObject({
  sucursalId: z.string(),
  sucursalCodigo: z.string(),
  sucursalNombre: z.string(),
  cantidadMilesimas: z.number().int(),
  bajoMinimo: z.boolean(),
});
export type ExistenciaPorSucursalDto = z.infer<typeof existenciaPorSucursalSchema>;

/** `bajoMinimo`: alguna sucursal está por debajo del mínimo. `nombre` y `codigo` son los del producto del núcleo. */
export const articuloSchema = z.strictObject({
  id: z.string(),
  productoId: z.string(),
  nombre: z.string(),
  codigo: z.string().nullable(),
  unidad: z.string(),
  minimoMilesimas: z.number().int(),
  ultimoCostoMilesimas: z.number().int().nullable(),
  existenciaTotalMilesimas: z.number().int(),
  bajoMinimo: z.boolean(),
  existencias: z.array(existenciaPorSucursalSchema),
  archivadoEn: z.iso.datetime().nullable(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type ArticuloDto = z.infer<typeof articuloSchema>;

/** Una fila de `existencias_listar`: el artículo en una sucursal. */
export const existenciaSchema = z.strictObject({
  id: z.string(),
  articuloId: z.string(),
  productoId: z.string(),
  nombre: z.string(),
  codigo: z.string().nullable(),
  unidad: z.string(),
  sucursalId: z.string(),
  sucursalCodigo: z.string(),
  sucursalNombre: z.string(),
  cantidadMilesimas: z.number().int(),
  minimoMilesimas: z.number().int(),
  bajoMinimo: z.boolean(),
  actualizadoEn: z.iso.datetime(),
});
export type ExistenciaDto = z.infer<typeof existenciaSchema>;

/** `cantidadMilesimas` con signo: entrada > 0, salida < 0, ajuste ≠ 0. */
export const movimientoDeInsumoSchema = z.strictObject({
  id: z.string(),
  articuloId: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  sucursalId: z.string(),
  sucursalCodigo: z.string(),
  tipo: z.enum(TIPOS_DE_MOVIMIENTO_DE_INSUMO),
  cantidadMilesimas: z.number().int(),
  existenciaResultanteMilesimas: z.number().int(),
  costoUnitarioMilesimas: z.number().int().nullable(),
  motivo: z.string().nullable(),
  origenTipo: z.string().nullable(),
  origenId: z.string().nullable(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
});
export type MovimientoDeInsumoDto = z.infer<typeof movimientoDeInsumoSchema>;

/** Lo que devuelven `existencia_mover` y `existencia_ajustar`: el movimiento y cómo quedó la existencia. */
export const resultadoDeMovimientoDeInsumoSchema = z.strictObject({ movimiento: movimientoDeInsumoSchema, existencia: existenciaSchema });
export type ResultadoDeMovimientoDeInsumo = z.infer<typeof resultadoDeMovimientoDeInsumoSchema>;

/** `repetida`: ese origen ya se había recibido; se devuelven sus movimientos y no se suma nada. */
export const recepcionDeInsumosSchema = z.strictObject({
  origenTipo: z.string(),
  origenId: z.string(),
  repetida: z.boolean(),
  movimientos: z.array(movimientoDeInsumoSchema),
});
export type RecepcionDeInsumosDto = z.infer<typeof recepcionDeInsumosSchema>;

/** Cifras del período: los movimientos se cuentan por el día local de la empresa en que se registraron. */
export const resumenDeInsumosSchema = z.strictObject({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  articulos: z.number().int(),
  articulosBajoMinimo: z.number().int(),
  existenciasBajoMinimo: z.number().int(),
  entradas: z.number().int(),
  salidas: z.number().int(),
  ajustes: z.number().int(),
});
export type ResumenDeInsumos = z.infer<typeof resumenDeInsumosSchema>;

// --- Entradas ---

export const activarArticuloSchema = z.strictObject({
  productoId: z.uuid(),
  minimoMilesimas: noNegativa('El mínimo').optional(),
  unidad: texto(20).min(1, { error: 'La unidad no puede estar vacía.' }).optional(),
});

/** Solo lo que cambia: al menos un campo. */
export const editarArticuloSchema = z
  .strictObject({
    id: z.uuid(),
    minimoMilesimas: noNegativa('El mínimo').optional(),
    unidad: texto(20).min(1, { error: 'La unidad no puede estar vacía.' }).optional(),
  })
  .refine((v) => v.minimoMilesimas !== undefined || v.unidad !== undefined, { error: 'Indica al menos un dato que cambiar.' });

export const listarArticulosSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(FILTROS_DE_ARTICULOS).default('activos'),
  buscar: texto(100).min(1).optional(),
  soloBajoMinimo: z.boolean().default(false),
});

export const listarExistenciasSchema = z.strictObject({
  ...paginaSchema.shape,
  sucursalId: z.uuid().optional(),
  buscar: texto(100).min(1).optional(),
  soloBajoMinimo: z.boolean().default(false),
});

/** Sin `sucursalId`, la sucursal principal. El costo solo acompaña a una entrada. */
export const moverExistenciaSchema = z
  .strictObject({
    articuloId: z.uuid(),
    sucursalId: z.uuid().optional(),
    tipo: z.enum(TIPOS_DE_MOVIMIENTO_MANUAL),
    cantidadMilesimas: cantidad,
    motivo: texto(300).optional(),
    costoUnitarioMilesimas: noNegativa('El costo').optional(),
  })
  .refine((v) => v.tipo === 'entrada' || v.costoUnitarioMilesimas === undefined, { error: 'El costo solo se anota en una entrada.' });

export const lineaDeRecepcionDeInsumosSchema = z.strictObject({
  articuloId: z.uuid(),
  cantidadMilesimas: cantidad,
  costoUnitarioMilesimas: noNegativa('El costo').optional(),
});

export const recibirExistenciasSchema = z.strictObject({
  origenTipo: texto(40).min(1, { error: 'Indica el tipo de origen.' }),
  origenId: texto(100).min(1, { error: 'Indica el origen.' }),
  sucursalId: z.uuid().optional(),
  motivo: texto(300).optional(),
  lineas: z
    .array(lineaDeRecepcionDeInsumosSchema)
    .min(1, { error: 'Indica al menos una línea.' })
    .max(MAXIMO_DE_LINEAS_DE_RECEPCION, { error: 'Una entrada admite hasta 200 líneas.' }),
});

export const ajustarExistenciaSchema = z.strictObject({
  articuloId: z.uuid(),
  sucursalId: z.uuid().optional(),
  existenciaNuevaMilesimas: noNegativa('Lo contado'),
  motivo: texto(300).min(1, { error: 'Indica el motivo del ajuste.' }),
});

export const listarMovimientosDeInsumosSchema = z.strictObject({
  ...paginaSchema.shape,
  articuloId: z.uuid().optional(),
  sucursalId: z.uuid().optional(),
  tipo: z.enum(TIPOS_DE_MOVIMIENTO_DE_INSUMO).optional(),
});

const soloId = z.strictObject({ id: z.uuid() });
const periodo = z.strictObject({ desde: z.iso.date(), hasta: z.iso.date() }).refine((v) => v.desde <= v.hasta, { error: 'El período empieza antes de terminar.' });

export const contratosDeInsumos = {
  articulo_activar: contrato(activarArticuloSchema, articuloSchema),
  articulo_editar: contrato(editarArticuloSchema, articuloSchema),
  articulo_archivar: contrato(soloId, articuloSchema),
  articulos_listar: contrato(listarArticulosSchema, listadoSchema(articuloSchema)),
  articulo_ver: contrato(soloId, articuloSchema),
  existencias_listar: contrato(listarExistenciasSchema, listadoSchema(existenciaSchema)),
  existencia_mover: contrato(moverExistenciaSchema, resultadoDeMovimientoDeInsumoSchema),
  existencias_recibir: contrato(recibirExistenciasSchema, recepcionDeInsumosSchema),
  existencia_ajustar: contrato(ajustarExistenciaSchema, resultadoDeMovimientoDeInsumoSchema),
  existencias_movimientos_listar: contrato(listarMovimientosDeInsumosSchema, listadoSchema(movimientoDeInsumoSchema)),
  insumos_resumen: contrato(periodo, resumenDeInsumosSchema),
} as const;

export const eventosDeInsumos = {
  'existencia.bajo_minimo': z.strictObject({ articuloId: z.string(), sucursalId: z.string(), cantidadMilesimas: z.number().int(), minimoMilesimas: z.number().int() }),
  'existencia.movida': z.strictObject({ articuloId: z.string(), sucursalId: z.string(), tipo: z.enum(['entrada', 'salida', 'ajuste']), cantidadMilesimas: z.number().int() }),
} as const;
