import { describe, expect, it } from 'vitest'
import {
  cantidadAMilesimas,
  centimosAImporte,
  importeACentimos,
  milesimasACantidad,
  porcentajeDeBase,
  unitarioAMilesimas,
} from './adaptador-de-dinero.js'
import { aTexto } from './motor/base/dinero.js'

describe('importeACentimos', () => {
  it.each([
    ['346.38', 34638],
    ['225.15', 22515],
    ['1200.00', 120000],
    ['190', 19000],
    ['-12.5', -1250],
    ['0.07', 7],
  ])('%s → %i', (importe, esperado) => {
    expect(importeACentimos(importe)).toBe(esperado)
  })

  it.each(['346.385', '1e3', '', 'abc'])('«%s» lanza RangeError', (importe) => {
    expect(() => importeACentimos(importe)).toThrow(RangeError)
  })

  it('el cero negativo no sale como -0', () => {
    expect(Object.is(importeACentimos('-0.00'), 0)).toBe(true)
  })
})

describe('centimosAImporte', () => {
  it('siempre dos decimales', () => {
    expect(centimosAImporte(34638)).toBe('346.38')
    expect(centimosAImporte(7)).toBe('0.07')
    expect(centimosAImporte(19000)).toBe('190.00')
    expect(centimosAImporte(-1250)).toBe('-12.50')
  })

  it.each([0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])('%s lanza RangeError', (centimos) => {
    expect(() => centimosAImporte(centimos)).toThrow(RangeError)
  })

  it('ida y vuelta con los nueve totales de la curva (C7)', () => {
    for (const x of ['190.00', '265.86', '414.50', '520.54', '580.00', '696.59', '877.39', '952.72', '1200.00']) {
      expect(centimosAImporte(importeACentimos(x))).toBe(aTexto(x, 2))
    }
  })
})

describe('cantidades y milésimas', () => {
  it('cantidadAMilesimas', () => {
    expect(cantidadAMilesimas('2500')).toBe(2500000)
    expect(cantidadAMilesimas('0.8')).toBe(800)
    expect(cantidadAMilesimas('0.348')).toBe(348)
    expect(() => cantidadAMilesimas('0.3485')).toThrow(RangeError)
  })

  it('milesimasACantidad no rellena con ceros', () => {
    expect(milesimasACantidad(2500000)).toBe('2500')
    expect(milesimasACantidad(800)).toBe('0.8')
    expect(milesimasACantidad(348)).toBe('0.348')
    expect(() => milesimasACantidad(0.5)).toThrow(RangeError)
  })
})

describe('unitarioAMilesimas', () => {
  it('redondea la mitad hacia arriba', () => {
    expect(unitarioAMilesimas('0.1386')).toBe(139)
    expect(unitarioAMilesimas('0.5800')).toBe(580)
    expect(unitarioAMilesimas('0.3510')).toBe(351)
    expect(unitarioAMilesimas('0.0005')).toBe(1)
  })

  it('con más de 4 decimales lanza', () => {
    expect(() => unitarioAMilesimas('0.12345')).toThrow(RangeError)
  })
})

describe('porcentajeDeBase', () => {
  it('quita los ceros de relleno', () => {
    expect(porcentajeDeBase('35.000')).toBe('35')
    expect(porcentajeDeBase('12.500')).toBe('12.5')
    expect(() => porcentajeDeBase('abc')).toThrow(RangeError)
  })
})
