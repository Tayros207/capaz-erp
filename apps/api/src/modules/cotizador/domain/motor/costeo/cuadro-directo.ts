import { validarReferencias } from '../escala/validar-referencias.js'
import type { ConfiguracionEmpresa } from '../base/empresa.js'
import { FACTORES, type BaseDeUtilidad, type Factor } from '../base/dominio.js'
import { correcto, fallo, type Resultado } from '../base/resultado.js'
import {
  aTexto, CERO, CIEN, DECIMALES_IMPORTE, DECIMALES_PORCENTAJE, dividir, esMayor, multiplicar, redondear, restar, sumar, techo,
} from '../base/dinero.js'
import { conImpuesto } from '../base/impuesto.js'
import { DESCUENTO_DE_MATERIAL_POR_VOLUMEN, UNIDADES_POR_MILLAR } from './constantes/deduccion.js'
import { ETIQUETA_DE_FACTOR } from './constantes/factores.js'
import type { Cuadro } from './tipos/borrador.js'
import type { Calculo, LineaCalculada, Utilidad } from './tipos/cotizacion.js'
import {
  COLUMNAS, columnaDe, directoVacio,
  type CeldaCalculada, type Columna, type ColumnaCalculada, type CuadroDirectoCalculado, type Directo, type FilaCalculada,
} from './tipos/cuadro-directo.js'
import { calcularCotizacion, costear } from './calcular-cotizacion.js'
import { cuadroEscalable, sincronizarFilas, type Sincronizacion } from './cuadro.js'
import { escalarCuadro } from './escalar-cuadro.js'

// El motor del cuadro de costos directo (PRP-007): las tres columnas (100 / 1.000 / 5.000) de una
// cotización por partes. Es función pura y la ÚNICA fuente de los números del cuadro, de las referencias
// que se guardan en Precios y de los precios que se emiten.
//
// La regla de cada celda (R3 y R4): lo escrito a mano manda; si no hay, lo que da el detalle de esa fila
// a esa cantidad; si no hay detalle, se DEDUCE de lo escrito a mano en otra columna de la misma fila (la
// más cercana): el mismo importe si la fila es fija (placa, diseño); la impresión por millares completos
// (100 cuesta lo mismo que 1.000); el material proporcional con −2 % por volumen en 5.000; y lo demás
// proporcional a la cantidad (300 el millar → 30 el ciento). Sin nada escrito en la fila, cero. Los
// ítems adicionales no tienen detalle: a mano, deducido o cero.

const SIN_UTILIDAD: Utilidad = { pct: '0', base: 'costo' }
const ceroImporte = aTexto(CERO, DECIMALES_IMPORTE)

type Detalle =
  | { ok: true; porFactor: Record<Factor, string>; lineas: LineaCalculada[] }
  | { ok: false; codigo: string; motivo: string }

/** El detalle (filas de costo) corrido a una cantidad: el de la base tal cual, el de las otras escalado (R3). */
function detalleA(columna: Columna, base: Columna | null, sinc: Sincronizacion, cuadro: Cuadro, config: ConfiguracionEmpresa): Detalle {
  const ceros = Object.fromEntries(FACTORES.map((f) => [f, ceroImporte])) as Record<Factor, string>
  if (cuadro.lineas.length === 0) return { ok: true, porFactor: ceros, lineas: [] }

  let lineas = cuadro.lineas
  if (columna !== base) {
    const escalado = escalarCuadro(cuadroEscalable(sinc), columna)
    if (!escalado.ok) return { ok: false, codigo: escalado.error.codigo, motivo: escalado.error.mensaje }
    lineas = escalado.valor.lineas
  }
  const calculo = calcularCotizacion({ lineas, cantidad: columna, utilidad: SIN_UTILIDAD }, config)
  if (!calculo.ok) return { ok: false, codigo: calculo.error.codigo, motivo: calculo.error.mensaje }
  return { ok: true, porFactor: calculo.valor.porFactor, lineas: calculo.valor.lineas }
}

/** Por qué el papel no se puede calcular todavía, si el papel está ligado al motor y le faltan datos. */
function motivoDelPapel(sinc: Sincronizacion): string | null {
  if (sinc.cuadro.automaticas.papel === null) return null
  if (sinc.problema) return `El papel aún no está calculado: ${sinc.problema.mensaje}.`
  if (sinc.faltantes.length > 0) return `El papel aún no está calculado: falta ${sinc.faltantes.join(', ')}.`
  return null
}

type EntornoDeCelda = { detalle: Detalle; hayFilas: boolean; motivoDelPapel: string | null }

/** Una celda de una fila base: a mano, del detalle, vacía o no calculable. */
function celdaDeFilaBase(factor: Factor, mano: string | undefined, e: EntornoDeCelda): CeldaCalculada {
  const papelPendiente = factor === 'material' && e.motivoDelPapel !== null
  const delDetalle = e.hayFilas && e.detalle.ok && !papelPendiente ? e.detalle.porFactor[factor] : null
  if (mano !== undefined) return { valor: aTexto(mano, DECIMALES_IMPORTE), origen: 'mano', delDetalle, motivo: null }
  if (!e.hayFilas) return { valor: ceroImporte, origen: 'vacia', delDetalle: null, motivo: null }
  if (delDetalle !== null) return { valor: delDetalle, origen: 'detalle', delDetalle, motivo: null }
  const motivo = papelPendiente ? e.motivoDelPapel : e.detalle.ok ? 'No se pudo calcular.' : e.detalle.motivo
  return { valor: null, origen: 'no_calculable', delDetalle: null, motivo }
}

/** Una celda de un ítem adicional: a mano o cero. */
function celdaDeItem(mano: string | undefined): CeldaCalculada {
  return mano === undefined
    ? { valor: ceroImporte, origen: 'vacia', delDetalle: null, motivo: null }
    : { valor: aTexto(mano, DECIMALES_IMPORTE), origen: 'mano', delDetalle: null, motivo: null }
}

type Detalles = Record<Columna, Detalle>

/** La columna escrita a mano más cercana a `destino` (por posición entre las tres; a igual distancia, la menor). */
function referenciaMasCercana(destino: Columna, escritas: Columna[]): Columna {
  const distancia = (c: Columna) => {
    const d = COLUMNAS.indexOf(c) - COLUMNAS.indexOf(destino)
    return d < 0 ? -d : d
  }
  return escritas.reduce((mejor, c) => (distancia(c) < distancia(mejor) ? c : mejor))
}

/** Cuánto «pesa» una cantidad al cobrar un factor: la razón entre dos pesos es la razón entre sus importes. */
function pesoDeCobro(factor: Factor, columna: Columna) {
  if (factor === 'impresion') return techo(dividir(columna, UNIDADES_POR_MILLAR))
  if (factor === 'material') return multiplicar(columna, restar(CIEN, DESCUENTO_DE_MATERIAL_POR_VOLUMEN[columna]))
  return multiplicar(columna, '1')
}

/**
 * Completa las celdas vacías (o no calculables) de una fila con lo deducido de lo que se escribió a mano en ella: igual si la
 * fila es fija, según la regla de cobro de su factor si no. Lo escrito, el detalle y lo no calculable no se tocan.
 */
function deducirFila(fila: FilaCalculada): FilaCalculada {
  const escritas = COLUMNAS.filter((c) => fila.celdas[c].origen === 'mano')
  if (escritas.length === 0) return fila
  const celdas = { ...fila.celdas }
  for (const c of COLUMNAS) {
    // Vacía, o con un detalle que no se puede calcular (papel sin imposición válida): si en la fila hay algo
    // escrito a mano, eso sirve de referencia. Una celda con detalle calculado no se toca.
    if (fila.celdas[c].origen !== 'vacia' && fila.celdas[c].origen !== 'no_calculable') continue
    const desde = referenciaMasCercana(c, escritas)
    const base = fila.celdas[desde].valor ?? ceroImporte
    const valor = fila.fija ? base : aTexto(redondear(dividir(multiplicar(base, pesoDeCobro(fila.factor, c)), pesoDeCobro(fila.factor, desde)), DECIMALES_IMPORTE), DECIMALES_IMPORTE)
    celdas[c] = { valor, origen: 'deducida', delDetalle: null, motivo: null, desde }
  }
  return { ...fila, celdas }
}

/** Las filas del cuadro en su orden: cada fila base y, tras ella, los ítems que se pintan después de ella. */
function filasCalculadas(directo: Directo, cuadro: Cuadro, detalles: Detalles, papel: string | null): FilaCalculada[] {
  const filas: FilaCalculada[] = []
  const celdas = (hacer: (c: Columna) => CeldaCalculada) =>
    Object.fromEntries(COLUMNAS.map((c) => [c, hacer(c)])) as Record<Columna, CeldaCalculada>
  for (const factor of FACTORES) {
    const propia = directo.factores[factor]
    const hayFilas = cuadro.lineas.some((l) => l.factor === factor)
    filas.push({
      clave: factor, nombre: ETIQUETA_DE_FACTOR[factor], esItem: false, factor, fija: propia?.fija ?? false,
      celdas: celdas((c) => celdaDeFilaBase(factor, propia?.celdas[c], { detalle: detalles[c], hayFilas, motivoDelPapel: papel })),
    })
    for (const item of directo.items.filter((i) => i.despuesDe === factor)) {
      filas.push({
        clave: item.id, nombre: item.nombre, esItem: true, factor: item.factor, fija: item.fija,
        celdas: celdas((c) => celdaDeItem(item.celdas[c])),
      })
    }
  }
  return filas.map(deducirFila)
}

/** El equivalente de un porcentaje en la otra base: sobre la venta m → sobre el costo, y al revés (con 30 % sobre la venta, 42.86 % sobre el costo). */
function equivalentePct(utilidad: Utilidad): string {
  const m = utilidad.pct
  const otro = utilidad.base === 'venta'
    ? dividir(multiplicar(m, CIEN), restar(CIEN, m))
    : dividir(multiplicar(m, CIEN), sumar(CIEN, m))
  return aTexto(redondear(otro, DECIMALES_PORCENTAJE), DECIMALES_PORCENTAJE)
}

function utilidadDeColumna(columna: Columna, directo: Directo, cuadro: Cuadro): ColumnaCalculada['utilidad'] {
  const propia = directo.utilidadPct[columna]
  const utilidad: Utilidad = { pct: propia ?? cuadro.utilidad.pct, base: cuadro.utilidad.base }
  const imposible = utilidad.base === 'venta' && !esMayor(CIEN, utilidad.pct)
  return { pct: utilidad.pct, deColumna: propia !== undefined, base: utilidad.base as BaseDeUtilidad, equivalentePct: imposible ? '0.00' : equivalentePct(utilidad) }
}

type ParcialDeColumna = Pick<ColumnaCalculada, 'completa' | 'motivo'> & { codigo: string | null }

/** La primera celda que no se pudo calcular de una columna, o nada si está completa. */
function primeraFalla(filas: FilaCalculada[], columna: Columna, detalle: Detalle): ParcialDeColumna {
  const mala = filas.map((f) => f.celdas[columna]).find((c) => c.origen === 'no_calculable')
  if (!mala) return { completa: true, motivo: null, codigo: null }
  return { completa: false, motivo: mala.motivo, codigo: detalle.ok ? 'papel_pendiente' : detalle.codigo }
}

function costoPorFactor(filas: FilaCalculada[], columna: Columna): Record<Factor, string> {
  const porFactor = Object.fromEntries(FACTORES.map((f) => [f, CERO])) as Record<Factor, ReturnType<typeof sumar>>
  for (const fila of filas) porFactor[fila.factor] = sumar(porFactor[fila.factor], fila.celdas[columna].valor ?? CERO)
  return Object.fromEntries(FACTORES.map((f) => [f, aTexto(porFactor[f], DECIMALES_IMPORTE)])) as Record<Factor, string>
}

function calcularColumna(
  columna: Columna, base: Columna | null, filas: FilaCalculada[], detalle: Detalle, directo: Directo, cuadro: Cuadro, config: ConfiguracionEmpresa,
): Resultado<ColumnaCalculada & { codigo: string | null }, 'utilidad_imposible'> {
  const falla = primeraFalla(filas, columna, detalle)
  const utilidad = utilidadDeColumna(columna, directo, cuadro)
  const comun = { cantidad: columna, esBase: columna === base, seEnvia: directo.enviar.includes(columna), utilidad, ...falla }
  if (!falla.completa) return correcto({ ...comun, calculo: null, impuesto: null, totalConImpuesto: null })

  const porFactor = costoPorFactor(filas, columna)
  const costoTotal = sumar(...FACTORES.map((f) => porFactor[f]))
  const precioFinal = columna === base && cuadro.precioFinal !== null ? cuadro.precioFinal : undefined
  const costeo = costear(costoTotal, columna, { pct: utilidad.pct, base: utilidad.base }, precioFinal, config)
  if (!costeo.ok) return costeo
  const calculo: Calculo = {
    lineas: detalle.ok ? detalle.lineas : [], porFactor, costoTotal: aTexto(costoTotal, DECIMALES_IMPORTE), ...costeo.valor,
  }
  const { impuesto, totalConImpuesto } = conImpuesto(calculo.precio, config)
  return correcto({ ...comun, calculo, impuesto, totalConImpuesto })
}

/** Los tres totales sugeridos frente a las invariantes A y B; nada que evaluar si falta una columna o un precio. */
function coherenciaDe(columnas: Record<Columna, ColumnaCalculada>): CuadroDirectoCalculado['coherencia'] {
  const sugeridos = COLUMNAS.map((c) => columnas[c].calculo?.precioSugerido ?? null)
  if (sugeridos.some((p) => p === null || !esMayor(p, CERO))) return null
  const [p100, p1000, p5000] = sugeridos as [string, string, string]
  return validarReferencias({ p100, p1000, p5000 })
}

/**
 * Calcula las tres columnas del cuadro directo de una cotización por partes. Una columna con una celda que
 * no se puede calcular (por ejemplo, el papel sin imposición) queda incompleta con su motivo, sin afectar a
 * lo escrito a mano ni a las otras columnas. Falla solo si una utilidad por columna es imposible.
 */
export function calcularCuadroDirecto(
  cuadro: Cuadro,
  config: ConfiguracionEmpresa,
): Resultado<CuadroDirectoCalculado & { codigos: Record<Columna, string | null> }, 'utilidad_imposible'> {
  const sinc = sincronizarFilas(cuadro)
  const alDia = sinc.cuadro
  const base = columnaDe(alDia.trabajo.cantidad)
  const directo = alDia.directo ?? directoVacio(base)
  const papel = motivoDelPapel(sinc)
  const detalles = Object.fromEntries(COLUMNAS.map((c) => [c, detalleA(c, base, sinc, alDia, config)])) as Detalles
  const filas = filasCalculadas(directo, alDia, detalles, papel)

  const columnas = {} as Record<Columna, ColumnaCalculada>
  const codigos = {} as Record<Columna, string | null>
  for (const c of COLUMNAS) {
    const r = calcularColumna(c, base, filas, detalles[c], directo, alDia, config)
    if (!r.ok) return fallo(r.error.codigo, r.error.mensaje)
    const { codigo, ...columna } = r.valor
    columnas[c] = columna
    codigos[c] = codigo
  }
  return correcto({ base, filas, columnas, coherencia: coherenciaDe(columnas), codigos })
}

/** Lo que el motor saca de un cuadro para guardarlo como las tres referencias de Precios. */
export type ReferenciasDelCuadro = {
  p100: string
  p1000: string
  p5000: string
  calculos: { cantidad: string; calculo: Calculo }[]
}

/**
 * Los tres precios sugeridos del cuadro (a 100, 1.000 y 5.000 unidades): las referencias de la lista de
 * precios. Salen del mismo motor que pinta el cuadro, así que incluyen lo escrito a mano y los ítems. Si
 * una columna está incompleta, falla con el código y el motivo de la primera que no se pudo calcular.
 */
export function referenciasDelCuadro(cuadro: Cuadro, config: ConfiguracionEmpresa): Resultado<ReferenciasDelCuadro, string> {
  if (!esMayor(cuadro.trabajo.cantidad, CERO)) return fallo('cantidad_invalida', 'La cantidad debe ser mayor que cero.')
  const r = calcularCuadroDirecto(cuadro, config)
  if (!r.ok) return fallo(r.error.codigo, r.error.mensaje)
  const { columnas, codigos } = r.valor
  const incompleta = COLUMNAS.find((c) => !columnas[c].completa)
  if (incompleta) return fallo(codigos[incompleta] ?? 'cuadro_incompleto', columnas[incompleta].motivo ?? 'El cuadro no se puede calcular.')
  const calculos = COLUMNAS.map((c) => ({ cantidad: c as string, calculo: columnas[c].calculo as Calculo }))
  const [en100, en1000, en5000] = calculos
  return correcto({ p100: en100.calculo.precioSugerido, p1000: en1000.calculo.precioSugerido, p5000: en5000.calculo.precioSugerido, calculos })
}
