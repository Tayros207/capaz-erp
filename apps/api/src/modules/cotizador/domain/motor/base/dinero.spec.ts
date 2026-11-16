import { describe, expect, it } from 'vitest'
import {
  aTexto,
  decimal,
  dividir,
  esCero,
  esIgual,
  esMayor,
  esMayorOIgual,
  esMenor,
  multiplicar,
  pct,
  piso,
  redondear,
  restar,
  sumar,
  techo,
} from './dinero.js'

describe('sumar / restar / multiplicar', () => {
  it('suma exacta: 0.10 + 0.20 = 0.30 (en float da 0.30000000000000004)', () => {
    expect(aTexto(sumar('0.10', '0.20'), 2)).toBe('0.30')
    expect(0.1 + 0.2).not.toBe(0.3)
  })

  it('sumar sin argumentos es cero', () => {
    expect(aTexto(sumar(), 2)).toBe('0.00')
  })

  it('restar y multiplicar no acumulan error', () => {
    expect(aTexto(restar('346.38', '225.15'), 2)).toBe('121.23')
    expect(aTexto(multiplicar('172', '0.45'), 2)).toBe('77.40')
  })

  it('acepta instancias ya creadas', () => {
    expect(aTexto(sumar(decimal('1.5'), '2.5'), 1)).toBe('4.0')
  })
})

describe('redondear (half-up)', () => {
  it('1 × 1.005 = 1.01 (en float da 1.00)', () => {
    expect(aTexto(redondear(multiplicar('1', '1.005'), 2), 2)).toBe('1.01')
    expect(Math.round(1.005 * 100) / 100).toBe(1)
  })

  it('el 5 sube y por debajo del 5 baja', () => {
    expect(aTexto(redondear('0.125', 2), 2)).toBe('0.13')
    expect(aTexto(redondear('0.124', 2), 2)).toBe('0.12')
    expect(aTexto(redondear('303.9525', 2), 2)).toBe('303.95')
  })

  it('en negativos se aleja del cero', () => {
    expect(aTexto(redondear('-1.005', 2), 2)).toBe('-1.01')
  })
})

describe('techo y piso', () => {
  it('techo sobre Big no arrastra el error de la división flotante', () => {
    // En float 0.07 × 100 = 7.000000000000001, y Math.ceil lo sube a 8.
    expect(Math.ceil(0.07 * 100)).toBe(8)
    expect(aTexto(techo(multiplicar('0.07', '100')))).toBe('7')
  })

  it('merma hacia atrás: 625 / (1 − 0.03) → 645 y 100 / (1 − 0.20) → 125', () => {
    expect(aTexto(techo(dividir('625', restar('1', '0.03'))))).toBe('645')
    expect(aTexto(techo(dividir('100', restar('1', '0.20'))))).toBe('125')
  })

  it('un entero exacto no cambia', () => {
    expect(aTexto(techo('685'))).toBe('685')
    expect(aTexto(piso('685'))).toBe('685')
  })

  it('techo sube y piso baja en positivos', () => {
    expect(aTexto(techo('2.0001'))).toBe('3')
    expect(aTexto(piso('2.9999'))).toBe('2')
  })

  it('en negativos techo va hacia +∞ y piso hacia −∞', () => {
    expect(aTexto(techo('-2.3'))).toBe('-2')
    expect(aTexto(piso('-2.3'))).toBe('-3')
  })
})

describe('dividir y pct', () => {
  it('divide con precisión decimal', () => {
    expect(aTexto(redondear(dividir('22515', '65'), 2), 2)).toBe('346.38')
  })

  it('dividir entre cero lanza RangeError', () => {
    expect(() => dividir('1', '0')).toThrow(RangeError)
    expect(() => dividir('1', '0.000')).toThrow(RangeError)
  })

  it('pct calcula el porcentaje sin redondear', () => {
    expect(aTexto(pct('225.15', '35'))).toBe('78.8025')
  })
})

describe('comparaciones', () => {
  it('comparan por valor, no por texto', () => {
    expect(esIgual('1.50', '1.5')).toBe(true)
    expect(esMenor('9', '10')).toBe(true)
    expect(esMayor('10', '9')).toBe(true)
    expect(esMayorOIgual('30.00', '30')).toBe(true)
    expect(esMayorOIgual('29.99', '30')).toBe(false)
  })

  it('esCero reconoce ceros con ceros a la derecha', () => {
    expect(esCero('0')).toBe(true)
    expect(esCero('0.000')).toBe(true)
    expect(esCero('0.001')).toBe(false)
  })
})

describe('aTexto', () => {
  it('nunca usa notación exponencial (toString de big.js sí la usa)', () => {
    expect(aTexto('0.0000001')).toBe('0.0000001')
    expect(aTexto('100000000000000000000000')).toBe('100000000000000000000000')
  })

  it('con decimales rellena con ceros y redondea half-up', () => {
    expect(aTexto('5', 2)).toBe('5.00')
    expect(aTexto('0.125', 2)).toBe('0.13')
    expect(aTexto('0.138552', 4)).toBe('0.1386')
  })

  it('un valor que redondea a cero no queda con signo', () => {
    expect(aTexto('-0.001', 2)).toBe('0.00')
  })
})

describe('entradas inválidas (ADR-04)', () => {
  it('rechaza un number: ningún importe entra por un float', () => {
    expect(() => decimal(0.1 as unknown as string)).toThrow()
    expect(() => sumar('1', 2 as unknown as string)).toThrow()
  })

  it('rechaza texto que no es un número, incluida la coma decimal', () => {
    expect(() => decimal('abc')).toThrow()
    expect(() => decimal('1,5')).toThrow()
    expect(() => decimal('')).toThrow()
  })
})
