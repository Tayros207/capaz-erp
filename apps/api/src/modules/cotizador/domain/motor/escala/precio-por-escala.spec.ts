import { describe, expect, it } from 'vitest'
import { aTexto, redondear } from '../base/dinero.js'
import { juegosDeVectores } from './pruebas/vectores-de-curva.js'
import type { PrecioPorEscala, VariantePrecio } from './tipos/precio-por-escala.js'
import { calcularPrecioPorEscala } from './precio-por-escala.js'

function variante(
  p100: string,
  p1000: string,
  p5000: string,
  extra: Partial<VariantePrecio> = {},
): VariantePrecio {
  return { p100, p1000, p5000, modoIntermedio: 'curva', ...extra }
}

function precio(v: VariantePrecio, cantidad: string): PrecioPorEscala {
  const r = calcularPrecioPorEscala(v, cantidad)
  if (!r.ok) throw new Error(`No debía fallar: ${r.error.mensaje}`)
  return r.valor
}

const V_190 = variante('190', '580', '1200')

describe('tabla de docs/rescate: 190 / 580 / 1.200', () => {
  // Cantidad, unitario mostrado con 2 decimales (columna del documento) y total del lote.
  const tabla: [string, string, string][] = [
    ['100', '1.90', '190.00'],
    ['200', '1.33', '265.86'],
    ['500', '0.83', '414.50'],
    ['800', '0.65', '520.54'],
    ['1000', '0.58', '580.00'],
    ['1500', '0.46', '696.59'],
    ['2500', '0.35', '877.39'],
    ['3000', '0.32', '952.72'],
    ['5000', '0.24', '1200.00'],
  ]

  it.each(tabla)('%s unidades: unitario %s y total %s', (cantidad, unitario2, total) => {
    const p = precio(V_190, cantidad)
    expect(p.total).toBe(total)
    expect(aTexto(redondear(p.unitario, 2), 2)).toBe(unitario2)
  })

  it('el unitario es informativo (PLA-03): 0.3510 × 2.500 = 877.50, y el total sigue en 877.39', () => {
    const p = precio(V_190, '2500')
    expect(p.unitario).toBe('0.3510')
    expect(p.total).toBe('877.39')
  })
})

describe('pasa exactamente por las tres referencias', () => {
  it.each([
    ['190 / 580 / 1.200', variante('190', '580', '1200')],
    ['80 / 380 / 1.100', variante('80', '380', '1100')],
    ['600 / 1.800 / 4.200', variante('600', '1800', '4200')],
    ['100.05 / 999.10 / 4999.99', variante('100.05', '999.10', '4999.99')],
  ])('%s, en modo curva y en modo escalón', (_nombre, v) => {
    for (const modoIntermedio of ['curva', 'escalon'] as const) {
      const conModo = { ...v, modoIntermedio }
      expect(precio(conModo, '100').total).toBe(aTexto(v.p100, 2))
      expect(precio(conModo, '1000').total).toBe(aTexto(v.p1000, 2))
      expect(precio(conModo, '5000').total).toBe(aTexto(v.p5000, 2))
    }
  })

  it('una cantidad escrita como 1000.0 también es la referencia', () => {
    expect(precio(V_190, '1000.0').total).toBe('580.00')
  })
})

describe('curva contra un oráculo de alta precisión (Decimal de 60 dígitos)', () => {
  for (const juego of juegosDeVectores) {
    it(`${juego.nombre}: ${juego.puntos.length} cantidades, al céntimo`, () => {
      const v = variante(juego.referencias.p100, juego.referencias.p1000, juego.referencias.p5000)
      for (const [cantidad, total] of juego.puntos) {
        expect(precio(v, cantidad).total, `${juego.nombre} a ${cantidad}`).toBe(total)
      }
    })
  }
})

describe('propiedades de la curva', () => {
  const juegos = [V_190, variante('80', '380', '1100'), variante('600', '1800', '4200')]

  it('con B, el total nunca baja al pedir más: 4.901 cantidades por juego', () => {
    for (const v of juegos) {
      let anterior = -1
      for (let q = 100; q <= 5000; q++) {
        const total = Number(precio(v, String(q)).total)
        expect(total >= anterior, `${v.p100}/${v.p1000}/${v.p5000} a ${q}`).toBe(true)
        anterior = total
      }
    }
  })

  it('es continua en 1.000: el tramo anterior y el siguiente llegan a la referencia', () => {
    const antes = Number(precio(V_190, '999').total)
    const despues = Number(precio(V_190, '1001').total)
    expect(antes).toBeLessThanOrEqual(580)
    expect(despues).toBeGreaterThanOrEqual(580)
    expect(580 - antes).toBeLessThan(1)
    expect(despues - 580).toBeLessThan(1)
  })

  it('con el mismo unitario en las tres referencias el total es cantidad × unitario', () => {
    const plano = variante('100', '1000', '5000') // viola A (solo avisa) pero cotiza
    expect(precio(plano, '500').total).toBe('500.00')
    expect(precio(plano, '2500').total).toBe('2500.00')
  })
})

describe('modo escalón', () => {
  const escalon = { ...V_190, modoIntermedio: 'escalon' } as const

  it('2.500 unidades: unitario de la referencia de 1.000 × cantidad = 0.58 × 2.500 = 1.450.00', () => {
    const p = precio(escalon, '2500')
    expect(p.total).toBe('1450.00')
    expect(p.unitario).toBe('0.5800')
  })

  it('cada tramo usa el unitario de su referencia inferior', () => {
    expect(precio(escalon, '100').total).toBe('190.00')
    expect(precio(escalon, '999').total).toBe('1898.10') // 999 × 1.90
    expect(precio(escalon, '1000').total).toBe('580.00')
    expect(precio(escalon, '4999').total).toBe('2899.42') // 4.999 × 0.58
    expect(precio(escalon, '5000').total).toBe('1200.00')
  })

  it('en el salto el total baja: 999 unidades cuestan más que 1.000 (es un corte de precio, no un error)', () => {
    expect(Number(precio(escalon, '999').total)).toBeGreaterThan(Number(precio(escalon, '1000').total))
  })
})

describe('precio mínimo', () => {
  it('100 unidades con mínimo 250 cuestan 250.00, no 190', () => {
    const p = precio({ ...V_190, precioMinimo: '250' }, '100')
    expect(p).toMatchObject({ total: '250.00', unitario: '2.5000', minimoAplicado: true })
  })

  it('si el total ya lo supera, no se aplica', () => {
    const p = precio({ ...V_190, precioMinimo: '250' }, '500')
    expect(p).toMatchObject({ total: '414.50', minimoAplicado: false })
  })

  it('un mínimo igual al total no cambia nada ni cuenta como aplicado', () => {
    expect(precio({ ...V_190, precioMinimo: '190' }, '100')).toMatchObject({ total: '190.00', minimoAplicado: false })
  })

  it('vale también en modo escalón y se aplica después de redondear', () => {
    const p = precio({ ...V_190, modoIntermedio: 'escalon', precioMinimo: '1500' }, '2500')
    expect(p).toMatchObject({ total: '1500.00', minimoAplicado: true }) // el escalón daba 1.450.00
  })
})

describe('fuera de rango: cotizar aparte', () => {
  it('menos de 100 y más de 5.000, incluso por una fracción', () => {
    for (const cantidad of ['99', '99.999', '50', '5001', '5000.001', '100000']) {
      const r = calcularPrecioPorEscala(V_190, cantidad)
      expect(r.ok, cantidad).toBe(false)
      if (!r.ok) {
        expect(r.error.codigo).toBe('fuera_de_rango')
        expect(r.error.mensaje).toContain('cotizar aparte')
        expect(r.error.mensaje).toContain('100 a 5000')
      }
    }
  })

  it('100 y 5.000 están dentro', () => {
    expect(calcularPrecioPorEscala(V_190, '100').ok).toBe(true)
    expect(calcularPrecioPorEscala(V_190, '5000').ok).toBe(true)
  })

  it('cero es una cantidad inválida, no un caso «aparte»', () => {
    expect(calcularPrecioPorEscala(V_190, '0')).toMatchObject({ ok: false, error: { codigo: 'cantidad_invalida' } })
  })
})

describe('referencias inválidas', () => {
  it('190 / 150 / 400 (viola B) no cotiza nada, en ningún modo (DEV-01)', () => {
    for (const modoIntermedio of ['curva', 'escalon'] as const) {
      const r = calcularPrecioPorEscala(variante('190', '150', '400', { modoIntermedio }), '1000')
      expect(r).toMatchObject({ ok: false, error: { codigo: 'referencias_invalidas' } })
    }
  })

  it('un total en cero tampoco', () => {
    const r = calcularPrecioPorEscala(variante('0', '580', '1200'), '500')
    expect(r).toMatchObject({ ok: false, error: { codigo: 'referencias_invalidas' } })
  })

  it('un cálculo que no es finito se rechaza en vez de devolver NaN o Infinity', () => {
    const desmesurado = variante('1', '2', '1e400')
    const r = calcularPrecioPorEscala(desmesurado, '2500')
    expect(r).toMatchObject({ ok: false, error: { codigo: 'calculo_invalido' } })
  })
})

describe('el resultado es serializable', () => {
  it('todo son textos y un booleano; sobrevive a JSON', () => {
    const p = precio(V_190, '2500')
    expect(JSON.parse(JSON.stringify(p))).toEqual(p)
    expect(typeof p.total).toBe('string')
    expect(typeof p.unitario).toBe('string')
  })
})
