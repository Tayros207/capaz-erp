import { correcto, fallo, type Resultado } from '../base/resultado.js'
import {
  aTexto,
  CERO,
  CIEN,
  DECIMALES_IMPORTE,
  DECIMALES_PORCENTAJE,
  DECIMALES_UNITARIO,
  decimal,
  dividir,
  esMayor,
  esMayorOIgual,
  multiplicar,
  redondear,
  restar,
  sumar,
  type Decimal,
  type Valor,
} from '../base/dinero.js'
import {
  FACTORES,
  type Calculo,
  type ConfiguracionDeCosteo,
  type EntradaDeCosteo,
  type Factor,
  type Linea,
  type Semaforo,
  type Utilidad,
} from './tipos/cotizacion.js'
import { clasificarMargen } from './semaforo.js'

export type MargenCalculado = { exactoPct: Decimal; mostradoPct: Decimal }

/**
 * Margen real = (precio − costo) / precio. `null` si el precio no es positivo (no hay
 * sobre qué calcularlo). Devuelve el exacto y el que se muestra (2 decimales).
 */
export function calcularMargen(precio: Valor, costo: Valor): MargenCalculado | null {
  if (!esMayor(precio, CERO)) return null
  const exactoPct = dividir(multiplicar(restar(precio, costo), CIEN), precio)
  return { exactoPct, mostradoPct: redondear(exactoPct, DECIMALES_PORCENTAJE) }
}

// Cada subtotal se redondea a 2 decimales y esos son los que se suman: lo que se imprime
// siempre cuadra con el total.
function subtotalDeLinea(linea: Linea): Decimal {
  return redondear(multiplicar(linea.cantidad, linea.costoUnitario), DECIMALES_IMPORTE)
}

function costosPorFactor(
  lineas: readonly Linea[],
  subtotales: readonly Decimal[],
): Record<Factor, Decimal> {
  const porFactor = Object.fromEntries(FACTORES.map((f) => [f, CERO])) as Record<Factor, Decimal>
  lineas.forEach((linea, i) => {
    porFactor[linea.factor] = sumar(porFactor[linea.factor], subtotales[i])
  })
  return porFactor
}

/** Sobre la venta: costo / (1 − %) = costo × 100 / (100 − %). Sobre el costo: costo × (1 + %). */
function precioSugerido(
  costo: Decimal,
  utilidad: Utilidad,
): Resultado<Decimal, 'utilidad_imposible'> {
  if (utilidad.base === 'costo') {
    const conRecargo = multiplicar(costo, sumar(CIEN, utilidad.pct))
    return correcto(redondear(dividir(conRecargo, CIEN), DECIMALES_IMPORTE))
  }
  if (esMayorOIgual(utilidad.pct, CIEN)) {
    return fallo(
      'utilidad_imposible',
      'Con utilidad sobre la venta, el porcentaje debe ser menor que 100.',
    )
  }
  const enVenta = dividir(multiplicar(costo, CIEN), restar(CIEN, utilidad.pct))
  return correcto(redondear(enVenta, DECIMALES_IMPORTE))
}

function unitarioDe(precio: Decimal, cantidad: Valor): string | null {
  if (!esMayor(precio, CERO) || !esMayor(cantidad, CERO)) return null
  return aTexto(dividir(precio, cantidad), DECIMALES_UNITARIO)
}

// Sin margen calculable hay dos casos: cuadro vacío (sin semáforo) o precio 0 con costo
// (se regala el trabajo: rojo).
function semaforoDelPrecio(
  margen: MargenCalculado | null,
  costoTotal: Decimal,
  config: ConfiguracionDeCosteo,
): Semaforo | null {
  if (margen) return clasificarMargen(margen.mostradoPct, config)
  return esMayor(costoTotal, CERO) ? 'rojo' : null
}

/** Lo que sale del costo total en adelante: precio, utilidad, margen, unitario y semáforo (todo de `Calculo` menos las filas, el costo por factor y el costo). */
export type Costeo = Omit<Calculo, 'lineas' | 'porFactor' | 'costoTotal'>

/**
 * Del costo total al precio: sugerido (con la utilidad), el que rige (el fijado a mano o, si no hay, el
 * sugerido), utilidad bruta, margen real, unitario y semáforo. Es la cuenta que comparten el costeo de un
 * cuadro y cada columna del cuadro directo (PRP-007): una sola fuente, así no pueden discrepar.
 */
export function costear(
  costoTotal: Decimal,
  cantidad: Valor,
  utilidad: Utilidad,
  precioFinal: string | undefined,
  config: ConfiguracionDeCosteo,
): Resultado<Costeo, 'utilidad_imposible'> {
  const sugerido = precioSugerido(costoTotal, utilidad)
  if (!sugerido.ok) return sugerido

  const precio = precioFinal === undefined ? sugerido.valor : decimal(precioFinal)
  const margen = calcularMargen(precio, costoTotal)
  return correcto({
    precioSugerido: aTexto(sugerido.valor, DECIMALES_IMPORTE),
    precio: aTexto(precio, DECIMALES_IMPORTE),
    precioAjustadoAMano: precioFinal !== undefined,
    utilidad: aTexto(restar(precio, costoTotal), DECIMALES_IMPORTE),
    margenPct: margen ? aTexto(margen.mostradoPct, DECIMALES_PORCENTAJE) : null,
    unitario: unitarioDe(precio, cantidad),
    semaforo: semaforoDelPrecio(margen, costoTotal, config),
  })
}

/**
 * Filas → subtotal por factor → costo → precio → utilidad bruta → margen real → unitario →
 * semáforo. Función pura: la configuración llega como parámetro.
 */
export function calcularCotizacion(
  entrada: EntradaDeCosteo,
  config: ConfiguracionDeCosteo,
): Resultado<Calculo, 'utilidad_imposible'> {
  const subtotales = entrada.lineas.map(subtotalDeLinea)
  const porFactor = costosPorFactor(entrada.lineas, subtotales)
  const costoTotal = sumar(...FACTORES.map((f) => porFactor[f]))
  const costeo = costear(costoTotal, entrada.cantidad, entrada.utilidad, entrada.precioFinal, config)
  if (!costeo.ok) return costeo
  return correcto({
    lineas: entrada.lineas.map((l, i) => ({
      id: l.id,
      subtotal: aTexto(subtotales[i], DECIMALES_IMPORTE),
    })),
    porFactor: Object.fromEntries(
      FACTORES.map((f) => [f, aTexto(porFactor[f], DECIMALES_IMPORTE)]),
    ) as Record<Factor, string>,
    costoTotal: aTexto(costoTotal, DECIMALES_IMPORTE),
    ...costeo.valor,
  })
}
