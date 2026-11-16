import type { Escala, Factor } from '../../base/dominio.js'

export const PLANTILLAS = ['volantes', 'en_blanco'] as const
export type Plantilla = (typeof PLANTILLAS)[number]

/**
 * Una fila sugerida de una plantilla. Nacen con el costo vacío ('0'): lo pone la persona o el
 * catálogo. `automatica` marca las filas que el motor mantiene (el papel sigue a la imposición y
 * las planchas a tintas × caras) hasta que alguien las corrige a mano.
 */
export type FilaDePlantilla = {
  automatica: 'papel' | 'planchas' | null
  factor: Factor
  descripcion: string
  unidad: string
  cantidad: string
  escala: Escala
}

export const FILAS_DE_PLANTILLA: Record<Plantilla, readonly FilaDePlantilla[]> = {
  en_blanco: [],
  // En el orden de los factores (`FACTORES`): el cuadro va agrupado por factor y la fila 3 es la tercera.
  volantes: [
    { automatica: 'papel', factor: 'material', descripcion: 'Papel', unidad: 'pliego', cantidad: '0', escala: 'por_pliego' },
    { automatica: 'planchas', factor: 'planchas', descripcion: 'Planchas', unidad: 'plancha', cantidad: '0', escala: 'fija' },
    { automatica: null, factor: 'impresion', descripcion: 'Tiraje offset', unidad: 'hora', cantidad: '0', escala: 'por_pliego' },
    { automatica: null, factor: 'diseno', descripcion: 'Diseño gráfico', unidad: 'servicio', cantidad: '1', escala: 'fija' },
    { automatica: null, factor: 'acabado', descripcion: 'Corte y empaque', unidad: 'servicio', cantidad: '1', escala: 'por_pliego' },
  ],
}
