import { describe, expect, it } from 'vitest'
import {
  cantidadSchema,
  costoUnitarioSchema,
  decimalTexto,
  hojasSchema,
  importeSchema,
  medidaPositivaSchema,
  medidaSchema,
  porcentajeSchema,
} from './esquemas-decimales.js'

const acepta = (esquema: ReturnType<typeof decimalTexto>, valor: unknown) =>
  esquema.safeParse(valor).success

describe('esquemas decimales', () => {
  it('aceptan texto decimal con punto', () => {
    expect(acepta(cantidadSchema, '2500')).toBe(true)
    expect(acepta(cantidadSchema, '0.8')).toBe(true)
    expect(acepta(costoUnitarioSchema, '0.4500')).toBe(true)
    expect(acepta(costoUnitarioSchema, '1.005')).toBe(true)
    expect(acepta(importeSchema, '346.38')).toBe(true)
    expect(acepta(porcentajeSchema, '35')).toBe(true)
    expect(acepta(porcentajeSchema, '250.125')).toBe(true)
  })

  it('rechazan un number: los importes viajan como texto', () => {
    expect(acepta(importeSchema, 346.38)).toBe(false)
    expect(acepta(cantidadSchema, 2500)).toBe(false)
  })

  it('rechazan coma, signo, exponente y formas incompletas', () => {
    for (const t of ['', '1,5', '-1', '+1', '1e3', '.5', '5.', '1.2.3', ' 5', 'abc']) {
      expect(acepta(importeSchema, t)).toBe(false)
    }
  })

  it('respetan las cifras de la columna', () => {
    expect(acepta(importeSchema, '123456789012.99')).toBe(true) // 12 enteros
    expect(acepta(importeSchema, '1234567890123.99')).toBe(false) // 13 enteros
    expect(acepta(importeSchema, '1.005')).toBe(false) // 3 decimales
    expect(acepta(costoUnitarioSchema, '0.00001')).toBe(false) // 5 decimales
    expect(acepta(cantidadSchema, '1.0005')).toBe(false) // 4 decimales
    expect(acepta(porcentajeSchema, '12345')).toBe(false) // 5 enteros
  })

  it('el mensaje de error está en español y dice qué falta', () => {
    const r = importeSchema.safeParse('1,5')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain('hasta 12 cifras enteras y 2 decimales')
  })
})

describe('medidas en cm', () => {
  it('medidaSchema acepta cero (sangrado o calle nulos) y respeta NUMERIC(7,2)', () => {
    expect(medidaSchema.safeParse('0').success).toBe(true)
    expect(medidaSchema.safeParse('14.8').success).toBe(true)
    expect(medidaSchema.safeParse('99999.99').success).toBe(true)
    expect(medidaSchema.safeParse('100000').success).toBe(false) // 6 enteros
    expect(medidaSchema.safeParse('0.125').success).toBe(false) // 3 decimales
  })

  it('medidaPositivaSchema rechaza cero en cualquiera de sus formas', () => {
    expect(medidaPositivaSchema.safeParse('0.01').success).toBe(true)
    for (const cero of ['0', '0.0', '0.00']) {
      const r = medidaPositivaSchema.safeParse(cero)
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].message).toBe('Debe ser mayor que cero.')
    }
  })

  it('medidaPositivaSchema con texto no numérico da error de validación, no una excepción', () => {
    for (const texto of ['abc', '', '1,5', '-3']) {
      expect(() => medidaPositivaSchema.safeParse(texto)).not.toThrow()
      expect(medidaPositivaSchema.safeParse(texto).success).toBe(false)
    }
  })
})

describe('hojasSchema', () => {
  it('acepta enteros de hasta 6 cifras', () => {
    for (const ok of ['0', '40', '999999']) expect(hojasSchema.safeParse(ok).success).toBe(true)
  })

  it('rechaza decimales, signo, coma, exponente, vacío y number', () => {
    for (const mal of ['4.5', '-1', '1,5', '1e2', '', '1000000', 40]) {
      expect(hojasSchema.safeParse(mal).success).toBe(false)
    }
  })
})
