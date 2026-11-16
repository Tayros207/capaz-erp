import { describe, expect, test } from 'vitest'
import { buscarMontoEnPalabras, montoEnPalabrasSoles } from './numeros-en-palabras.js'

describe('montoEnPalabrasSoles', () => {
  test('lee el numero dentro de una frase cualquiera', () => {
    expect(montoEnPalabrasSoles('me salieron trescientos cincuenta soles')).toBe(350)
    expect(montoEnPalabrasSoles('ingreso de mil quinientos soles')).toBe(1500)
    expect(montoEnPalabrasSoles('tarjetas, ciento cincuenta soles')).toBe(150)
    expect(montoEnPalabrasSoles('cobre ochenta soles')).toBe(80)
    expect(montoEnPalabrasSoles('doscientos cuarenta soles')).toBe(240)
    expect(montoEnPalabrasSoles('dos mil soles')).toBe(2000)
  })

  test('las tildes no lo detienen', () => {
    expect(montoEnPalabrasSoles('son veintitrés soles')).toBe(23)
    expect(montoEnPalabrasSoles('un millón de soles')).toBe(1_000_000)
  })

  test('no toma por importe un numero que solo cuenta cosas', () => {
    // Sin esto, «un millar de volantes» seria un movimiento de S/1.00.
    expect(montoEnPalabrasSoles('un millar de volantes')).toBeNull()
    expect(montoEnPalabrasSoles('una cartulina')).toBeNull()
    expect(montoEnPalabrasSoles('dos planchas')).toBeNull()
  })

  test('dice donde estaba, para poder separar la descripcion', () => {
    const r = buscarMontoEnPalabras('tarjetas, ciento cincuenta soles')
    expect(r?.soles).toBe(150)
    expect('tarjetas, ciento cincuenta soles'.slice(0, r!.inicio).trim()).toBe('tarjetas,')
  })

  test('sin numeros no devuelve nada', () => {
    expect(montoEnPalabrasSoles('millar de volantes')).toBeNull()
    expect(montoEnPalabrasSoles('')).toBeNull()
  })
})
