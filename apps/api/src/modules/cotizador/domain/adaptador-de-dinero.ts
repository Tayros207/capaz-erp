// Único cruce entre el texto decimal del motor (motor/base/dinero.ts) y los enteros de Capaz
// (céntimos y milésimas). R22 / ADR-017 §3. No redondea en silencio: ante más decimales, lanza.
import { aTexto, decimal, multiplicar, redondear, dividir } from './motor/base/dinero.js'

const IMPORTE = /^[+-]?\d+(\.\d{1,2})?$/
const CANTIDAD = /^[+-]?\d+(\.\d{1,3})?$/
const UNITARIO = /^[+-]?\d+(\.\d{1,4})?$/
const NUMERO = /^[+-]?\d+(\.\d+)?$/

/** Texto entero (sin decimales) a `number` seguro; el -0 se normaliza a 0. */
function aEnteroSeguro(textoEntero: string, queEs: string): number {
  const n = Number(textoEntero)
  if (!Number.isSafeInteger(n)) throw new RangeError(`${queEs} fuera del rango entero seguro: ${textoEntero}`)
  return n === 0 ? 0 : n
}

function exigir(patron: RegExp, texto: string, queEs: string): void {
  if (typeof texto !== 'string' || !patron.test(texto)) {
    throw new RangeError(`${queEs} no válido: «${String(texto)}»`)
  }
}

/** '346.38' → 34638. Acepta signo y hasta 2 decimales; con más decimales, exponente o texto que no es número lanza RangeError. */
export function importeACentimos(importe: string): number {
  exigir(IMPORTE, importe, 'Importe')
  return aEnteroSeguro(aTexto(multiplicar(importe, '100'), 0), 'Importe')
}

/** 34638 → '346.38'. Siempre 2 decimales. Exige entero seguro. */
export function centimosAImporte(centimos: number): string {
  if (!Number.isSafeInteger(centimos)) throw new RangeError(`Céntimos no es un entero seguro: ${String(centimos)}`)
  return aTexto(dividir(String(centimos), '100'), 2)
}

/** '2500' → 2500000; '0.8' → 800. Hasta 3 decimales; con más, lanza. */
export function cantidadAMilesimas(cantidad: string): number {
  exigir(CANTIDAD, cantidad, 'Cantidad')
  return aEnteroSeguro(aTexto(multiplicar(cantidad, '1000'), 0), 'Cantidad')
}

/** 2500000 → '2500'; 800 → '0.8' (sin ceros de relleno). */
export function milesimasACantidad(milesimas: number): string {
  if (!Number.isSafeInteger(milesimas)) throw new RangeError(`Milésimas no es un entero seguro: ${String(milesimas)}`)
  return aTexto(dividir(String(milesimas), '1000'))
}

/** Unitario informativo del motor (4 decimales) a milésimas de sol, mitad hacia arriba: '0.1386' → 139; '0.3510' → 351. */
export function unitarioAMilesimas(unitario: string): number {
  exigir(UNITARIO, unitario, 'Unitario')
  return aEnteroSeguro(aTexto(redondear(multiplicar(unitario, '1000'), 0), 0), 'Unitario')
}

/** Porcentaje guardado como numeric ('35.000') al texto que espera el motor ('35'). */
export function porcentajeDeBase(valor: string): string {
  exigir(NUMERO, valor, 'Porcentaje')
  return aTexto(decimal(valor))
}
