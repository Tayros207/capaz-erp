import { correcto, fallo, type Resultado } from '../base/resultado.js'
import {
  aTexto,
  CERO,
  DECIMALES_CANTIDAD,
  dividir,
  esMayor,
  multiplicar,
  redondear,
  type Valor,
} from '../base/dinero.js'
import type { Linea } from './tipos/cotizacion.js'
import type { ImposicionCalculada } from './tipos/imposicion.js'
import type { CodigoDeEscalado, CuadroEscalable, CuadroEscalado } from './tipos/escalado.js'
import { calcularImposicion } from './imposicion.js'

type Razon = { nuevo: Valor; viejo: Valor }

type Razones = {
  porUnidad: Razon
  /** `null` sin papel e imposición: no se conocen los pliegos. */
  porPliego: Razon | null
  /** La fila de papel que llena el motor y su cantidad nueva (pliegos madre). */
  papel: { id: string; cantidad: string } | null
  imposicion: ImposicionCalculada | null
}

// Cantidad × nuevo / viejo, con una sola división, redondeada a 3 decimales (NUMERIC(12,3)) para
// que la fila escalada siga siendo una fila válida: lo impreso (cantidad × costo) cuadra con su
// subtotal. Con cantidades fraccionarias el redondeo mueve el costo de la fila en, como mucho,
// media milésima de cantidad por su costo unitario.
function proporcional(cantidad: string, { nuevo, viejo }: Razon): string {
  return aTexto(redondear(dividir(multiplicar(cantidad, nuevo), viejo), DECIMALES_CANTIDAD))
}

/** La cantidad de la fila a la nueva escala; `null` si escala por pliego y no hay pliegos. */
function cantidadEscalada(linea: Linea, razones: Razones): string | null {
  if (razones.papel?.id === linea.id) return razones.papel.cantidad
  if (linea.escala === 'fija') return linea.cantidad
  if (linea.escala === 'por_unidad') return proporcional(linea.cantidad, razones.porUnidad)
  return razones.porPliego && proporcional(linea.cantidad, razones.porPliego)
}

function calcularRazones(
  cuadro: CuadroEscalable,
  cantidadNueva: string,
): Resultado<Razones, CodigoDeEscalado> {
  const porUnidad = { nuevo: cantidadNueva, viejo: cuadro.cantidad }
  if (!cuadro.papel) return correcto({ porUnidad, porPliego: null, papel: null, imposicion: null })

  const { pieza, imposicion, lineaDePapelId } = cuadro.papel
  const antes = calcularImposicion({ pieza, cantidad: cuadro.cantidad, imposicion })
  if (!antes.ok) return antes
  const despues = calcularImposicion({ pieza, cantidad: cantidadNueva, imposicion })
  if (!despues.ok) return despues
  if (lineaDePapelId !== null && !cuadro.lineas.some((l) => l.id === lineaDePapelId)) {
    return fallo('papel_no_encontrado', 'La fila de papel del cuadro ya no existe.')
  }
  return correcto({
    porUnidad,
    // Las filas por pliego siguen a los pliegos de máquina brutos: los que pasan por la prensa,
    // arranque incluido. El papel, en cambio, se compra en pliegos madre y sale de la imposición.
    porPliego: { nuevo: despues.valor.pliegosDeMaquina, viejo: antes.valor.pliegosDeMaquina },
    papel: lineaDePapelId === null ? null : { id: lineaDePapelId, cantidad: despues.valor.pliegosMadre },
    imposicion: despues.valor,
  })
}

/**
 * Corre el cuadro a otra cantidad según la `escala` de cada fila (ADR-12): las `fija` no cambian
 * (planchas, diseño, alistamiento); las `por_unidad` siguen a la cantidad del trabajo; las
 * `por_pliego` siguen a los pliegos de máquina, que se recalculan con la imposición; y la fila de
 * papel se recalcula con los pliegos madre. No modifica el cuadro recibido. Función pura.
 */
export function escalarCuadro(
  cuadro: CuadroEscalable,
  cantidadNueva: string,
): Resultado<CuadroEscalado, CodigoDeEscalado> {
  if (!esMayor(cuadro.cantidad, CERO) || !esMayor(cantidadNueva, CERO)) {
    return fallo('cantidad_invalida', 'La cantidad debe ser mayor que cero.')
  }
  const razones = calcularRazones(cuadro, cantidadNueva)
  if (!razones.ok) return razones

  const lineas: Linea[] = []
  for (const linea of cuadro.lineas) {
    const cantidad = cantidadEscalada(linea, razones.valor)
    if (cantidad === null) {
      return fallo(
        'imposicion_requerida',
        `La fila «${linea.descripcion}» escala por pliego y el cuadro no tiene papel e imposición.`,
      )
    }
    lineas.push({ ...linea, cantidad })
  }
  return correcto({ cantidad: cantidadNueva, lineas, imposicion: razones.valor.imposicion })
}
