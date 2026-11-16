import type { Escala, Factor } from '../../base/dominio.js'

// Las etiquetas viven en `shared/constants/factores` (las usa también la empresa); se re-exportan.
export { ETIQUETA_DE_FACTOR } from '../../base/factores.js'

/** Escala por defecto de una fila nueva (ADR-12); editable en cada fila. */
export const ESCALA_POR_DEFECTO: Record<Factor, Escala> = {
  material: 'por_pliego',
  planchas: 'fija',
  impresion: 'por_pliego',
  diseno: 'fija',
  acabado: 'por_pliego',
  indirectos: 'fija',
}

/** Unidad de una fila escrita a mano sin unidad (una fila del catálogo trae la suya). */
export const UNIDAD_POR_DEFECTO: Record<Factor, string> = {
  material: 'pliego',
  planchas: 'plancha',
  impresion: 'hora',
  diseno: 'servicio',
  acabado: 'servicio',
  indirectos: 'servicio',
}
