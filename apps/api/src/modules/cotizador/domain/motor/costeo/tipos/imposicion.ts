import { z } from 'zod'
import { dimensionesSchema, etapaDeMermaSchema } from '../../base/medidas.js'
import { cantidadPositivaSchema, medidaSchema } from '../../base/esquemas-decimales.js'

// Las medidas y las etapas de merma viven en `shared/types/medidas` (las usa también la empresa);
// se re-exportan para no tocar a los demás.
export { dimensionesSchema, etapaDeMermaSchema, mermaPctSchema } from '../../base/medidas.js'
export type { Dimensiones, EtapaDeMerma } from '../../base/medidas.js'

/**
 * El bloque «Papel e imposición» del cuadro. Pliego madre y de máquina, sangrado, calle,
 * pinza y formato máximo pueden venir del catálogo (se copian) o escribirse.
 */
export const imposicionSchema = z.strictObject({
  pliegoMadre: dimensionesSchema,
  pliegoMaquina: dimensionesSchema,
  sangradoCm: medidaSchema,
  calleCm: medidaSchema,
  pinzaCm: medidaSchema,
  /** El formato máximo de la máquina elegida; sin máquina, no hay nada que comprobar. */
  formatoMaximo: dimensionesSchema.optional(),
  /** En orden de proceso: la primera etapa es la primera que toca el papel. */
  etapas: z.array(etapaDeMermaSchema).max(10),
})
export type Imposicion = z.infer<typeof imposicionSchema>

/** Sangrado, calle y pinza: lo que separa la medida de la pieza de la que ocupa en el pliego. */
export type Margenes = Pick<Imposicion, 'sangradoCm' | 'calleCm' | 'pinzaCm'>

export const entradaDeImposicionSchema = z.strictObject({
  pieza: dimensionesSchema,
  cantidad: cantidadPositivaSchema,
  imposicion: imposicionSchema,
})
export type EntradaDeImposicion = z.infer<typeof entradaDeImposicionSchema>

/** Cómo se reparte la pieza en un pliego. Poses y conteos como texto, listos para JSON. */
export type Reparto = {
  poses: string
  /** Piezas a lo ancho del pliego. */
  columnas: string
  /** Piezas a lo alto del pliego. */
  filas: string
  /** La pieza va girada 90° respecto del pliego. */
  girada: boolean
}

export type EtapaCalculada = {
  nombre: string
  mermaPct: string
  arranque: string
  /** Hojas buenas que la etapa debe entregar. */
  salida: string
  /** `salida` con el % de merma aplicado hacia atrás y redondeado hacia arriba. */
  trasPorcentaje: string
  /** Hojas que deben entrar a la etapa: `trasPorcentaje` + arranque. */
  entrada: string
}

export type Mermas = {
  /** En orden de proceso, como llegaron. */
  etapas: EtapaCalculada[]
  /** Hojas que deben entrar a la primera etapa (los netos si no hay etapas). */
  bruto: string
}

export type ImposicionCalculada = Reparto & {
  pliegosNetos: string
  etapas: EtapaCalculada[]
  /** Pliegos de máquina brutos: los netos con las mermas de todas las etapas. */
  pliegosDeMaquina: string
  /** Cuántos pliegos de máquina salen de un pliego madre. */
  pliegosPorMadre: string
  pliegosMadre: string
}

const conteo = z.string().regex(/^\d+$/)

/** La forma del resultado de la imposición, para validarlo cuando sale por una herramienta. */
export const imposicionCalculadaSchema = z.strictObject({
  poses: conteo,
  columnas: conteo,
  filas: conteo,
  girada: z.boolean(),
  pliegosNetos: conteo,
  etapas: z.array(
    z.strictObject({
      nombre: z.string(),
      mermaPct: z.string(),
      arranque: z.string(),
      salida: z.string(),
      trasPorcentaje: z.string(),
      entrada: z.string(),
    }),
  ),
  pliegosDeMaquina: conteo,
  pliegosPorMadre: conteo,
  pliegosMadre: conteo,
})

export type CodigoDeImposicion =
  | 'medida_invalida'
  | 'cantidad_invalida'
  | 'pieza_no_cabe'
  | 'pliego_excede_formato'
  | 'maquina_no_cabe_en_madre'
  | 'merma_imposible'
