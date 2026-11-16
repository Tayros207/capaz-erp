import { describe, expect, it } from 'vitest'
import { entradaDelCasoDeReferencia, lineasDelCasoDeReferencia } from '../pruebas/caso-de-referencia.js'
import {
  configuracionDeCosteoSchema,
  entradaDeCosteoSchema,
  lineaSchema,
  utilidadSchema,
} from './cotizacion.js'

const lineaValida = lineasDelCasoDeReferencia[0]

describe('lineaSchema', () => {
  it('acepta las filas del caso de referencia', () => {
    for (const linea of lineasDelCasoDeReferencia) {
      expect(lineaSchema.safeParse(linea).success).toBe(true)
    }
  })

  it('rechaza factor o escala desconocidos', () => {
    expect(lineaSchema.safeParse({ ...lineaValida, factor: 'troquel' }).success).toBe(false)
    expect(lineaSchema.safeParse({ ...lineaValida, escala: 'proporcional' }).success).toBe(false)
  })

  it('rechaza descripción o unidad vacías, con mensaje en español', () => {
    const r = lineaSchema.safeParse({ ...lineaValida, descripcion: '   ' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Falta la descripción.')
    expect(lineaSchema.safeParse({ ...lineaValida, unidad: '' }).success).toBe(false)
  })

  it('rechaza campos que no existen, como una empresa colada por los argumentos', () => {
    expect(lineaSchema.safeParse({ ...lineaValida, empresaId: 'otra' }).success).toBe(false)
  })

  it('rechaza importes con coma o como number', () => {
    expect(lineaSchema.safeParse({ ...lineaValida, costoUnitario: '0,45' }).success).toBe(false)
    expect(lineaSchema.safeParse({ ...lineaValida, cantidad: 172 }).success).toBe(false)
  })
})

describe('utilidadSchema', () => {
  it('acepta 35 % sobre la venta y sobre el costo', () => {
    expect(utilidadSchema.safeParse({ pct: '35', base: 'venta' }).success).toBe(true)
    expect(utilidadSchema.safeParse({ pct: '35', base: 'costo' }).success).toBe(true)
  })

  it('rechaza 100 % o más sobre la venta, pero no sobre el costo', () => {
    const r = utilidadSchema.safeParse({ pct: '100', base: 'venta' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe(
      'Con utilidad sobre la venta, el porcentaje debe ser menor que 100.',
    )
    expect(utilidadSchema.safeParse({ pct: '250', base: 'costo' }).success).toBe(true)
  })

  it('un porcentaje que no es número falla con error de validación, sin lanzar', () => {
    expect(() => utilidadSchema.safeParse({ pct: 'abc', base: 'venta' })).not.toThrow()
    expect(utilidadSchema.safeParse({ pct: 'abc', base: 'venta' }).success).toBe(false)
    expect(utilidadSchema.safeParse({ pct: '35', base: 'margen' }).success).toBe(false)
  })
})

describe('configuracionDeCosteoSchema', () => {
  it('acepta verde mayor que mínimo y rechaza lo contrario o igual', () => {
    expect(configuracionDeCosteoSchema.safeParse({ umbralVerdePct: '30', umbralMinimoPct: '15' }).success).toBe(true)
    expect(configuracionDeCosteoSchema.safeParse({ umbralVerdePct: '15', umbralMinimoPct: '15' }).success).toBe(false)
    expect(configuracionDeCosteoSchema.safeParse({ umbralVerdePct: '10', umbralMinimoPct: '15' }).success).toBe(false)
  })

  it('un umbral que no es número falla con error de validación, sin lanzar', () => {
    const invalida = { umbralVerdePct: 'abc', umbralMinimoPct: '15' }
    expect(() => configuracionDeCosteoSchema.safeParse(invalida)).not.toThrow()
    expect(configuracionDeCosteoSchema.safeParse(invalida).success).toBe(false)
  })

  it('acepta la configuración completa de la empresa (campos de más se ignoran)', () => {
    const r = configuracionDeCosteoSchema.safeParse({
      umbralVerdePct: '30',
      umbralMinimoPct: '15',
      moneda: 'PEN',
      locale: 'es-PE',
    })
    expect(r.success).toBe(true)
  })
})

describe('entradaDeCosteoSchema', () => {
  it('acepta el caso de referencia, con y sin precio final', () => {
    const utilidad = { pct: '35', base: 'venta' } as const
    expect(entradaDeCosteoSchema.safeParse(entradaDelCasoDeReferencia(utilidad)).success).toBe(true)
    expect(entradaDeCosteoSchema.safeParse(entradaDelCasoDeReferencia(utilidad, '250.00')).success).toBe(true)
  })

  it('rechaza un precio final con coma o negativo', () => {
    const utilidad = { pct: '35', base: 'venta' } as const
    expect(entradaDeCosteoSchema.safeParse(entradaDelCasoDeReferencia(utilidad, '250,00')).success).toBe(false)
    expect(entradaDeCosteoSchema.safeParse(entradaDelCasoDeReferencia(utilidad, '-1')).success).toBe(false)
  })
})
