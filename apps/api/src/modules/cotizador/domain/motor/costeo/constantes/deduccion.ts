import type { Columna } from '../tipos/cuadro-directo.js'

// Cómo se deducen las celdas vacías del cuadro de costos a partir de lo escrito a mano en otra cantidad
// (ver `deducirFila` en `services/cuadro-directo.ts`). Son reglas de la industria gráfica, no cálculos de
// un taller en particular; lo deducido siempre se puede escribir encima.

/** La impresión se cobra por millares completos: 100 unidades cuestan lo mismo que 1.000. */
export const UNIDADES_POR_MILLAR = '1000'

/** Descuento del material por volumen, en %: el papel baja de precio con la cantidad. 100 y 1.000 son lineales. */
export const DESCUENTO_DE_MATERIAL_POR_VOLUMEN: Record<Columna, string> = { '100': '0', '1000': '0', '5000': '2' }
