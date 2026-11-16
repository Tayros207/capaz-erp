import { describe, expect, it } from 'vitest'
import {
  configuracionEmpresaSchema,
  formatoPliegoSchema,
  insumoTarifaSchema,
  maquinaSchema,
} from './empresa.js'
import { esMayorOIgual } from './dinero.js'
import { configuracionEsPE, formatosEsPE, insumosEsPE, maquinasEsPE } from './semilla-es-pe.js'

describe('semilla es-PE', () => {
  it('la configuración cumple su esquema, con los valores por defecto del proyecto', () => {
    expect(configuracionEmpresaSchema.safeParse(configuracionEsPE).success).toBe(true)
    expect(configuracionEsPE).toMatchObject({
      utilidadPct: '35', utilidadBase: 'venta', umbralVerdePct: '30', umbralMinimoPct: '15',
    })
  })

  it('cada insumo cumple su esquema y sus ids no se repiten', () => {
    for (const insumo of insumosEsPE) {
      expect(insumoTarifaSchema.safeParse(insumo).success, insumo.id).toBe(true)
    }
    expect(new Set(insumosEsPE.map((i) => i.id)).size).toBe(insumosEsPE.length)
  })

  it('cada unidad de un insumo está en la lista de unidades de la empresa', () => {
    for (const insumo of insumosEsPE) expect(configuracionEsPE.unidades).toContain(insumo.unidad)
  })

  it('trae un insumo inactivo y dos papeles activos (sirven para probar la ambigüedad)', () => {
    expect(insumosEsPE.filter((i) => !i.activo)).toHaveLength(1)
    expect(insumosEsPE.filter((i) => i.activo && i.factor === 'material')).toHaveLength(2)
  })
})

describe('semilla es-PE: formatos y máquinas', () => {
  it('cada formato y cada máquina cumplen su esquema y sus ids no se repiten', () => {
    for (const f of formatosEsPE) expect(formatoPliegoSchema.safeParse(f).success, f.id).toBe(true)
    for (const m of maquinasEsPE) expect(maquinaSchema.safeParse(m).success, m.id).toBe(true)
    expect(new Set(formatosEsPE.map((f) => f.id)).size).toBe(formatosEsPE.length)
    expect(new Set(maquinasEsPE.map((m) => m.id)).size).toBe(maquinasEsPE.length)
  })

  it('trae pliegos madre y de máquina, y la máquina admite el pliego de máquina del caso de referencia', () => {
    expect(formatosEsPE.filter((f) => f.tipo === 'madre').length).toBeGreaterThan(0)
    expect(formatosEsPE.filter((f) => f.tipo === 'maquina').length).toBeGreaterThan(0)
    const [maquina] = maquinasEsPE
    expect(esMayorOIgual(maquina.formatoMaximo.anchoCm, '35')).toBe(true)
    expect(esMayorOIgual(maquina.formatoMaximo.altoCm, '50')).toBe(true)
  })
})

describe('índice de semillas', () => {
  it('cada semilla es válida y la de por defecto está entre las disponibles', async () => {
    const { SEMILLAS, SEMILLA_POR_DEFECTO } = await import('./semillas.js')
    for (const [pais, semilla] of Object.entries(SEMILLAS)) {
      expect(semilla.configuracion.pais, pais).toBe(pais)
      expect(configuracionEmpresaSchema.safeParse(semilla.configuracion).success, pais).toBe(true)
    }
    expect(Object.values(SEMILLAS)).toContain(SEMILLA_POR_DEFECTO)
  })
})
