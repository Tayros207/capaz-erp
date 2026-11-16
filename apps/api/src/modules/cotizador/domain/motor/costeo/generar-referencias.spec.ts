import { describe, expect, it } from 'vitest'
// Único cruce entre features y solo en una prueba: aquí se comprueba que lo que genera el cuadro
// cumple lo que valida el precio por escala. El código de `cotizacion` no importa de esa feature.
import { calcularPrecioPorEscala } from '../escala/precio-por-escala.js'
import { validarReferencias } from '../escala/validar-referencias.js'
import {
  cuadroDelCasoDeReferencia,
  lineasDelCasoDeReferencia,
  papelDelCasoDeReferencia,
  umbralesPorDefecto,
} from './pruebas/caso-de-referencia.js'
import { vectoresDeEscalado } from './pruebas/vectores-de-escalado.js'
import type { Utilidad } from './tipos/cotizacion.js'
import type { CuadroEscalable, ReferenciasGeneradas } from './tipos/escalado.js'
import { calcularCotizacion } from './calcular-cotizacion.js'
import { generarReferencias } from './generar-referencias.js'

const SOBRE_VENTA_35: Utilidad = { pct: '35', base: 'venta' }
const RECARGO_35: Utilidad = { pct: '35', base: 'costo' }

function generar(cuadro: CuadroEscalable, utilidad: Utilidad): ReferenciasGeneradas {
  const r = generarReferencias(cuadro, utilidad, umbralesPorDefecto)
  if (!r.ok) throw new Error(`No debía fallar: ${r.error.mensaje}`)
  return r.valor
}

// El mismo cuadro corrido a 2.500 unidades con el motor de costeo (el vector 346.38 del PRP).
function calcularCotizacionEn2500(): string {
  const r = calcularCotizacion(
    { lineas: lineasDelCasoDeReferencia, cantidad: '2500', utilidad: SOBRE_VENTA_35 },
    umbralesPorDefecto,
  )
  if (!r.ok) throw new Error('No debía fallar')
  return r.valor.precio
}

const vector = (cantidad: string) => {
  const v = vectoresDeEscalado.find((x) => x.cantidad === cantidad)
  if (!v) throw new Error(`Falta el vector de ${cantidad}`)
  return v
}

describe('las tres referencias del caso de referencia', () => {
  it('35 % sobre la venta: 144.86 / 220.34 / 555.83 (oráculo independiente)', () => {
    const g = generar(cuadroDelCasoDeReferencia, SOBRE_VENTA_35)
    expect([g.p100, g.p1000, g.p5000]).toEqual([
      vector('100').precioSobreVenta35,
      vector('1000').precioSobreVenta35,
      vector('5000').precioSobreVenta35,
    ])
    expect([g.p100, g.p1000, g.p5000]).toEqual(['144.86', '220.34', '555.83'])
  })

  it('otra empresa, con recargo de 35 % sobre el costo: 127.12 / 193.35 / 487.74', () => {
    const g = generar(cuadroDelCasoDeReferencia, RECARGO_35)
    expect([g.p100, g.p1000, g.p5000]).toEqual(['127.12', '193.35', '487.74'])
  })

  it('cumplen el invariante B y también el A: se pueden guardar sin avisos', () => {
    for (const utilidad of [SOBRE_VENTA_35, RECARGO_35]) {
      const g = generar(cuadroDelCasoDeReferencia, utilidad)
      expect(validarReferencias(g)).toEqual({ bloqueos: [], avisos: [] })
    }
  })

  it('devuelve el cuadro costeado a cada cantidad, con su margen y su semáforo', () => {
    const g = generar(cuadroDelCasoDeReferencia, SOBRE_VENTA_35)
    expect(g.calculos.map((c) => [c.cantidad, c.calculo.costoTotal, c.calculo.margenPct, c.calculo.semaforo])).toEqual([
      ['100', '94.16', '35.00', 'verde'],
      ['1000', '143.22', '35.00', 'verde'],
      ['5000', '361.29', '35.00', 'verde'],
    ])
  })

  it('los tres precios son los sugeridos de cada cálculo, sin ningún precio fijado a mano', () => {
    const g = generar(cuadroDelCasoDeReferencia, SOBRE_VENTA_35)
    expect([g.p100, g.p1000, g.p5000]).toEqual(g.calculos.map((c) => c.calculo.precioSugerido))
    expect(g.calculos.map((c) => c.calculo.precioAjustadoAMano)).toEqual([false, false, false])
  })
})

describe('de las referencias al precio rápido', () => {
  const g = generar(cuadroDelCasoDeReferencia, SOBRE_VENTA_35)
  const variante = { p100: g.p100, p1000: g.p1000, p5000: g.p5000, modoIntermedio: 'curva' } as const

  it('pasa exactamente por las tres referencias generadas', () => {
    for (const [cantidad, total] of [['100', g.p100], ['1000', g.p1000], ['5000', g.p5000]]) {
      const r = calcularPrecioPorEscala(variante, cantidad)
      expect(r.ok && r.valor.total).toBe(total)
    }
  })

  it('entre referencias es una aproximación: a 2.500 la curva da 373.14 y el cuadro exacto 346.38', () => {
    // El cuadro es exacto (costo real + utilidad); la curva solo interpola entre tres puntos, y el
    // costo real no sigue una ley de potencias (planchas y diseño son fijos; los pliegos suben a
    // saltos). 373.14 es el valor del oráculo de 60 dígitos; la diferencia, 7.7 %, es esperable.
    expect(calcularPrecioPorEscala(variante, '2500')).toMatchObject({ ok: true, valor: { total: '373.14' } })
    const enElCuadro = calcularCotizacionEn2500()
    expect(enElCuadro).toBe('346.38')
  })
})

describe('rechazos', () => {
  it('una utilidad imposible (100 % sobre la venta) se propaga', () => {
    const r = generarReferencias(cuadroDelCasoDeReferencia, { pct: '100', base: 'venta' }, umbralesPorDefecto)
    expect(r).toMatchObject({ ok: false, error: { codigo: 'utilidad_imposible' } })
  })

  it('un cuadro con filas por pliego y sin papel e imposición pide la imposición', () => {
    const sinPapel: CuadroEscalable = { lineas: lineasDelCasoDeReferencia, cantidad: '2500' }
    const r = generarReferencias(sinPapel, SOBRE_VENTA_35, umbralesPorDefecto)
    expect(r).toMatchObject({ ok: false, error: { codigo: 'imposicion_requerida' } })
  })

  it('si el papel no encaja, el fallo de la imposición se propaga', () => {
    const cuadro: CuadroEscalable = {
      ...cuadroDelCasoDeReferencia,
      papel: { ...papelDelCasoDeReferencia, pieza: { anchoCm: '60', altoCm: '90' } },
    }
    expect(generarReferencias(cuadro, SOBRE_VENTA_35, umbralesPorDefecto)).toMatchObject({
      ok: false,
      error: { codigo: 'pieza_no_cabe' },
    })
  })

  it('un cuadro vacío genera tres precios en cero, que luego no se pueden guardar', () => {
    const vacio: CuadroEscalable = { lineas: [], cantidad: '2500' }
    const g = generar(vacio, SOBRE_VENTA_35)
    expect([g.p100, g.p1000, g.p5000]).toEqual(['0.00', '0.00', '0.00'])
    expect(validarReferencias(g).bloqueos).toHaveLength(3)
  })
})
