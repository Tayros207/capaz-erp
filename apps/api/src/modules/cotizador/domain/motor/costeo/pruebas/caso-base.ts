import { calcularCotizacion } from '../calcular-cotizacion.js'
import type { Calculo, Linea, Utilidad } from '../tipos/cotizacion.js'
import { COLUMNA_BASE_POR_DEFECTO } from '../tipos/cuadro-directo.js'
import { lineasDelCasoDeReferencia, umbralesPorDefecto } from './caso-de-referencia.js'
import { vectoresDeEscalado } from './vectores-de-escalado.js'

// El caso de referencia a la cantidad base del cuadro (PRP-007: por partes se cotiza a 100, 1.000 o
// 5.000). Es puro (sin herramientas ni repositorio): lo usan las pruebas unitarias, las de base de datos
// y las de pantalla. Las cantidades de las filas y los números esperados salen del vector de esa
// cantidad, que generó el oráculo independiente del PRP-001, y del motor: nunca se escriben a mano.

/** El vector del caso de referencia a la cantidad base del cuadro: lo que debe dar el flujo por herramientas. */
export const VECTOR_BASE = (() => {
  const v = vectoresDeEscalado.find((x) => x.cantidad === COLUMNA_BASE_POR_DEFECTO)
  if (!v) throw new Error(`Falta el vector de ${COLUMNA_BASE_POR_DEFECTO}`)
  return v
})()

/** El vector de otra de las tres cantidades (por ejemplo 5.000, para probar un cambio de base). */
export function vectorDe(cantidad: string) {
  const v = vectoresDeEscalado.find((x) => x.cantidad === cantidad)
  if (!v) throw new Error(`Falta el vector de ${cantidad}`)
  return v
}

/**
 * Lo que dice el motor del caso de referencia a la cantidad base, con la utilidad (y el precio final) que
 * se pida: es de donde salen todos los números esperados de las pruebas por herramientas. Antes de usarlo
 * se comprueba contra el vector del oráculo (`costoTotal` y `precioSobreVenta35` de `VECTOR_BASE`).
 */
export function esperadoDelCasoBase(
  utilidad: Utilidad = { pct: '35', base: 'venta' },
  precioFinal?: string,
  /** Cambia las filas antes de calcular (otro costo, una fila menos…): la variante también sale del motor. */
  ajustar: (lineas: Linea[]) => Linea[] = (lineas) => lineas,
): Calculo {
  const lineas = ajustar(lineasDelCasoDeReferencia.map((l) => ({ ...l, cantidad: VECTOR_BASE.cantidades[l.id] })))
  const calculo = calcularCotizacion(
    { lineas, cantidad: VECTOR_BASE.cantidad, utilidad, ...(precioFinal === undefined ? {} : { precioFinal }) },
    umbralesPorDefecto,
  )
  if (!calculo.ok) throw new Error('El caso de referencia no calcula')
  return calculo.valor
}
