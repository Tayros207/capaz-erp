import {
  DECIMALES_PORCENTAJE,
  esMayorOIgual,
  esMenor,
  redondear,
  type Valor,
} from '../base/dinero.js'
import type { ConfiguracionDeCosteo, Semaforo } from './tipos/cotizacion.js'

/**
 * Verde desde el umbral verde, rojo bajo el mínimo y ámbar entre los dos. Compara el margen
 * tal como se muestra (2 decimales), no el exacto (PLA-01): con 30 % sobre la venta, 387 de
 * 901 costos enteros de 100 a 1.000 salían en ámbar por comparar el exacto.
 */
export function clasificarMargen(margenPct: Valor, umbrales: ConfiguracionDeCosteo): Semaforo {
  const mostrado = redondear(margenPct, DECIMALES_PORCENTAJE)
  if (esMayorOIgual(mostrado, umbrales.umbralVerdePct)) return 'verde'
  if (esMenor(mostrado, umbrales.umbralMinimoPct)) return 'rojo'
  return 'ambar'
}
