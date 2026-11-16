import { describe, expect, it } from 'vitest'
import {
  cuadroDelCasoDeReferencia,
  imposicionDelCasoDeReferencia,
  lineasDelCasoDeReferencia,
  papelDelCasoDeReferencia,
  umbralesPorDefecto,
} from './pruebas/caso-de-referencia.js'
import { vectoresDeEscalado } from './pruebas/vectores-de-escalado.js'
import { lineaSchema, type Linea } from './tipos/cotizacion.js'
import type { CuadroEscalable, CuadroEscalado } from './tipos/escalado.js'
import { calcularCotizacion } from './calcular-cotizacion.js'
import { escalarCuadro } from './escalar-cuadro.js'

function escalar(cuadro: CuadroEscalable, cantidad: string): CuadroEscalado {
  const r = escalarCuadro(cuadro, cantidad)
  if (!r.ok) throw new Error(`No debía fallar: ${r.error.mensaje}`)
  return r.valor
}

function codigoDeFallo(cuadro: CuadroEscalable, cantidad: string): string | undefined {
  const r = escalarCuadro(cuadro, cantidad)
  return r.ok ? undefined : r.error.codigo
}

const cantidadesPorId = (lineas: Linea[]) => Object.fromEntries(lineas.map((l) => [l.id, l.cantidad]))

function subtotalesPorId(lineas: Linea[]): Record<string, string> {
  const r = calcularCotizacion(
    { lineas, cantidad: '1', utilidad: { pct: '35', base: 'venta' } },
    umbralesPorDefecto,
  )
  if (!r.ok) throw new Error('No debía fallar')
  return Object.fromEntries(r.valor.lineas.map((l) => [l.id, l.subtotal]))
}

describe('el caso de referencia corrido a otras cantidades (oráculo independiente)', () => {
  for (const v of vectoresDeEscalado) {
    it(`a ${v.cantidad} unidades: pliegos ${v.pliegosNetos} → ${v.pliegosDeMaquina} → ${v.pliegosMadre} madres, costo ${v.costoTotal}`, () => {
      const e = escalar(cuadroDelCasoDeReferencia, v.cantidad)
      expect(e.imposicion).toMatchObject({
        pliegosNetos: v.pliegosNetos,
        pliegosDeMaquina: v.pliegosDeMaquina,
        pliegosMadre: v.pliegosMadre,
      })
      expect(cantidadesPorId(e.lineas)).toEqual(v.cantidades)
      expect(subtotalesPorId(e.lineas)).toEqual(v.subtotales)
    })
  }
})

describe('escalar a 1.000 unidades', () => {
  const e = escalar(cuadroDelCasoDeReferencia, '1000')
  const fila = (id: string) => e.lineas.find((l) => l.id === id)

  it('mantiene planchas (40.00) y diseño (40.00): las filas fijas no cambian', () => {
    expect(fila('l2')?.cantidad).toBe('8')
    expect(fila('l4')?.cantidad).toBe('1')
    const subtotales = subtotalesPorId(e.lineas)
    expect([subtotales.l2, subtotales.l4]).toEqual(['40.00', '40.00'])
  })

  it('recalcula el papel con la imposición: 75 pliegos madre, no 172', () => {
    expect(fila('l1')?.cantidad).toBe('75')
    expect(subtotalesPorId(e.lineas).l1).toBe('33.75')
  })

  it('las filas por pliego siguen a los pliegos de máquina (298 / 685)', () => {
    expect(fila('l3')?.cantidad).toBe('0.348') // 0.8 × 298 / 685
    expect(fila('l5')?.cantidad).toBe('0.435')
  })

  it('devuelve la cantidad nueva y la imposición a esa cantidad', () => {
    expect(e.cantidad).toBe('1000')
    expect(e.imposicion?.pliegosDeMaquina).toBe('298')
  })
})

describe('propiedades', () => {
  it('a la misma cantidad devuelve las mismas filas', () => {
    expect(escalar(cuadroDelCasoDeReferencia, '2500').lineas).toEqual(lineasDelCasoDeReferencia)
  })

  it('no modifica el cuadro recibido y conserva el orden de las filas', () => {
    const copia = JSON.parse(JSON.stringify(cuadroDelCasoDeReferencia))
    const e = escalar(cuadroDelCasoDeReferencia, '100')
    expect(cuadroDelCasoDeReferencia).toEqual(copia)
    expect(e.lineas.map((l) => l.id)).toEqual(lineasDelCasoDeReferencia.map((l) => l.id))
  })

  it('cada fila escalada sigue siendo una fila válida (cantidad con hasta 3 decimales)', () => {
    for (const cantidad of ['100', '137', '1000', '2222', '5000']) {
      for (const linea of escalar(cuadroDelCasoDeReferencia, cantidad).lineas) {
        expect(lineaSchema.safeParse(linea).success, `${linea.id} a ${cantidad}`).toBe(true)
      }
    }
  })

  it('el costo total no baja al pedir más (con este cuadro), de 100 a 5.000', () => {
    let anterior = 0
    for (const cantidad of ['100', '250', '500', '1000', '2500', '4000', '5000']) {
      const r = calcularCotizacion(
        { lineas: escalar(cuadroDelCasoDeReferencia, cantidad).lineas, cantidad, utilidad: { pct: '35', base: 'venta' } },
        umbralesPorDefecto,
      )
      const costo = r.ok ? Number(r.valor.costoTotal) : -1
      expect(costo, cantidad).toBeGreaterThanOrEqual(anterior)
      anterior = costo
    }
  })
})

describe('filas por unidad', () => {
  const porUnidad: Linea = {
    id: 'u1',
    factor: 'acabado',
    descripcion: 'Perforado',
    cantidad: '2500',
    unidad: 'unidad',
    costoUnitario: '0.02',
    escala: 'por_unidad',
  }
  const cuadro: CuadroEscalable = { lineas: [porUnidad], cantidad: '2500' }

  it('siguen a la cantidad del trabajo, sin necesitar papel ni imposición', () => {
    const e = escalar(cuadro, '1000')
    expect(e.lineas[0].cantidad).toBe('1000')
    expect(e.imposicion).toBeNull()
  })

  it('con cantidades fraccionarias redondean a 3 decimales', () => {
    const fraccion = { ...cuadro, lineas: [{ ...porUnidad, cantidad: '1' }] }
    expect(escalar(fraccion, '1000').lineas[0].cantidad).toBe('0.4') // 1 × 1000 / 2500
    expect(escalar({ ...fraccion, cantidad: '3' }, '1000').lineas[0].cantidad).toBe('333.333')
  })
})

describe('papel escrito a mano', () => {
  it('sin fila de papel del motor, la fila de material escala como cualquier otra', () => {
    const cuadro: CuadroEscalable = {
      ...cuadroDelCasoDeReferencia,
      papel: { ...papelDelCasoDeReferencia, lineaDePapelId: null },
    }
    const e = escalar(cuadro, '1000')
    expect(e.lineas.find((l) => l.id === 'l1')?.cantidad).toBe('74.826') // 172 × 298 / 685 = 74.82627…
  })
})

describe('rechazos', () => {
  it('cantidad cero, en el cuadro o en la nueva', () => {
    expect(codigoDeFallo(cuadroDelCasoDeReferencia, '0')).toBe('cantidad_invalida')
    expect(codigoDeFallo({ ...cuadroDelCasoDeReferencia, cantidad: '0' }, '1000')).toBe('cantidad_invalida')
  })

  it('una fila por pliego sin papel e imposición pide la imposición', () => {
    const sinPapel: CuadroEscalable = { lineas: lineasDelCasoDeReferencia, cantidad: '2500' }
    const r = escalarCuadro(sinPapel, '1000')
    expect(r).toMatchObject({ ok: false, error: { codigo: 'imposicion_requerida' } })
    // Nombra la primera fila que lo necesita: en el caso de referencia, el papel.
    if (!r.ok) expect(r.error.mensaje).toContain('Papel couché 150 g')
  })

  it('una fila de papel que ya no existe', () => {
    const cuadro: CuadroEscalable = {
      ...cuadroDelCasoDeReferencia,
      papel: { ...papelDelCasoDeReferencia, lineaDePapelId: 'no-existe' },
    }
    expect(codigoDeFallo(cuadro, '1000')).toBe('papel_no_encontrado')
  })

  it('si la imposición falla, el fallo se propaga con su código', () => {
    const grande = { anchoCm: '60', altoCm: '90' }
    const cuadro: CuadroEscalable = {
      ...cuadroDelCasoDeReferencia,
      papel: { ...papelDelCasoDeReferencia, pieza: grande },
    }
    expect(codigoDeFallo(cuadro, '1000')).toBe('pieza_no_cabe')
  })

  it('una merma de 100 % en la imposición también se propaga', () => {
    const etapas = [{ nombre: 'Tiraje', mermaPct: '100', arranque: '0' }]
    const cuadro: CuadroEscalable = {
      ...cuadroDelCasoDeReferencia,
      papel: {
        ...papelDelCasoDeReferencia,
        imposicion: { ...imposicionDelCasoDeReferencia, etapas },
      },
    }
    expect(codigoDeFallo(cuadro, '1000')).toBe('merma_imposible')
  })
})
