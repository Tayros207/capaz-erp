import { describe, expect, it } from 'vitest'
import { aTexto, multiplicar } from '../base/dinero.js'
import {
  entradaDelCasoDeReferencia,
  lineasDelCasoDeReferencia,
  umbralesPorDefecto,
} from './pruebas/caso-de-referencia.js'
import type {
  Calculo,
  EntradaDeCosteo,
  Escala,
  Factor,
  Linea,
  Utilidad,
} from './tipos/cotizacion.js'
import { calcularCotizacion, calcularMargen } from './calcular-cotizacion.js'

const SOBRE_VENTA_35: Utilidad = { pct: '35', base: 'venta' }
const RECARGO_35: Utilidad = { pct: '35', base: 'costo' }

function fila(factor: Factor, cantidad: string, costoUnitario: string, id = 'x'): Linea {
  return { id, factor, descripcion: 'Fila', cantidad, unidad: 'u', costoUnitario, escala: 'fija' }
}

function entrada(lineas: Linea[], utilidad: Utilidad, cantidad = '2500'): EntradaDeCosteo {
  return { lineas, cantidad, utilidad }
}

function calcular(e: EntradaDeCosteo, config = umbralesPorDefecto): Calculo {
  const r = calcularCotizacion(e, config)
  if (!r.ok) throw new Error(`No debía fallar: ${r.error.mensaje}`)
  return r.valor
}

describe('caso de referencia: 2.500 volantes A5', () => {
  it('costo por fila y por factor', () => {
    const c = calcular(entradaDelCasoDeReferencia(SOBRE_VENTA_35))
    expect(c.lineas.map((l) => l.subtotal)).toEqual(['77.40', '40.00', '24.00', '40.00', '28.00', '15.75'])
    expect(c.porFactor).toEqual({
      material: '77.40',
      impresion: '24.00',
      planchas: '40.00',
      diseno: '40.00',
      acabado: '43.75',
      indirectos: '0.00',
    })
    expect(c.costoTotal).toBe('225.15')
  })

  it('35 % sobre la venta: 346.38, utilidad 121.23, unitario 0.1386, margen 35.00 % en verde', () => {
    const c = calcular(entradaDelCasoDeReferencia(SOBRE_VENTA_35))
    expect(c.precioSugerido).toBe('346.38')
    expect(c.precio).toBe('346.38')
    expect(c.precioAjustadoAMano).toBe(false)
    expect(c.utilidad).toBe('121.23')
    expect(c.unitario).toBe('0.1386')
    expect(c.margenPct).toBe('35.00')
    expect(c.semaforo).toBe('verde')
  })

  it('el margen exacto es 34.9991 y se muestra como 35.00', () => {
    const margen = calcularMargen('346.38', '225.15')
    expect(margen && aTexto(margen.exactoPct, 4)).toBe('34.9991')
    expect(margen && aTexto(margen.mostradoPct, 2)).toBe('35.00')
  })

  it('recargo 35 % sobre el costo: 303.95, utilidad 78.80, unitario 0.1216, margen 25.93 % en ámbar', () => {
    const c = calcular(entradaDelCasoDeReferencia(RECARGO_35))
    expect(c.precio).toBe('303.95')
    expect(c.utilidad).toBe('78.80')
    expect(c.unitario).toBe('0.1216')
    expect(c.margenPct).toBe('25.93')
    expect(c.semaforo).toBe('ambar')
  })

  it('otra empresa (recargo 35 %, umbrales 20/10) da 303.95, 25.93 % y verde sin tocar código', () => {
    const c = calcular(entradaDelCasoDeReferencia(RECARGO_35), {
      umbralVerdePct: '20',
      umbralMinimoPct: '10',
    })
    expect(c.precio).toBe('303.95')
    expect(c.margenPct).toBe('25.93')
    expect(c.semaforo).toBe('verde')
  })

  it('el total manda: el unitario de 4 decimales no multiplica de vuelta al total (PLA-03)', () => {
    const c = calcular(entradaDelCasoDeReferencia(SOBRE_VENTA_35))
    expect(aTexto(multiplicar(c.unitario ?? '0', '2500'), 2)).toBe('346.50')
    expect(c.precio).toBe('346.38')
  })
})

describe('precio final fijado a mano', () => {
  it('cambia precio, utilidad, margen y semáforo, y deja el sugerido a la vista', () => {
    const c = calcular(entradaDelCasoDeReferencia(SOBRE_VENTA_35, '250.00'))
    expect(c.precioSugerido).toBe('346.38')
    expect(c.precio).toBe('250.00')
    expect(c.precioAjustadoAMano).toBe(true)
    expect(c.utilidad).toBe('24.85')
    expect(c.margenPct).toBe('9.94')
    expect(c.unitario).toBe('0.1000')
    expect(c.semaforo).toBe('rojo')
  })

  it('un descuento moderado queda en ámbar', () => {
    const c = calcular(entradaDelCasoDeReferencia(SOBRE_VENTA_35, '300.00'))
    expect(c.utilidad).toBe('74.85')
    expect(c.margenPct).toBe('24.95')
    expect(c.semaforo).toBe('ambar')
  })

  it('por debajo del costo el margen es negativo y va en rojo', () => {
    const c = calcular(entradaDelCasoDeReferencia(SOBRE_VENTA_35, '200.00'))
    expect(c.utilidad).toBe('-25.15')
    expect(c.margenPct).toBe('-12.58')
    expect(c.semaforo).toBe('rojo')
  })

  it('precio 0 con costo: sin margen ni unitario y en rojo (se regala el trabajo)', () => {
    const c = calcular(entradaDelCasoDeReferencia(SOBRE_VENTA_35, '0'))
    expect(c.margenPct).toBeNull()
    expect(c.unitario).toBeNull()
    expect(c.utilidad).toBe('-225.15')
    expect(c.semaforo).toBe('rojo')
  })
})

describe('vectores de límites', () => {
  it('utilidad de 100 % o más sobre la venta se rechaza; sobre el costo no tiene tope', () => {
    for (const pct of ['100', '150']) {
      const r = calcularCotizacion(entradaDelCasoDeReferencia({ pct, base: 'venta' }), umbralesPorDefecto)
      expect(r).toMatchObject({ ok: false, error: { codigo: 'utilidad_imposible' } })
    }
    expect(calcular(entradaDelCasoDeReferencia({ pct: '100', base: 'costo' })).precio).toBe('450.30')
  })

  it('99.999 % sobre la venta es válido', () => {
    expect(calcular(entrada([fila('material', '1', '1')], { pct: '99.999', base: 'venta' })).precio).toBe('100000.00')
  })

  it('cuadro vacío: precio 0.00, margen y unitario sin valor, sin semáforo', () => {
    const c = calcular(entrada([], SOBRE_VENTA_35))
    expect(c.costoTotal).toBe('0.00')
    expect(c.precioSugerido).toBe('0.00')
    expect(c.precio).toBe('0.00')
    expect(c.utilidad).toBe('0.00')
    expect(c.margenPct).toBeNull()
    expect(c.unitario).toBeNull()
    expect(c.semaforo).toBeNull()
    expect(Object.values(c.porFactor).every((v) => v === '0.00')).toBe(true)
  })

  it('un factor sin filas aparece en cero, no desaparece', () => {
    const c = calcular(entrada([fila('material', '2', '10')], SOBRE_VENTA_35))
    expect(Object.keys(c.porFactor)).toHaveLength(6)
    expect(c.porFactor.planchas).toBe('0.00')
  })

  it('suma exacta: 0.10 + 0.20 = 0.30', () => {
    const c = calcular(entrada([fila('material', '1', '0.10', 'a'), fila('acabado', '1', '0.20', 'b')], SOBRE_VENTA_35))
    expect(c.costoTotal).toBe('0.30')
  })

  it('redondeo half-up: 1 × 1.005 = 1.01', () => {
    const c = calcular(entrada([fila('material', '1', '1.005')], SOBRE_VENTA_35))
    expect(c.lineas[0].subtotal).toBe('1.01')
    expect(c.costoTotal).toBe('1.01')
  })

  it('cada subtotal se redondea y esos son los que se suman: lo impreso cuadra con el total', () => {
    const c = calcular(entrada([fila('material', '1', '1.005', 'a'), fila('material', '1', '1.005', 'b')], SOBRE_VENTA_35))
    expect(c.lineas.map((l) => l.subtotal)).toEqual(['1.01', '1.01'])
    expect(c.costoTotal).toBe('2.02')
  })

  it('semáforo en el límite: costo 102 con 30 % sobre la venta → 145.71, margen 29.998 → 30.00, verde', () => {
    const e = entrada([fila('material', '1', '102')], { pct: '30', base: 'venta' })
    const c = calcular(e)
    const margen = calcularMargen(c.precio, c.costoTotal)
    expect(c.precio).toBe('145.71')
    expect(margen && aTexto(margen.exactoPct, 3)).toBe('29.998')
    expect(c.margenPct).toBe('30.00')
    expect(c.semaforo).toBe('verde')
  })

  it('ejemplo del informe: costo 100 con 30 % da venta 142.86 y, como recargo, 130.00 (margen 23.08 %)', () => {
    const lineas = [fila('material', '1', '100')]
    expect(calcular(entrada(lineas, { pct: '30', base: 'venta' })).precio).toBe('142.86')
    const recargo = calcular(entrada(lineas, { pct: '30', base: 'costo' }))
    expect(recargo.precio).toBe('130.00')
    expect(recargo.margenPct).toBe('23.08')
  })

  it('el unitario no existe si la cantidad es 0', () => {
    expect(calcular(entrada([fila('material', '1', '10')], SOBRE_VENTA_35, '0')).unitario).toBeNull()
  })
})

describe('PLA-01: el semáforo no miente en el límite', () => {
  it('con 30 % sobre la venta, comparar el margen exacto pondría 387 de 901 costos en ámbar', () => {
    let ambarSiSeComparaElExacto = 0
    let ambarComoSeMuestra = 0
    for (let costo = 100; costo <= 1000; costo++) {
      const c = calcular(entrada([fila('material', '1', String(costo))], { pct: '30', base: 'venta' }))
      const margen = calcularMargen(c.precio, c.costoTotal)
      if (margen && margen.exactoPct.lt('30')) ambarSiSeComparaElExacto++
      if (c.semaforo !== 'verde') ambarComoSeMuestra++
    }
    expect(ambarSiSeComparaElExacto).toBe(387)
    expect(ambarComoSeMuestra).toBe(0)
  })
})

describe('propiedades del motor', () => {
  it('es puro: no muta la entrada y repetir la llamada da lo mismo', () => {
    const e = entradaDelCasoDeReferencia(SOBRE_VENTA_35)
    const copia = structuredClone(e)
    expect(calcular(e)).toEqual(calcular(e))
    expect(e).toEqual(copia)
  })

  it('la escala de una fila no cambia el costeo (solo importa al escalar el cuadro, Fase 3)', () => {
    const escalas: Escala[] = ['fija', 'por_pliego', 'por_unidad']
    const resultados = escalas.map((escala) =>
      calcular({
        ...entradaDelCasoDeReferencia(SOBRE_VENTA_35),
        lineas: lineasDelCasoDeReferencia.map((l) => ({ ...l, escala })),
      }),
    )
    expect(resultados[1]).toEqual(resultados[0])
    expect(resultados[2]).toEqual(resultados[0])
  })

  it('importes enormes no producen NaN ni Infinity', () => {
    const c = calcular(entrada([fila('material', '999999999', '9999999999.9999')], SOBRE_VENTA_35))
    for (const v of [c.costoTotal, c.precio, c.utilidad, c.margenPct ?? '0']) {
      expect(v).toMatch(/^-?\d+(\.\d+)?$/)
    }
  })
})
