import { describe, expect, it } from 'vitest'
import { configuracionEsPE } from '../base/semilla-es-pe.js'
import { FACTORES } from '../base/dominio.js'
import {
  cuadroDeCotizacionDelCasoDeReferencia as referencia,
  lineasDelCasoDeReferencia,
  umbralesPorDefecto,
} from './pruebas/caso-de-referencia.js'
import { vectoresDeEscalado } from './pruebas/vectores-de-escalado.js'
import { COLUMNA_BASE_POR_DEFECTO, directoSchema } from './tipos/cuadro-directo.js'
import type { Cuadro } from './tipos/borrador.js'
import { generarReferencias } from './generar-referencias.js'
import {
  calcularCuadro,
  cuadroEscalable,
  cuadroInicial,
  entradaDeImposicionDe,
  sincronizarFilas,
} from './cuadro.js'

const SOBRE_VENTA_35 = { pct: '35', base: 'venta' } as const

function con(cambios: Partial<Cuadro>): Cuadro {
  return { ...referencia, ...cambios }
}

const cantidadDe = (c: Cuadro, id: string) => c.lineas.find((l) => l.id === id)?.cantidad

describe('cuadroInicial', () => {
  it('en blanco: sin filas, con la utilidad de la empresa y todo por fijar', () => {
    const c = cuadroInicial('en_blanco', SOBRE_VENTA_35)
    expect(c.lineas).toEqual([])
    expect(c.utilidad).toEqual(SOBRE_VENTA_35)
    expect(c.automaticas).toEqual({ papel: null, planchas: null })
    expect(c.trabajo).toMatchObject({ cantidad: COLUMNA_BASE_POR_DEFECTO, pieza: null, tintas: 0, caras: 1 })
    expect(c.siguienteLinea).toBe(1)
  })

  it('trae el cuadro directo vacío: base 1.000, Placa y Diseño fijas, y solo la base entre las que se envían', () => {
    expect(cuadroInicial('en_blanco', SOBRE_VENTA_35).directo).toEqual({
      factores: { planchas: { celdas: {}, fija: true }, diseno: { celdas: {}, fija: true } },
      items: [], utilidadPct: {}, enviar: ['1000'], siguienteItem: 1,
    })
  })

  it('copia los ítems activos de la empresa con ids propios de la cotización, y deja fuera los inactivos', () => {
    const items = [
      { id: 'u-1', nombre: 'Plastificado', factor: 'acabado', despuesDe: 'acabado', fija: false, activo: true },
      { id: 'u-2', nombre: 'Viejo', factor: 'acabado', despuesDe: 'acabado', fija: false, activo: false },
      { id: 'u-3', nombre: 'Flete', factor: 'indirectos', despuesDe: 'indirectos', fija: true, activo: true },
    ] as const
    const directo = cuadroInicial('en_blanco', SOBRE_VENTA_35, items).directo
    expect(directo?.items).toEqual([
      { id: 'i1', nombre: 'Plastificado', factor: 'acabado', despuesDe: 'acabado', celdas: {}, fija: false },
      { id: 'i2', nombre: 'Flete', factor: 'indirectos', despuesDe: 'indirectos', celdas: {}, fija: true },
    ])
    expect(directo?.siguienteItem).toBe(3)
    expect(directoSchema.safeParse(directo).success).toBe(true)
  })

  it('volantes: filas sugeridas con el costo vacío, y el papel y las planchas ligados al motor', () => {
    const c = cuadroInicial('volantes', SOBRE_VENTA_35)
    expect(c.lineas.map((l) => [l.id, l.factor, l.escala, l.costoUnitario])).toEqual([
      ['l1', 'material', 'por_pliego', '0'],
      ['l2', 'planchas', 'fija', '0'],
      ['l3', 'impresion', 'por_pliego', '0'],
      ['l4', 'diseno', 'fija', '0'],
      ['l5', 'acabado', 'por_pliego', '0'],
    ])
    expect(c.automaticas).toEqual({ papel: 'l1', planchas: 'l2' })
    expect(c.siguienteLinea).toBe(6)
  })

  it('las filas de cada plantilla van en el orden de los factores', () => {
    for (const plantilla of ['volantes', 'en_blanco'] as const) {
      const orden = cuadroInicial(plantilla, SOBRE_VENTA_35).lineas.map((l) => FACTORES.indexOf(l.factor))
      expect(orden, plantilla).toEqual([...orden].sort((a, b) => a - b))
    }
  })

  it('cada cuadro es independiente: cambiar uno no altera otro', () => {
    const a = cuadroInicial('volantes', SOBRE_VENTA_35)
    a.lineas[0].descripcion = 'cambiada'
    expect(cuadroInicial('volantes', SOBRE_VENTA_35).lineas[0].descripcion).toBe('Papel')
  })
})

describe('entradaDeImposicionDe: lo que falta, con el nombre con que se dice', () => {
  it('un cuadro nuevo no tiene nada', () => {
    const r = entradaDeImposicionDe(cuadroInicial('en_blanco', SOBRE_VENTA_35))
    expect(r).toEqual({
      faltantes: ['medidas de la pieza', 'pliego madre', 'pliego de máquina', 'sangrado', 'calle', 'pinza'],
    })
  })

  it('el caso de referencia está completo', () => {
    const r = entradaDeImposicionDe(referencia)
    expect('entrada' in r && r.entrada.cantidad).toBe('2500')
  })

  it.each([
    ['pinza', { imposicion: { ...referencia.imposicion, pinzaCm: null } }],
    ['pliego de máquina', { imposicion: { ...referencia.imposicion, pliegoMaquina: null } }],
    ['medidas de la pieza', { trabajo: { ...referencia.trabajo, pieza: null } }],
    ['cantidad del trabajo', { trabajo: { ...referencia.trabajo, cantidad: '0' } }],
  ])('si falta solo «%s», dice solo eso', (nombre, cambios) => {
    expect(entradaDeImposicionDe(con(cambios as Partial<Cuadro>))).toEqual({ faltantes: [nombre] })
  })

  it('el formato máximo es opcional y, si está, viaja', () => {
    const conMaquina = con({ imposicion: { ...referencia.imposicion, formatoMaximo: { anchoCm: '36', altoCm: '52' } } })
    const r = entradaDeImposicionDe(conMaquina)
    expect('entrada' in r && r.entrada.imposicion.formatoMaximo).toEqual({ anchoCm: '36', altoCm: '52' })
  })
})

describe('sincronizarFilas', () => {
  it('el papel sigue a la imposición: 172 pliegos madre en el caso de referencia', () => {
    const s = sincronizarFilas(con({ lineas: lineasDelCasoDeReferencia.map((l) => (l.id === 'l1' ? { ...l, cantidad: '0' } : l)) }))
    expect(cantidadDe(s.cuadro, 'l1')).toBe('172')
    expect(s.imposicion).toMatchObject({ poses: '4', pliegosNetos: '625', pliegosDeMaquina: '685', pliegosMadre: '172' })
    expect(s.faltantes).toEqual([])
    expect(s.problema).toBeNull()
  })

  it('las planchas siguen a tintas × caras', () => {
    for (const [tintas, caras, esperado] of [[4, 2, '8'], [4, 1, '4'], [1, 1, '1'], [0, 1, '0'], [6, 2, '12']] as const) {
      const s = sincronizarFilas(con({ trabajo: { ...referencia.trabajo, tintas, caras } }))
      expect(cantidadDe(s.cuadro, 'l2'), `${tintas}/${caras}`).toBe(esperado)
    }
  })

  it('una fila corregida a mano (fuera de `automaticas`) no se toca', () => {
    const c = con({ automaticas: { papel: null, planchas: null }, lineas: lineasDelCasoDeReferencia.map((l) => (l.id === 'l1' || l.id === 'l2' ? { ...l, cantidad: '99' } : l)) })
    const s = sincronizarFilas(c)
    expect([cantidadDe(s.cuadro, 'l1'), cantidadDe(s.cuadro, 'l2')]).toEqual(['99', '99'])
    expect(s.imposicion?.pliegosMadre).toBe('172') // la imposición se calcula igual, solo no toca la fila
  })

  it('las demás filas nunca se tocan', () => {
    const s = sincronizarFilas(referencia)
    for (const id of ['l3', 'l4', 'l5', 'l6']) {
      expect(s.cuadro.lineas.find((l) => l.id === id)).toEqual(referencia.lineas.find((l) => l.id === id))
    }
  })

  it('con datos incompletos deja el papel como está y dice qué falta', () => {
    const c = con({ imposicion: { ...referencia.imposicion, pinzaCm: null, pliegoMaquina: null } })
    const s = sincronizarFilas(c)
    expect(s.imposicion).toBeNull()
    expect(s.faltantes).toEqual(['pliego de máquina', 'pinza'])
    expect(cantidadDe(s.cuadro, 'l1')).toBe('172')
  })

  it('si la imposición no se puede calcular, lo dice y no toca el papel', () => {
    const grande = con({ trabajo: { ...referencia.trabajo, pieza: { anchoCm: '60', altoCm: '90' } } })
    const s = sincronizarFilas(grande)
    expect(s.problema?.codigo).toBe('pieza_no_cabe')
    expect(s.faltantes).toEqual([])
    expect(cantidadDe(s.cuadro, 'l1')).toBe('172')
  })

  it('es idempotente y no modifica el cuadro recibido', () => {
    const copia = JSON.parse(JSON.stringify(referencia))
    const una = sincronizarFilas(referencia)
    expect(sincronizarFilas(una.cuadro).cuadro).toEqual(una.cuadro)
    expect(referencia).toEqual(copia)
  })

  it('a otra cantidad, el papel sigue a la imposición de esa cantidad (vectores del oráculo)', () => {
    for (const v of vectoresDeEscalado) {
      const s = sincronizarFilas(con({ trabajo: { ...referencia.trabajo, cantidad: v.cantidad } }))
      expect(cantidadDe(s.cuadro, 'l1'), v.cantidad).toBe(v.pliegosMadre)
    }
  })
})

describe('calcularCuadro', () => {
  it('caso de referencia: costo 225.15, precio 346.38 y margen 35.00 % en verde', () => {
    const r = calcularCuadro(referencia, configuracionEsPE)
    expect(r.ok && r.valor.calculo).toMatchObject({
      costoTotal: '225.15', precio: '346.38', utilidad: '121.23', unitario: '0.1386', margenPct: '35.00', semaforo: 'verde',
    })
  })

  it('con el papel desactualizado, el cálculo usa el papel recalculado por el motor', () => {
    const viejo = con({ lineas: lineasDelCasoDeReferencia.map((l) => (l.id === 'l1' ? { ...l, cantidad: '0' } : l)) })
    const r = calcularCuadro(viejo, configuracionEsPE)
    expect(r.ok && r.valor.calculo.costoTotal).toBe('225.15')
    expect(r.ok && r.valor.calculo.porFactor.material).toBe('77.40')
  })

  it('otra empresa, con recargo de 35 % sobre el costo: 303.95, 25.93 % en ámbar', () => {
    const r = calcularCuadro(con({ utilidad: { pct: '35', base: 'costo' } }), configuracionEsPE)
    expect(r.ok && r.valor.calculo).toMatchObject({ precio: '303.95', margenPct: '25.93', semaforo: 'ambar' })
  })

  it('otra empresa, con umbrales 20 / 10, el mismo 25.93 % sale en verde', () => {
    const otra = { ...configuracionEsPE, umbralVerdePct: '20', umbralMinimoPct: '10' }
    const r = calcularCuadro(con({ utilidad: { pct: '35', base: 'costo' } }), otra)
    expect(r.ok && r.valor.calculo.semaforo).toBe('verde')
  })

  it('un precio final a mano rige sobre el sugerido', () => {
    const r = calcularCuadro(con({ precioFinal: '300.00' }), configuracionEsPE)
    expect(r.ok && r.valor.calculo).toMatchObject({ precio: '300.00', precioSugerido: '346.38', precioAjustadoAMano: true })
  })

  it('un cuadro vacío da precio 0.00 y nada más, sin fallar', () => {
    const r = calcularCuadro(cuadroInicial('en_blanco', SOBRE_VENTA_35), configuracionEsPE)
    expect(r.ok && r.valor.calculo).toMatchObject({ costoTotal: '0.00', precio: '0.00', margenPct: null, unitario: null, semaforo: null })
  })

  it('una utilidad imposible (100 % sobre la venta) se devuelve como fallo', () => {
    const r = calcularCuadro(con({ utilidad: { pct: '100', base: 'venta' } }), configuracionEsPE)
    expect(r).toMatchObject({ ok: false, error: { codigo: 'utilidad_imposible' } })
  })

  it('acepta la configuración completa de la empresa como parámetro del costeo', () => {
    expect(calcularCuadro(referencia, umbralesPorDefecto).ok).toBe(true)
  })
})

describe('cuadroEscalable y las tres referencias', () => {
  it('con la imposición completa lleva el papel; sin ella, no', () => {
    expect(cuadroEscalable(sincronizarFilas(referencia)).papel).toMatchObject({ lineaDePapelId: 'l1' })
    const incompleto = con({ imposicion: { ...referencia.imposicion, pinzaCm: null } })
    expect(cuadroEscalable(sincronizarFilas(incompleto)).papel).toBeUndefined()
  })

  it('el cuadro del caso de referencia genera 144.86 / 220.34 / 555.83', () => {
    const g = generarReferencias(cuadroEscalable(sincronizarFilas(referencia)), SOBRE_VENTA_35, umbralesPorDefecto)
    expect(g.ok && [g.valor.p100, g.valor.p1000, g.valor.p5000]).toEqual(['144.86', '220.34', '555.83'])
  })
})
