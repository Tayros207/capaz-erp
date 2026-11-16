/**
 * Las tres cantidades del modelo de precios por escala: un ciento, un millar y cinco millares.
 * Los precios de referencia son totales del lote a estas cantidades, y el rango que se cotiza
 * por escala va de la primera a la última. Es una regla del producto, no de una empresa; la
 * usan `cotizacion` (para correr el cuadro) y `precio-por-escala` (para interpolar).
 */
export const CANTIDADES_DE_REFERENCIA = ['100', '1000', '5000'] as const

/** Una de las tres cantidades de referencia (`'100' | '1000' | '5000'`): las columnas del cuadro. */
export type ColumnaDeCuadro = (typeof CANTIDADES_DE_REFERENCIA)[number]

/** Los colores de proceso de impresión: la identidad visual de Cotizín (PRP-008 §2.2). */
export type ColorDeProceso = 'cian' | 'magenta' | 'amarillo'

/** Cada cantidad de referencia tiene siempre el mismo color, en toda la app: 100 cian, 1.000 (base) magenta, 5.000 amarillo. */
export const COLOR_DE_CANTIDAD: Record<ColumnaDeCuadro, ColorDeProceso> = {
  '100': 'cian',
  '1000': 'magenta',
  '5000': 'amarillo',
}

/** El color de una cantidad cualquiera (el valor crudo, `'1000'`, no el formateado); `null` si no es una de las tres de referencia. */
export function colorDeCantidad(cantidad: string): ColorDeProceso | null {
  return Object.hasOwn(COLOR_DE_CANTIDAD, cantidad) ? COLOR_DE_CANTIDAD[cantidad as ColumnaDeCuadro] : null
}

/**
 * Las clases de cada color de proceso, escritas completas (Tailwind no compila `bg-${color}`):
 * `punto` = el círculo, `tinte` = el fondo suave, `borde` = el borde, `sombra` = la sombra de registro.
 */
export const CLASES_DE_PROCESO: Record<ColorDeProceso, { punto: string; tinte: string; borde: string; sombra: string }> = {
  cian: { punto: 'bg-cian', tinte: 'bg-cian-tinte', borde: 'border-cian', sombra: 'shadow-registro-cian' },
  magenta: { punto: 'bg-magenta', tinte: 'bg-magenta-tinte', borde: 'border-magenta', sombra: 'shadow-registro-magenta' },
  amarillo: { punto: 'bg-amarillo', tinte: 'bg-amarillo-tinte', borde: 'border-amarillo', sombra: 'shadow-registro-amarillo' },
}
