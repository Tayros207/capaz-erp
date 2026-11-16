import type { Escala, Factor } from './dominio.js'

/** El nombre con el que cada factor se ve y se dice («el nombre visible de cada campo es el que se dice»). */
export const ETIQUETA_DE_FACTOR: Record<Factor, string> = {
  material: 'Material',
  planchas: 'Placa',
  impresion: 'Impresión',
  diseno: 'Diseño gráfico',
  acabado: 'Acabado',
  indirectos: 'Otros',
}

/** Cómo se llama cada escala de fila (ADR-12) en pantalla y en voz. */
export const ETIQUETA_DE_ESCALA: Record<Escala, string> = {
  fija: 'Fija',
  por_pliego: 'Por pliego',
  por_unidad: 'Por unidad',
}
