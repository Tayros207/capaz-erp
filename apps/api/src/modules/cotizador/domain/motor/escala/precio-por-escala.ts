import { CANTIDADES_DE_REFERENCIA } from '../base/cantidades-de-referencia.js'
import { correcto, fallo, type Resultado } from '../base/resultado.js'
import {
  aTexto,
  CERO,
  DECIMALES_IMPORTE,
  DECIMALES_UNITARIO,
  decimal,
  dividir,
  esIgual,
  esMayor,
  esMayorOIgual,
  esMenor,
  multiplicar,
  redondear,
  type Decimal,
  type Valor,
} from '../base/dinero.js'
import type {
  CodigoDePrecioPorEscala,
  Punto,
  PrecioPorEscala,
  VariantePrecio,
} from './tipos/precio-por-escala.js'
import { puntosDeReferencia, validarReferencias } from './validar-referencias.js'

const CANTIDAD_MINIMA = CANTIDADES_DE_REFERENCIA[0]
const CANTIDAD_MAXIMA = CANTIDADES_DE_REFERENCIA[2]

/**
 * ÚNICO lugar del sistema donde un importe pasa por coma flotante (ADR-04): `ln` y `exp` no
 * existen en big.js. Interpola ln(unitario) contra ln(cantidad) entre dos referencias (una ley
 * de potencias por tramo), con el unitario sin redondear, y devuelve el total como texto para
 * que el llamador lo redondee una sola vez a céntimos. `null` si el resultado no es finito.
 */
function totalPorCurva(cantidad: Valor, a: Punto, b: Punto): string | null {
  const [q, qa, qb] = [cantidad, a.cantidad, b.cantidad].map((v) => Number(aTexto(v)))
  const lnUnitarioA = Math.log(Number(a.total) / qa)
  const lnUnitarioB = Math.log(Number(b.total) / qb)
  const avance = (Math.log(q) - Math.log(qa)) / (Math.log(qb) - Math.log(qa))
  const total = q * Math.exp(lnUnitarioA + (lnUnitarioB - lnUnitarioA) * avance)
  return Number.isFinite(total) ? String(total) : null
}

/** Escalón: rige el unitario de la mayor referencia que no supera la cantidad. Sin flotantes. */
function totalPorEscalon(cantidad: Valor, puntos: readonly Punto[]): Decimal {
  const base = [...puntos].reverse().find((p) => esMayorOIgual(cantidad, p.cantidad)) ?? puntos[0]
  return dividir(multiplicar(cantidad, base.total), base.cantidad)
}

// En una referencia el total es exactamente el cargado, sin pasar por flotantes: así la curva
// pasa por los tres puntos sin depender de que exp(ln(x)) devuelva x al último decimal.
function totalSinRedondear(
  variante: VariantePrecio,
  cantidad: Valor,
): Resultado<Decimal, 'calculo_invalido'> {
  const puntos = puntosDeReferencia(variante)
  const exacto = puntos.find((p) => esIgual(cantidad, p.cantidad))
  if (exacto) return correcto(decimal(exacto.total))
  if (variante.modoIntermedio === 'escalon') return correcto(totalPorEscalon(cantidad, puntos))

  const [a, b] = esMenor(cantidad, puntos[1].cantidad) ? [puntos[0], puntos[1]] : [puntos[1], puntos[2]]
  const total = totalPorCurva(cantidad, a, b)
  if (total === null) return fallo('calculo_invalido', 'Los precios de referencia no permiten calcular este precio.')
  return correcto(decimal(total))
}

function aplicarMinimo(total: Decimal, minimo: string | undefined) {
  if (minimo !== undefined && esMenor(total, minimo)) {
    return { total: decimal(minimo), minimoAplicado: true }
  }
  return { total, minimoAplicado: false }
}

/**
 * Precio del lote de `cantidad` unidades según las tres referencias de la variante (100, 1.000
 * y 5.000). Entre ellas interpola (`curva`) o mantiene el unitario de la inferior (`escalon`);
 * el total se redondea una sola vez a céntimos y después se aplica el precio mínimo. Fuera de
 * 100–5.000 no extrapola: responde `fuera_de_rango` («cotizar aparte»). Rechaza referencias que
 * violan el invariante B (DEV-01); el A solo avisa al cargarlas y no impide cotizar.
 */
export function calcularPrecioPorEscala(
  variante: VariantePrecio,
  cantidad: string,
): Resultado<PrecioPorEscala, CodigoDePrecioPorEscala> {
  if (!esMayor(cantidad, CERO)) {
    return fallo('cantidad_invalida', 'La cantidad debe ser mayor que cero.')
  }
  if (esMenor(cantidad, CANTIDAD_MINIMA) || esMayor(cantidad, CANTIDAD_MAXIMA)) {
    return fallo(
      'fuera_de_rango',
      `La cantidad ${cantidad} está fuera del rango de ${CANTIDAD_MINIMA} a ${CANTIDAD_MAXIMA} unidades: hay que cotizar aparte.`,
    )
  }
  const [bloqueo] = validarReferencias(variante).bloqueos
  if (bloqueo) return fallo('referencias_invalidas', bloqueo.mensaje)

  const bruto = totalSinRedondear(variante, cantidad)
  if (!bruto.ok) return bruto
  const { total, minimoAplicado } = aplicarMinimo(
    redondear(bruto.valor, DECIMALES_IMPORTE),
    variante.precioMinimo,
  )
  return correcto({
    cantidad,
    total: aTexto(total, DECIMALES_IMPORTE),
    unitario: aTexto(dividir(total, cantidad), DECIMALES_UNITARIO),
    minimoAplicado,
  })
}
