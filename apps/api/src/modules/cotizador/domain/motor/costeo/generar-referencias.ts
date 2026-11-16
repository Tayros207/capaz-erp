import { CANTIDADES_DE_REFERENCIA } from '../base/cantidades-de-referencia.js'
import { correcto, type Resultado } from '../base/resultado.js'
import type { Calculo, ConfiguracionDeCosteo, Utilidad } from './tipos/cotizacion.js'
import type { CodigoDeEscalado, CuadroEscalable, ReferenciasGeneradas } from './tipos/escalado.js'
import { calcularCotizacion } from './calcular-cotizacion.js'
import { escalarCuadro } from './escalar-cuadro.js'

/**
 * Corre el cuadro a 100, 1.000 y 5.000 unidades y devuelve el precio sugerido del lote a cada
 * una: las tres referencias de la cotización rápida. Ignora cualquier precio final fijado a mano
 * (vale para una cantidad, no para las otras tres). No valida los invariantes A y B: eso lo hace
 * `validarReferencias` al guardarlas, con lo que aquí se genera.
 */
export function generarReferencias(
  cuadro: CuadroEscalable,
  utilidad: Utilidad,
  config: ConfiguracionDeCosteo,
): Resultado<ReferenciasGeneradas, CodigoDeEscalado | 'utilidad_imposible'> {
  const calculos: { cantidad: string; calculo: Calculo }[] = []
  for (const cantidad of CANTIDADES_DE_REFERENCIA) {
    const escalado = escalarCuadro(cuadro, cantidad)
    if (!escalado.ok) return escalado
    const calculo = calcularCotizacion({ lineas: escalado.valor.lineas, cantidad, utilidad }, config)
    if (!calculo.ok) return calculo
    calculos.push({ cantidad, calculo: calculo.valor })
  }
  const [en100, en1000, en5000] = calculos
  return correcto({
    p100: en100.calculo.precio,
    p1000: en1000.calculo.precio,
    p5000: en5000.calculo.precio,
    calculos,
  })
}
