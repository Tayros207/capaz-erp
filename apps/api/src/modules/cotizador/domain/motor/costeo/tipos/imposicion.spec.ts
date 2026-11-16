import { describe, expect, it } from 'vitest'
import {
  entradaDeImposicionDelCasoDeReferencia,
  imposicionDelCasoDeReferencia,
} from '../pruebas/caso-de-referencia.js'
import {
  dimensionesSchema,
  entradaDeImposicionSchema,
  etapaDeMermaSchema,
  imposicionSchema,
} from './imposicion.js'

const etapaValida = imposicionDelCasoDeReferencia.etapas[0]

describe('entradaDeImposicionSchema', () => {
  it('acepta el caso de referencia, con y sin formato máximo', () => {
    expect(entradaDeImposicionSchema.safeParse(entradaDeImposicionDelCasoDeReferencia).success).toBe(true)
    const conMaquina = {
      ...imposicionDelCasoDeReferencia,
      formatoMaximo: { anchoCm: '36', altoCm: '52' },
    }
    expect(imposicionSchema.safeParse(conMaquina).success).toBe(true)
  })

  it('rechaza cantidad cero, con coma o como number', () => {
    for (const cantidad of ['0', '0.000', '2,500', 2500]) {
      const r = entradaDeImposicionSchema.safeParse({ ...entradaDeImposicionDelCasoDeReferencia, cantidad })
      expect(r.success, String(cantidad)).toBe(false)
    }
  })

  it('rechaza campos que no existen, como una empresa colada por los argumentos', () => {
    const colada = { ...entradaDeImposicionDelCasoDeReferencia, empresaId: 'otra' }
    expect(entradaDeImposicionSchema.safeParse(colada).success).toBe(false)
    const enLaImposicion = { ...imposicionDelCasoDeReferencia, empresaId: 'otra' }
    expect(imposicionSchema.safeParse(enLaImposicion).success).toBe(false)
  })
})

describe('dimensionesSchema', () => {
  it('rechaza medidas en cero, con coma o negativas, con un mensaje que dice qué falta', () => {
    for (const anchoCm of ['0', '0.00', '14,8', '-3']) {
      expect(dimensionesSchema.safeParse({ anchoCm, altoCm: '21' }).success, anchoCm).toBe(false)
    }
    const r = dimensionesSchema.safeParse({ anchoCm: '0', altoCm: '21' })
    expect(r.error?.issues[0].message).toBe('Debe ser mayor que cero.')
  })
})

describe('etapaDeMermaSchema', () => {
  it('la merma debe ser menor que 100 %, con 99.999 como máximo válido', () => {
    expect(etapaDeMermaSchema.safeParse({ ...etapaValida, mermaPct: '99.999' }).success).toBe(true)
    for (const mermaPct of ['100', '100.000', '150']) {
      const r = etapaDeMermaSchema.safeParse({ ...etapaValida, mermaPct })
      expect(r.success, mermaPct).toBe(false)
      expect(r.error?.issues[0].message).toBe('La merma debe ser menor que 100 %.')
    }
  })

  it('la merma con texto no numérico da un error de validación, no una excepción (Zod 4)', () => {
    for (const mermaPct of ['abc', '', '3,5']) {
      expect(() => etapaDeMermaSchema.safeParse({ ...etapaValida, mermaPct })).not.toThrow()
      expect(etapaDeMermaSchema.safeParse({ ...etapaValida, mermaPct }).success).toBe(false)
    }
  })

  it('el arranque son hojas enteras y el nombre no puede quedar vacío', () => {
    expect(etapaDeMermaSchema.safeParse({ ...etapaValida, arranque: '40.5' }).success).toBe(false)
    expect(etapaDeMermaSchema.safeParse({ ...etapaValida, nombre: '   ' }).success).toBe(false)
  })
})

describe('imposicionSchema', () => {
  it('admite hasta 10 etapas y ninguna', () => {
    const conEtapas = (n: number) => ({
      ...imposicionDelCasoDeReferencia,
      etapas: Array.from({ length: n }, () => etapaValida),
    })
    expect(imposicionSchema.safeParse(conEtapas(0)).success).toBe(true)
    expect(imposicionSchema.safeParse(conEtapas(10)).success).toBe(true)
    expect(imposicionSchema.safeParse(conEtapas(11)).success).toBe(false)
  })

  it('el sangrado, la calle y la pinza pueden ser cero', () => {
    const sinMargenes = { ...imposicionDelCasoDeReferencia, sangradoCm: '0', calleCm: '0', pinzaCm: '0' }
    expect(imposicionSchema.safeParse(sinMargenes).success).toBe(true)
  })
})
