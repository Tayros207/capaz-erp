import { describe, expect, it } from 'vitest'
import { aTexto, restar } from '../base/dinero.js'
import { imposicionDelCasoDeReferencia } from './pruebas/caso-de-referencia.js'
import type { EtapaDeMerma, Mermas } from './tipos/imposicion.js'
import { calcularMermas } from './mermas.js'

function etapa(nombre: string, mermaPct: string, arranque = '0'): EtapaDeMerma {
  return { nombre, mermaPct, arranque }
}

function calcular(netos: string, etapas: EtapaDeMerma[]): Mermas {
  const r = calcularMermas(netos, etapas)
  if (!r.ok) throw new Error(`No debía fallar: ${r.error.mensaje}`)
  return r.valor
}

describe('caso de referencia: merma de tiraje 3 % + 40 hojas de arranque', () => {
  it('625 netos → 645 tras el porcentaje → 685 de máquina', () => {
    const m = calcular('625', imposicionDelCasoDeReferencia.etapas)
    expect(m.etapas).toEqual([
      {
        nombre: 'Tiraje',
        mermaPct: '3',
        arranque: '40',
        salida: '625',
        trasPorcentaje: '645',
        entrada: '685',
      },
    ])
    expect(m.bruto).toBe('685')
  })
})

describe('merma hacia atrás (INF-02)', () => {
  it('100 netos con 20 % piden 125, no 120', () => {
    const m = calcular('100', [etapa('Tiraje', '20')])
    expect(m.etapas[0].trasPorcentaje).toBe('125')
    expect(m.bruto).toBe('125')
  })

  it('un cociente exacto no suma una hoja de más: 100 / 0.8 = 125', () => {
    expect(calcular('100', [etapa('Tiraje', '20')]).bruto).toBe('125')
  })

  it('redondea siempre hacia arriba: 625 / 0.97 = 644.33 → 645', () => {
    expect(calcular('625', [etapa('Tiraje', '3')]).bruto).toBe('645')
  })

  it('0 % de merma: entra lo mismo que sale, más el arranque', () => {
    expect(calcular('100', [etapa('Corte', '0')]).bruto).toBe('100')
    expect(calcular('100', [etapa('Corte', '0', '7')]).bruto).toBe('107')
  })
})

describe('arranque fijo (INF-01)', () => {
  it('suma las mismas hojas en 100 que en 10.000 netos', () => {
    for (const netos of ['100', '10000']) {
      const e = calcular(netos, [etapa('Tiraje', '3', '40')]).etapas[0]
      expect(aTexto(restar(e.entrada, e.trasPorcentaje))).toBe('40')
    }
  })

  it('con solo porcentaje un tiraje corto quedaría corto: 100 netos → 104; con arranque → 144', () => {
    expect(calcular('100', [etapa('Tiraje', '3')]).bruto).toBe('104')
    expect(calcular('100', [etapa('Tiraje', '3', '40')]).bruto).toBe('144')
  })
})

describe('etapas encadenadas', () => {
  // Impresión (3 % + 40) y luego acabado (5 % + 10), en orden de proceso.
  const proceso = [etapa('Impresión', '3', '40'), etapa('Acabado', '5', '10')]

  it('100 netos: acabado ⌈100/0.95⌉+10 = 116; impresión ⌈116/0.97⌉+40 = 160', () => {
    const m = calcular('100', proceso)
    expect(m.etapas.map((e) => [e.nombre, e.salida, e.trasPorcentaje, e.entrada])).toEqual([
      ['Impresión', '116', '120', '160'],
      ['Acabado', '100', '106', '116'],
    ])
    expect(m.bruto).toBe('160')
  })

  it('lo que entra a una etapa es lo que sale de la anterior', () => {
    const m = calcular('100', proceso)
    expect(m.etapas[0].salida).toBe(m.etapas[1].entrada)
  })

  it('el orden importa: invertir las etapas cambia el bruto', () => {
    expect(calcular('100', [...proceso].reverse()).bruto).not.toBe('160')
  })

  it('sin etapas el bruto es el neto', () => {
    expect(calcular('625', [])).toEqual({ etapas: [], bruto: '625' })
  })
})

describe('merma imposible', () => {
  it('100 % se rechaza con el nombre de la etapa', () => {
    const r = calcularMermas('100', [etapa('Tiraje', '3'), etapa('Acabado', '100')])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.codigo).toBe('merma_imposible')
      expect(r.error.mensaje).toContain('Acabado')
    }
  })

  it('más de 100 % también, y 99.999 % sigue siendo calculable', () => {
    expect(calcularMermas('100', [etapa('Tiraje', '150')]).ok).toBe(false)
    expect(calcular('10', [etapa('Tiraje', '99.999')]).bruto).toBe('1000000')
  })
})

describe('el resultado es serializable', () => {
  it('todo son textos y sobrevive a JSON', () => {
    const m = calcular('100', [etapa('Impresión', '3', '40'), etapa('Acabado', '5', '10')])
    expect(JSON.parse(JSON.stringify(m))).toEqual(m)
    for (const e of m.etapas) {
      for (const valor of Object.values(e)) expect(typeof valor).toBe('string')
    }
  })
})

describe('propiedad: la entrada es el menor entero que cubre lo pedido (enteros BigInt)', () => {
  // Porcentajes con su valor en milésimas, para comprobar con enteros y sin decimales.
  const porcentajes: [texto: string, milesimas: number][] = [
    ['0', 0],
    ['0.5', 500],
    ['3', 3000],
    ['12.5', 12500],
    ['20', 20000],
    ['33.333', 33333],
    ['99.999', 99999],
  ]

  it('x × (100 − m) ≥ salida × 100, y con una hoja menos ya no alcanza', () => {
    const cien = BigInt(100000)
    for (const [texto, milesimas] of porcentajes) {
      const factor = cien - BigInt(milesimas)
      for (let salida = 1; salida <= 300; salida++) {
        const x = BigInt(calcular(String(salida), [etapa('Tiraje', texto)]).etapas[0].trasPorcentaje)
        const necesario = BigInt(salida) * cien
        expect(x * factor >= necesario, `${salida} con ${texto} %: ${x} no alcanza`).toBe(true)
        expect((x - BigInt(1)) * factor < necesario, `${salida} con ${texto} %: ${x} sobra`).toBe(true)
      }
    }
  })
})
