import { describe, expect, it } from 'vitest'
import { CANTIDADES_DE_REFERENCIA, CLASES_DE_PROCESO, COLOR_DE_CANTIDAD, colorDeCantidad } from './cantidades-de-referencia.js'

describe('colorDeCantidad', () => {
  it('100 es cian, 1.000 es magenta y 5.000 es amarillo', () => {
    expect(colorDeCantidad('100')).toBe('cian')
    expect(colorDeCantidad('1000')).toBe('magenta')
    expect(colorDeCantidad('5000')).toBe('amarillo')
  })

  it('una cantidad ajena no tiene color', () => {
    expect(colorDeCantidad('250')).toBeNull()
    expect(colorDeCantidad('')).toBeNull()
  })

  it('recibe el valor crudo, no el formateado', () => {
    expect(colorDeCantidad('1,000')).toBeNull()
    expect(colorDeCantidad('1.000')).toBeNull()
  })

  it('no se confunde con propiedades heredadas del objeto', () => {
    expect(colorDeCantidad('toString')).toBeNull()
    expect(colorDeCantidad('constructor')).toBeNull()
  })

  it('cada cantidad de referencia tiene color, y cada color su juego de clases', () => {
    for (const c of CANTIDADES_DE_REFERENCIA) {
      const clases = CLASES_DE_PROCESO[COLOR_DE_CANTIDAD[c]]
      expect(clases.punto).toMatch(/^bg-/)
      expect(clases.tinte).toMatch(/^bg-.*-tinte$/)
      expect(clases.sombra).toMatch(/^shadow-registro-/)
    }
  })
})
