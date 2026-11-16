import { correcto, fallo, type Resultado } from '../base/resultado.js'
import {
  aTexto,
  CIEN,
  decimal,
  dividir,
  esMayorOIgual,
  multiplicar,
  restar,
  sumar,
  techo,
  type Decimal,
  type Valor,
} from '../base/dinero.js'
import type { EtapaCalculada, EtapaDeMerma, Mermas } from './tipos/imposicion.js'

/**
 * Hojas que deben entrar a una etapa para que salgan `salida` buenas:
 * `⌈salida / (1 − m)⌉ + arranque`. Hacia atrás (INF-02): con 20 %, para 100 buenas hacen
 * falta 125, no 120. El arranque es fijo, igual en 100 que en 10.000 (INF-01), y se suma
 * después de redondear: son hojas enteras.
 */
function calcularEtapa(salida: Decimal, etapa: EtapaDeMerma): EtapaCalculada {
  const trasPorcentaje = techo(dividir(multiplicar(salida, CIEN), restar(CIEN, etapa.mermaPct)))
  return {
    nombre: etapa.nombre,
    mermaPct: etapa.mermaPct,
    arranque: etapa.arranque,
    salida: aTexto(salida),
    trasPorcentaje: aTexto(trasPorcentaje),
    entrada: aTexto(sumar(trasPorcentaje, etapa.arranque)),
  }
}

/**
 * Etapas encadenadas de la última a la primera: lo que entra a una es lo que debe salir de
 * la anterior. `etapas` va en orden de proceso y el resultado conserva ese orden. Sin etapas,
 * el bruto es igual al neto.
 */
export function calcularMermas(
  netos: Valor,
  etapas: readonly EtapaDeMerma[],
): Resultado<Mermas, 'merma_imposible'> {
  const imposible = etapas.find((e) => esMayorOIgual(e.mermaPct, CIEN))
  if (imposible) {
    return fallo('merma_imposible', `La merma de «${imposible.nombre}» debe ser menor que 100 %.`)
  }

  const calculadas: EtapaCalculada[] = []
  let salida = decimal(netos)
  for (const etapa of [...etapas].reverse()) {
    const calculada = calcularEtapa(salida, etapa)
    calculadas.push(calculada)
    salida = decimal(calculada.entrada)
  }
  return correcto({ etapas: calculadas.reverse(), bruto: aTexto(salida) })
}
