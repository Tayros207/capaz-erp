import type { Referencias } from './tipos/precio-por-escala.js'
import { DECIMALES_IMPORTE, aTexto, pct, redondear, sumar } from '../base/dinero.js'

/** Los precios de un producto que se ajustan juntos: las tres referencias y, si tiene, el mínimo. */
export type PreciosDeProducto = Referencias & { precioMinimo: string | null }

const subir = (importe: string, porcentaje: string): string =>
  aTexto(redondear(sumar(importe, pct(importe, porcentaje)), DECIMALES_IMPORTE), DECIMALES_IMPORTE)

/**
 * Sube (o baja, con signo negativo) `porcentaje` % los precios de un producto: cada total y el mínimo,
 * redondeados al centavo (half-up). Es un cambio proporcional: la relación entre las referencias se
 * conserva, salvo por el redondeo de centavos.
 */
export function ajustarPrecios(p: PreciosDeProducto, porcentaje: string): PreciosDeProducto {
  return {
    p100: subir(p.p100, porcentaje),
    p1000: subir(p.p1000, porcentaje),
    p5000: subir(p.p5000, porcentaje),
    precioMinimo: p.precioMinimo === null ? null : subir(p.precioMinimo, porcentaje),
  }
}
