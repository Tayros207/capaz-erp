import { z } from 'zod'
import { importeConSignoSchema, importeSchema } from '../../base/esquemas-decimales.js'

export const MODOS_INTERMEDIOS = ['curva', 'escalon'] as const
/** Entre referencias: `curva` interpola en log-log; `escalon` mantiene el unitario de la referencia inferior. */
export type ModoIntermedio = (typeof MODOS_INTERMEDIOS)[number]

/** Los tres totales del lote a 100, 1.000 y 5.000 unidades (no unitarios). */
export const referenciasSchema = z.strictObject({
  p100: importeSchema,
  p1000: importeSchema,
  p5000: importeSchema,
})
export type Referencias = z.infer<typeof referenciasSchema>

/** Una variante de producto cotizada por escala: sus tres referencias y cómo se cotiza entre ellas. */
export const variantePrecioSchema = z.strictObject({
  ...referenciasSchema.shape,
  modoIntermedio: z.enum(MODOS_INTERMEDIOS),
  /** Piso del total del lote: un pedido chico nunca sale por debajo. */
  precioMinimo: importeSchema.optional(),
})
export type VariantePrecio = z.infer<typeof variantePrecioSchema>

/** Una variante guardada, tal como se le muestra a quien va a cotizar rápido. */
export type VarianteListada = {
  id: string
  nombre: string
  p100: string
  p1000: string
  p5000: string
  modoIntermedio: ModoIntermedio
  precioMinimo: string | null
}

/** Un producto en la pestaña Precios: la variante más cuánto hace que se fijó su precio y si está archivado. */
export type ProductoDePrecios = VarianteListada & {
  /** Días desde que se fijaron sus precios por última vez (al crearlo o editarlo). */
  diasSinActualizar: number
  archivada: boolean
}

/** Una referencia: cantidad del lote y su total. */
export type Punto = { cantidad: string; total: string }

export type CodigoDeHallazgo = 'precio_no_positivo' | 'total_no_crece' | 'unitario_no_baja'

export type HallazgoDeReferencias = { codigo: CodigoDeHallazgo; mensaje: string }

/**
 * Lo que se encontró al cargar las referencias. Los bloqueos (invariante B: el total no crece)
 * impiden guardarlas; los avisos (invariante A: el unitario no baja) piden confirmación.
 */
export type ValidacionDeReferencias = {
  bloqueos: HallazgoDeReferencias[]
  avisos: HallazgoDeReferencias[]
}

export type PrecioPorEscala = {
  cantidad: string
  /** Total del lote con 2 decimales: es el que manda. */
  total: string
  /** Informativo (PLA-03): `total / cantidad` con 4 decimales; no multiplica de vuelta al total. */
  unitario: string
  minimoAplicado: boolean
}

export type CodigoDePrecioPorEscala =
  | 'cantidad_invalida'
  | 'fuera_de_rango'
  | 'referencias_invalidas'
  | 'calculo_invalido'

/**
 * El ajuste de una cotización rápida: solo vale para esa cotización y nunca toca el precio de lista.
 * `precio` fija el final a mano; `monto` lo sube o lo baja (con signo) sobre la lista.
 */
export const ajusteSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('ninguno') }),
  z.strictObject({ tipo: z.literal('precio'), precio: importeSchema }),
  z.strictObject({ tipo: z.literal('monto'), monto: importeConSignoSchema }),
])
export type Ajuste = z.infer<typeof ajusteSchema>

/** El precio de una cotización rápida: el de lista (del motor) y el final (con el ajuste). */
export type PrecioRapido = {
  /** Lo que da la lista de precios para la cantidad, con el mínimo ya aplicado. */
  precioLista: string
  /** Lo que se le cobra al cliente: la lista con el ajuste. Es el único que ve el cliente. */
  precioFinal: string
  /** Informativo (PLA-03): `precioFinal / cantidad` con 4 decimales. */
  unitario: string
  minimoAplicado: boolean
  /** PRP-006: el % (con signo) del cliente que ya trae `precioLista`; ausente o `null` = ninguno. */
  ajusteClientePct?: string | null
}

export type CodigoDePrecioRapido = CodigoDePrecioPorEscala | 'precio_no_positivo'
