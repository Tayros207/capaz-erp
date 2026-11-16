import { z } from 'zod'
import {
  BASES_DE_UTILIDAD,
  ESCALAS,
  FACTORES,
  type BaseDeUtilidad,
  type Escala,
  type Factor,
} from '../../base/dominio.js'
import { esMenor } from '../../base/dinero.js'
import {
  cantidadSchema,
  costoUnitarioSchema,
  importeSchema,
  porcentajeSchema,
  soloSiNoHayErrores,
} from '../../base/esquemas-decimales.js'

// El vocabulario compartido con la empresa vive en `shared`; se re-exporta para no tocar a los demás.
export { BASES_DE_UTILIDAD, ESCALAS, FACTORES }
export type { BaseDeUtilidad, Escala, Factor }

export type Semaforo = 'verde' | 'ambar' | 'rojo'

// Los importes son texto decimal con punto (ADR-04): estos tipos serializan tal cual a JSONB.
export const lineaSchema = z.strictObject({
  id: z.string().min(1).max(64),
  factor: z.enum(FACTORES),
  descripcion: z.string().trim().min(1, { error: 'Falta la descripción.' }).max(120),
  cantidad: cantidadSchema,
  unidad: z.string().trim().min(1, { error: 'Falta la unidad.' }).max(20),
  costoUnitario: costoUnitarioSchema,
  escala: z.enum(ESCALAS),
})
export type Linea = z.infer<typeof lineaSchema>

export const utilidadSchema = z
  .strictObject({ pct: porcentajeSchema, base: z.enum(BASES_DE_UTILIDAD) })
  .refine((u) => u.base === 'costo' || esMenor(u.pct, '100'), {
    error: 'Con utilidad sobre la venta, el porcentaje debe ser menor que 100.',
    path: ['pct'],
    ...soloSiNoHayErrores,
  })
export type Utilidad = z.infer<typeof utilidadSchema>

/** Lo que el motor de costeo necesita de una cotización (el borrador completo lo amplía). */
export const entradaDeCosteoSchema = z.strictObject({
  lineas: z.array(lineaSchema),
  cantidad: cantidadSchema,
  utilidad: utilidadSchema,
  /** Precio fijado a mano; si falta, rige el sugerido. */
  precioFinal: importeSchema.optional(),
})
export type EntradaDeCosteo = z.infer<typeof entradaDeCosteoSchema>

/**
 * Parte de la configuración de la empresa que usa el motor. Los nombres coinciden con los
 * de `configuracion_empresa`, así que la configuración completa se pasa tal cual.
 */
export const configuracionDeCosteoSchema = z
  .object({ umbralVerdePct: porcentajeSchema, umbralMinimoPct: porcentajeSchema })
  .refine((c) => esMenor(c.umbralMinimoPct, c.umbralVerdePct), {
    error: 'El umbral verde debe ser mayor que el mínimo.',
    path: ['umbralVerdePct'],
    ...soloSiNoHayErrores,
  })
export type ConfiguracionDeCosteo = z.infer<typeof configuracionDeCosteoSchema>

export type LineaCalculada = { id: string; subtotal: string }

/** Resultado del costeo. Todo importe es texto decimal, listo para JSON (`resultado` de la versión). */
export type Calculo = {
  lineas: LineaCalculada[]
  porFactor: Record<Factor, string>
  costoTotal: string
  precioSugerido: string
  /** El precio que rige: el fijado a mano o, si no hay, el sugerido. */
  precio: string
  precioAjustadoAMano: boolean
  utilidad: string
  /** Margen real sobre el precio, con 2 decimales tal como se muestra; `null` si no se puede calcular. */
  margenPct: string | null
  /** Informativo (PLA-03): el total manda, el unitario no se «corrige». */
  unitario: string | null
  semaforo: Semaforo | null
}
