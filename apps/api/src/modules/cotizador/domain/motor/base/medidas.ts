import { z } from 'zod'
import { esMenor } from './dinero.js'
import {
  hojasSchema,
  medidaPositivaSchema,
  porcentajeSchema,
  soloSiNoHayErrores,
} from './esquemas-decimales.js'

// Las medidas son centímetros y todo viaja como texto (ADR-04), igual que los importes. Viven en
// `shared` porque las usan la cotización (imposición) y la empresa (formatos y máquinas).

/** Ancho × alto: una pieza, un pliego o el formato máximo de una máquina. */
export const dimensionesSchema = z.strictObject({
  anchoCm: medidaPositivaSchema,
  altoCm: medidaPositivaSchema,
})
export type Dimensiones = z.infer<typeof dimensionesSchema>

/** Con 100 % de merma no saldría nunca una hoja buena: el porcentaje va por debajo de 100. */
export const mermaPctSchema = porcentajeSchema.refine((p) => esMenor(p, '100'), {
  error: 'La merma debe ser menor que 100 %.',
  ...soloSiNoHayErrores,
})

/** Una etapa del proceso con su merma: arranque fijo en hojas (INF-01) más un % de tiraje. */
export const etapaDeMermaSchema = z.strictObject({
  nombre: z.string().trim().min(1, { error: 'Falta el nombre de la etapa.' }).max(60),
  mermaPct: mermaPctSchema,
  arranque: hojasSchema,
})
export type EtapaDeMerma = z.infer<typeof etapaDeMermaSchema>
