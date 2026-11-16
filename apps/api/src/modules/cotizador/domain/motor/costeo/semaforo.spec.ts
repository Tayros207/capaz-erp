import { describe, expect, it } from 'vitest'
import { umbralesPorDefecto } from './pruebas/caso-de-referencia.js'
import { clasificarMargen } from './semaforo.js'

describe('clasificarMargen (verde ≥ 30, ámbar 15–29.99, rojo < 15)', () => {
  it('verde desde el umbral verde inclusive', () => {
    expect(clasificarMargen('30.00', umbralesPorDefecto)).toBe('verde')
    expect(clasificarMargen('35.00', umbralesPorDefecto)).toBe('verde')
    expect(clasificarMargen('100', umbralesPorDefecto)).toBe('verde')
  })

  it('ámbar entre el mínimo (inclusive) y el verde', () => {
    expect(clasificarMargen('29.99', umbralesPorDefecto)).toBe('ambar')
    expect(clasificarMargen('25.93', umbralesPorDefecto)).toBe('ambar')
    expect(clasificarMargen('15.00', umbralesPorDefecto)).toBe('ambar')
  })

  it('rojo bajo el mínimo, incluido un margen negativo', () => {
    expect(clasificarMargen('14.99', umbralesPorDefecto)).toBe('rojo')
    expect(clasificarMargen('0', umbralesPorDefecto)).toBe('rojo')
    expect(clasificarMargen('-10.00', umbralesPorDefecto)).toBe('rojo')
  })

  it('evalúa el margen tal como se muestra: 29.998 se ve como 30.00 y va en verde (PLA-01)', () => {
    expect(clasificarMargen('29.998', umbralesPorDefecto)).toBe('verde')
    expect(clasificarMargen('29.995', umbralesPorDefecto)).toBe('verde')
    expect(clasificarMargen('29.994', umbralesPorDefecto)).toBe('ambar')
    expect(clasificarMargen('14.995', umbralesPorDefecto)).toBe('ambar')
    expect(clasificarMargen('14.994', umbralesPorDefecto)).toBe('rojo')
  })

  it('usa los umbrales de la empresa, no constantes', () => {
    const otraEmpresa = { umbralVerdePct: '20', umbralMinimoPct: '10' }
    expect(clasificarMargen('25.93', otraEmpresa)).toBe('verde')
    expect(clasificarMargen('12', otraEmpresa)).toBe('ambar')
    expect(clasificarMargen('9.99', otraEmpresa)).toBe('rojo')
  })
})
