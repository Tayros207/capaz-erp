import { describe, expect, it } from 'vitest'
import { referenciasSchema, variantePrecioSchema } from './precio-por-escala.js'

const valida = { p100: '190', p1000: '580', p5000: '1200', modoIntermedio: 'curva' }

describe('variantePrecioSchema', () => {
  it('acepta las tres referencias con o sin precio mínimo, en cualquier modo', () => {
    expect(variantePrecioSchema.safeParse(valida).success).toBe(true)
    expect(variantePrecioSchema.safeParse({ ...valida, modoIntermedio: 'escalon' }).success).toBe(true)
    expect(variantePrecioSchema.safeParse({ ...valida, precioMinimo: '250.50' }).success).toBe(true)
  })

  it('rechaza importes como number, con coma o con más de 2 decimales', () => {
    for (const p100 of [190, '190,5', '190.005', '', '-5']) {
      expect(variantePrecioSchema.safeParse({ ...valida, p100 }).success, String(p100)).toBe(false)
    }
    expect(variantePrecioSchema.safeParse({ ...valida, precioMinimo: 250 }).success).toBe(false)
  })

  it('rechaza un modo que no existe y una referencia que falta', () => {
    expect(variantePrecioSchema.safeParse({ ...valida, modoIntermedio: 'lineal' }).success).toBe(false)
    const sinP5000 = { p100: valida.p100, p1000: valida.p1000, modoIntermedio: valida.modoIntermedio }
    expect(variantePrecioSchema.safeParse(sinP5000).success).toBe(false)
  })

  it('rechaza campos que no existen, como una empresa colada por los argumentos', () => {
    expect(variantePrecioSchema.safeParse({ ...valida, empresaId: 'otra' }).success).toBe(false)
  })
})

describe('referenciasSchema', () => {
  it('respeta NUMERIC(14,2): 12 cifras enteras', () => {
    const referencias = { p100: '1', p1000: '2', p5000: '123456789012.99' }
    expect(referenciasSchema.safeParse(referencias).success).toBe(true)
    expect(referenciasSchema.safeParse({ ...referencias, p5000: '1234567890123' }).success).toBe(false)
  })
})
