import Big from 'big.js'

// Constructor propio de big.js (ADR-04): no toca la configuración global y, con
// `strict`, lanza si recibe un `number`, así ningún importe entra por un float.
const fabrica = Big()
fabrica.strict = true
fabrica.DP = 20
fabrica.RM = fabrica.roundHalfUp

export type Decimal = Big
export type Valor = Big | string

/** Importes con 2 decimales, unitarios con 4, porcentajes mostrados con 2 y cantidades con 3 (ADR-04). */
export const DECIMALES_IMPORTE = 2
export const DECIMALES_UNITARIO = 4
export const DECIMALES_PORCENTAJE = 2
export const DECIMALES_CANTIDAD = 3

/** Crea un decimal desde texto (o copia otro). Lanza si el texto no es un número. */
export function decimal(valor: Valor): Decimal {
  return new fabrica(valor)
}

export const CERO = decimal('0')
export const CIEN = decimal('100')

export function sumar(...valores: Valor[]): Decimal {
  return valores.reduce<Decimal>((total, valor) => total.plus(decimal(valor)), CERO)
}

export function restar(a: Valor, b: Valor): Decimal {
  return decimal(a).minus(decimal(b))
}

export function multiplicar(a: Valor, b: Valor): Decimal {
  return decimal(a).times(decimal(b))
}

/** Divide con 20 decimales. Dividir entre cero es un error de programación, no de usuario. */
export function dividir(a: Valor, b: Valor): Decimal {
  const divisor = decimal(b)
  if (divisor.eq(CERO)) throw new RangeError('División entre cero.')
  return decimal(a).div(divisor)
}

/** `porcentaje` % de `valor`, sin redondear. */
export function pct(valor: Valor, porcentaje: Valor): Decimal {
  return dividir(multiplicar(valor, porcentaje), CIEN)
}

/** Redondeo half-up (el 5 sube, alejándose del cero) a `decimales` cifras. */
export function redondear(valor: Valor, decimales: number): Decimal {
  return decimal(valor).round(decimales, fabrica.roundHalfUp)
}

/** Menor entero mayor o igual (techo). Nunca `Math.ceil` sobre una división flotante. */
export function techo(valor: Valor): Decimal {
  const v = decimal(valor)
  return v.round(0, v.lt(CERO) ? fabrica.roundDown : fabrica.roundUp)
}

/** Mayor entero menor o igual (piso). */
export function piso(valor: Valor): Decimal {
  const v = decimal(valor)
  return v.round(0, v.lt(CERO) ? fabrica.roundUp : fabrica.roundDown)
}

export function esCero(valor: Valor): boolean {
  return decimal(valor).eq(CERO)
}

export function esIgual(a: Valor, b: Valor): boolean {
  return decimal(a).eq(decimal(b))
}

export function esMenor(a: Valor, b: Valor): boolean {
  return decimal(a).lt(decimal(b))
}

export function esMayor(a: Valor, b: Valor): boolean {
  return decimal(a).gt(decimal(b))
}

export function esMayorOIgual(a: Valor, b: Valor): boolean {
  return decimal(a).gte(decimal(b))
}

/**
 * Texto decimal en notación normal (nunca «1e-7»), listo para JSON. Con `decimales`
 * redondea half-up y rellena con ceros; sin él conserva el valor exacto.
 */
export function aTexto(valor: Valor, decimales?: number): string {
  if (decimales === undefined) return decimal(valor).toFixed()
  // Se redondea antes de serializar: `toFixed` directo deja «-0.00» con -0.001.
  return redondear(valor, decimales).toFixed(decimales)
}
