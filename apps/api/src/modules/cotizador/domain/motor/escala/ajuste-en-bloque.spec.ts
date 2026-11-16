import { describe, expect, it } from 'vitest'
import { ajustarPrecios } from './ajuste-en-bloque.js'

describe('ajustarPrecios', () => {
  const base = { p100: '190.00', p1000: '580.00', p5000: '1200.00', precioMinimo: null }

  it('sube un porcentaje cada referencia, al centavo', () => {
    expect(ajustarPrecios(base, '8')).toEqual({ p100: '205.20', p1000: '626.40', p5000: '1296.00', precioMinimo: null })
    expect(ajustarPrecios({ ...base, p100: '99.99' }, '3.5')).toMatchObject({ p100: '103.49' }) // 103.4897 → 103.49
  })

  it('con signo negativo baja, y el mínimo se ajusta igual', () => {
    expect(ajustarPrecios({ ...base, precioMinimo: '250.00' }, '-10')).toEqual({ p100: '171.00', p1000: '522.00', p5000: '1080.00', precioMinimo: '225.00' })
  })

  it('el medio centavo sube (half-up)', () => {
    expect(ajustarPrecios({ ...base, p100: '10.05' }, '5').p100).toBe('10.55') // 10.5525
    expect(ajustarPrecios({ ...base, p100: '0.10' }, '5').p100).toBe('0.11') // 0.105 → 0.11
  })
})
