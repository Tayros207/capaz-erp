import type { Calculo, Linea } from './cotizacion.js'
import type { CodigoDeImposicion, Dimensiones, Imposicion, ImposicionCalculada } from './imposicion.js'

/**
 * El bloque «Papel e imposición» del cuadro. Con él se conocen los pliegos, que es lo que
 * permite escalar las filas `por_pliego` y recalcular el papel.
 */
export type PapelEImposicion = {
  pieza: Dimensiones
  imposicion: Imposicion
  /**
   * La fila de material que llena el motor (su cantidad son los pliegos madre). `null` si el
   * papel se escribió a mano: entonces esa fila escala como cualquier otra, según su `escala`.
   */
  lineaDePapelId: string | null
}

export type CuadroEscalable = {
  lineas: readonly Linea[]
  /** La cantidad del trabajo con la que están anotadas las filas. */
  cantidad: string
  /** Sin este bloque no hay pliegos: solo se pueden escalar las filas `fija` y `por_unidad`. */
  papel?: PapelEImposicion
}

export type CuadroEscalado = {
  cantidad: string
  lineas: Linea[]
  /** La imposición a la nueva cantidad; `null` si el cuadro no tiene papel e imposición. */
  imposicion: ImposicionCalculada | null
}

export type CodigoDeEscalado = CodigoDeImposicion | 'imposicion_requerida' | 'papel_no_encontrado'

export type ReferenciasGeneradas = {
  /** Precios sugeridos (costo más utilidad) del lote a 100, 1.000 y 5.000 unidades. */
  p100: string
  p1000: string
  p5000: string
  /** El cuadro costeado a cada cantidad, por si la pantalla quiere mostrar el margen de cada una. */
  calculos: { cantidad: string; calculo: Calculo }[]
}
