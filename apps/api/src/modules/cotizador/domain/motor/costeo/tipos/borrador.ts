import { z } from 'zod'
import { ajusteSchema, MODOS_INTERMEDIOS, type PrecioRapido } from '../../escala/tipos/precio-por-escala.js'
import type { ConfiguracionEmpresa } from '../../base/empresa.js'
import { cantidadSchema, importeSchema, medidaSchema } from '../../base/esquemas-decimales.js'
import { lineaSchema, utilidadSchema, type Calculo } from './cotizacion.js'
import { directoSchema, type CuadroDirectoCalculado } from './cuadro-directo.js'
import { dimensionesSchema, etapaDeMermaSchema, type ImposicionCalculada } from './imposicion.js'

/** Tope de filas de un cuadro: un guardarraíl contra un agente que entre en bucle agregando filas. */
export const MAX_LINEAS = 60

/** Producto, cantidad, medidas de la pieza, tintas y caras, y cliente. La cantidad '0' es «sin fijar». */
export const trabajoSchema = z.strictObject({
  producto: z.string().trim().max(120),
  /** Qué lleva el producto (papel, acabados, medidas...): se imprime bajo el nombre en el PDF y en el enlace. Ausente = sin descripción. */
  descripcion: z.string().trim().max(600).optional(),
  cantidad: cantidadSchema,
  pieza: dimensionesSchema.nullable(),
  tintas: z.number().int().min(0).max(12),
  caras: z.number().int().min(1).max(2),
  cliente: z.string().trim().max(120),
})
export type Trabajo = z.infer<typeof trabajoSchema>

/**
 * La imposición tal como se va llenando (por voz llega de a un dato). Está completa cuando tiene
 * el pliego madre, el de máquina, el sangrado, la calle y la pinza; el formato máximo es opcional.
 */
export const imposicionParcialSchema = z.strictObject({
  pliegoMadre: dimensionesSchema.nullable(),
  pliegoMaquina: dimensionesSchema.nullable(),
  sangradoCm: medidaSchema.nullable(),
  calleCm: medidaSchema.nullable(),
  pinzaCm: medidaSchema.nullable(),
  formatoMaximo: dimensionesSchema.nullable(),
  etapas: z.array(etapaDeMermaSchema).max(10),
})
export type ImposicionParcial = z.infer<typeof imposicionParcialSchema>

/** Lo anotado en una cotización: es la «entrada» de una versión, con importes como texto. */
export const cuadroSchema = z.strictObject({
  trabajo: trabajoSchema,
  imposicion: imposicionParcialSchema,
  lineas: z.array(lineaSchema).max(MAX_LINEAS),
  utilidad: utilidadSchema,
  /** Precio fijado a mano; `null` rige el sugerido. */
  precioFinal: importeSchema.nullable(),
  /** Ids de las filas que el motor mantiene: el papel (imposición) y las planchas (tintas × caras). */
  automaticas: z.strictObject({ papel: z.string().nullable(), planchas: z.string().nullable() }),
  /** Contador de ids de fila: sube siempre, para no reutilizar el id de una fila quitada. */
  siguienteLinea: z.number().int().min(1),
  /**
   * El cuadro de costos directo (PRP-007): lo escrito a mano, los ítems propios, la utilidad por columna
   * y las columnas que se envían. Ausente en lo guardado antes de ese PRP: se lee como «nada escrito».
   */
  directo: directoSchema.optional(),
})
export type Cuadro = z.infer<typeof cuadroSchema>

/** La foto que congela una versión al emitirse. */
export type Emision = {
  emitidaEn: string
  emitidaPor: string
  /** La configuración con la que se calculó: cambiarla después no reescribe la versión. */
  configuracion: ConfiguracionEmpresa
  calculo: Calculo
  imposicion: ImposicionCalculada | null
  /** Motivo escrito al emitir con el margen bajo el mínimo (semáforo rojo). */
  motivoMargenBajo: string | null
  /** Las tres columnas del cuadro directo tal como estaban al emitir (PRP-007); ausente en las anteriores. */
  directo?: CuadroDirectoCalculado
}
/** Lo que aporta quien emite. La fecha y la persona las estampa el repositorio (en Neon, `now()`). */
export type DatosDeEmision = Omit<Emision, 'emitidaPor' | 'emitidaEn'>

export type EstadoDeVersion = 'borrador' | 'emitida'

/**
 * Lo anotado en una cotización rápida (PRP-005): de qué producto de la lista sale, cuántas unidades,
 * para quién y el ajuste de precio que vale solo para ella. El precio de lista no se guarda aquí: en
 * un borrador se lee del producto vigente, y al emitir se congela en la `EmisionRapida`.
 */
/** Otra cantidad del mismo producto que se le ofrece al cliente (PRP-006 Fase 4), con su propio ajuste. */
export const opcionRapidaSchema = z.strictObject({ cantidad: cantidadSchema, ajuste: ajusteSchema })
export type OpcionRapida = z.infer<typeof opcionRapidaSchema>

/** Cuántas cantidades distintas puede tener una rápida además de la principal. */
export const MAXIMO_DE_ALTERNATIVAS = 4

/** Otro producto de la misma cotización rápida (PRP-006 Fase 5): su cantidad y su ajuste propios. */
export const lineaRapidaSchema = z.strictObject({
  varianteId: z.string().min(1),
  producto: z.string().trim().min(1).max(120),
  cantidad: cantidadSchema,
  ajuste: ajusteSchema,
})
export type LineaRapida = z.infer<typeof lineaRapidaSchema>

/** Cuántos productos más puede llevar una rápida además del principal. */
export const MAXIMO_DE_LINEAS_ADICIONALES = 9

export const rapidaSchema = z.strictObject({
  varianteId: z.string().min(1),
  /** El nombre del producto al crear la cotización (el que se muestra, aunque luego se renombre). */
  producto: z.string().trim().min(1).max(120),
  cantidad: cantidadSchema,
  cliente: z.string().trim().max(120),
  ajuste: ajusteSchema,
  /** Otras cantidades que se le ofrecen al cliente junto a la principal; ausente = una sola cantidad. */
  alternativas: z.array(opcionRapidaSchema).max(MAXIMO_DE_ALTERNATIVAS).optional(),
  /** Otros productos de la misma cotización, que se suman al principal; ausente = un solo producto. No convive con `alternativas`. */
  lineas: z.array(lineaRapidaSchema).max(MAXIMO_DE_LINEAS_ADICIONALES).optional(),
})
export type Rapida = z.infer<typeof rapidaSchema>

/** El producto de la lista tal como estaba al emitir: cambiarlo después no cambia la emitida. */
export const varianteCongeladaSchema = z.strictObject({
  nombre: z.string(),
  p100: importeSchema,
  p1000: importeSchema,
  p5000: importeSchema,
  modoIntermedio: z.enum(MODOS_INTERMEDIOS),
  precioMinimo: importeSchema.nullable(),
})
export type VarianteCongelada = z.infer<typeof varianteCongeladaSchema>

/** El precio congelado de una cantidad alternativa. */
export type OpcionEmitida = { cantidad: string; precio: PrecioRapido }

/** El precio congelado de otro producto de la cotización, con sus referencias tal como estaban. */
export type LineaEmitida = { varianteId: string; producto: string; cantidad: string; variante: VarianteCongelada; precio: PrecioRapido }

/** La foto que congela una cotización rápida al emitirse. Sin costo ni margen: no los tiene. */
export type EmisionRapida = {
  emitidaEn: string
  emitidaPor: string
  configuracion: ConfiguracionEmpresa
  variante: VarianteCongelada
  precio: PrecioRapido
  /** Las otras cantidades que se ofrecieron (PRP-006 Fase 4); ausente = ninguna. */
  alternativas?: OpcionEmitida[]
  /** Los otros productos (PRP-006 Fase 5) y lo que suman junto al principal; ausentes = un solo producto. */
  lineas?: LineaEmitida[]
  total?: { precioLista: string; precioFinal: string }
}
export type DatosDeEmisionRapida = Omit<EmisionRapida, 'emitidaPor' | 'emitidaEn'>

type BaseDeVersion = {
  cotizacionId: string
  version: number
  /** Correlativo de la empresa, asignado al emitir la primera versión. */
  numero: number | null
  estado: EstadoDeVersion
}

/** Una versión armada por partes (el cuadro de costos). */
export type VersionCuadro = BaseDeVersion & { modo: 'cuadro'; cuadro: Cuadro; emision: Emision | null }
/** Una versión rápida: sale de un producto de la lista de precios. */
export type VersionRapida = BaseDeVersion & { modo: 'escala'; rapida: Rapida; emision: EmisionRapida | null }

/** Una versión de una cotización. Al emitirse queda inmutable; corregirla es abrir otra versión. */
export type Version = VersionCuadro | VersionRapida
export type ModoDeVersion = Version['modo']
