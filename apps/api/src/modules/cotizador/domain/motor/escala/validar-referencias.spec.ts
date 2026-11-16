import { describe, expect, it } from 'vitest'
import { aTexto, dividir } from '../base/dinero.js'
import type { Referencias } from './tipos/precio-por-escala.js'
import { puntosDeReferencia, validarReferencias } from './validar-referencias.js'

function refs(p100: string, p1000: string, p5000: string): Referencias {
  return { p100, p1000, p5000 }
}

const codigos = (hallazgos: { codigo: string }[]) => hallazgos.map((h) => h.codigo)

describe('referencias válidas', () => {
  it.each([
    ['190 / 580 / 1.200', refs('190', '580', '1200')],
    ['80 / 380 / 1.100', refs('80', '380', '1100')],
    ['600 / 1.800 / 4.200', refs('600', '1800', '4200')],
  ])('%s: sin bloqueos ni avisos', (_nombre, r) => {
    expect(validarReferencias(r)).toEqual({ bloqueos: [], avisos: [] })
  })
})

describe('invariante B: el total debe crecer (bloquea, DEV-01)', () => {
  it('190 / 150 / 400 (cumple A, viola B) se rechaza: 1.000 unidades no pueden costar menos que 100', () => {
    const v = validarReferencias(refs('190', '150', '400'))
    expect(codigos(v.bloqueos)).toEqual(['total_no_crece'])
    expect(v.avisos).toEqual([])
    expect(v.bloqueos[0].mensaje).toContain('1000 unidades (150)')
    expect(v.bloqueos[0].mensaje).toContain('100 (190)')
  })

  it('un total igual al anterior tampoco crece', () => {
    expect(codigos(validarReferencias(refs('190', '190', '400')).bloqueos)).toEqual(['total_no_crece'])
  })

  it('se detecta en el segundo tramo', () => {
    const v = validarReferencias(refs('100', '500', '400'))
    expect(codigos(v.bloqueos)).toEqual(['total_no_crece'])
    expect(v.bloqueos[0].mensaje).toContain('5000 unidades (400)')
  })

  it('los dos tramos pueden fallar a la vez', () => {
    expect(codigos(validarReferencias(refs('190', '150', '100')).bloqueos)).toEqual([
      'total_no_crece',
      'total_no_crece',
    ])
  })
})

describe('invariante A: el unitario debe bajar (avisa)', () => {
  it('P1000 = 10 × P100: el unitario no baja de 100 a 1.000', () => {
    const v = validarReferencias(refs('100', '1000', '3000'))
    expect(v.bloqueos).toEqual([])
    expect(codigos(v.avisos)).toEqual(['unitario_no_baja'])
    expect(v.avisos[0].mensaje).toContain('10 veces el de 100 (1000.00)')
  })

  it('P5000 = 5 × P1000: el unitario no baja de 1.000 a 5.000', () => {
    const v = validarReferencias(refs('100', '300', '1500'))
    expect(codigos(v.avisos)).toEqual(['unitario_no_baja'])
    expect(v.avisos[0].mensaje).toContain('5 veces el de 1000 (1500.00)')
  })

  it('un total que crece más que la cantidad (el unitario sube) avisa', () => {
    expect(codigos(validarReferencias(refs('100', '1200', '2000')).avisos)).toEqual(['unitario_no_baja'])
  })

  it('los dos tramos pueden avisar, y el aviso no bloquea', () => {
    const v = validarReferencias(refs('100', '1000', '5000'))
    expect(codigos(v.avisos)).toEqual(['unitario_no_baja', 'unitario_no_baja'])
    expect(v.bloqueos).toEqual([])
  })

  it('el tope es estricto: un centavo por debajo no avisa, justo en el tope sí', () => {
    // 10 × 100 = 1.000 y 5 × 999.99 = 4.999,95.
    expect(validarReferencias(refs('100', '999.99', '4999.94'))).toEqual({ bloqueos: [], avisos: [] })
    expect(codigos(validarReferencias(refs('100', '999.99', '4999.95')).avisos)).toEqual(['unitario_no_baja'])
  })
})

describe('totales no positivos', () => {
  it('un total en cero bloquea y no se evalúa nada más', () => {
    const v = validarReferencias(refs('0', '580', '1200'))
    expect(codigos(v.bloqueos)).toEqual(['precio_no_positivo'])
    expect(v.bloqueos[0].mensaje).toContain('100 unidades')
    expect(v.avisos).toEqual([])
  })

  it('un cuadro vacío (las tres en cero) da tres bloqueos', () => {
    expect(codigos(validarReferencias(refs('0.00', '0', '0')).bloqueos)).toHaveLength(3)
  })
})

describe('barrido contra un oráculo con enteros (centavos)', () => {
  // Totales en centavos, con los bordes de A (10 × y 5 ×) y de B (igual y ±1 centavo).
  const centavos = [1, 100, 500, 999, 1000, 1001, 4999, 5000, 5001, 9999, 10000, 50000]
  const texto = (c: number) => aTexto(dividir(String(c), '100'), 2)
  const unoSi = (condicion: boolean) => (condicion ? 1 : 0)

  it('bloqueos y avisos coinciden con la definición de A y B en 1.728 combinaciones', () => {
    let comparadas = 0
    for (const a of centavos) {
      for (const b of centavos) {
        for (const c of centavos) {
          // B: el total crece. A: el total crece menos que la cantidad (10 × y luego 5 ×).
          const bloqueos = unoSi(b <= a) + unoSi(c <= b)
          const avisos = unoSi(b > a && b >= 10 * a) + unoSi(c > b && c >= 5 * b)
          const v = validarReferencias(refs(texto(a), texto(b), texto(c)))
          expect([v.bloqueos.length, v.avisos.length], `${a}/${b}/${c}`).toEqual([bloqueos, avisos])
          comparadas++
        }
      }
    }
    expect(comparadas).toBe(1728)
  })
})

describe('puntosDeReferencia', () => {
  it('asocia cada total con su cantidad, de menor a mayor', () => {
    expect(puntosDeReferencia(refs('190', '580', '1200'))).toEqual([
      { cantidad: '100', total: '190' },
      { cantidad: '1000', total: '580' },
      { cantidad: '5000', total: '1200' },
    ])
  })
})
