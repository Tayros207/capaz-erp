import { describe, expect, it } from 'vitest'
import { juegosDeVectores } from './pruebas/vectores-de-curva.js'
import type { Ajuste, PrecioRapido, VariantePrecio } from './tipos/precio-por-escala.js'
import type { RedondeoComercial } from '../base/empresa.js'
import { precioDeRapida, redondearComercial } from './precio-rapido.js'

const [juego] = juegosDeVectores // 190 / 580 / 1.200, curva: 2.000 → 793.26
const CURVA: VariantePrecio = { ...juego.referencias, modoIntermedio: 'curva' }
const EN_2000 = juego.puntos.find(([q]) => q === '2000')![1]

function precio(v: VariantePrecio, cantidad: string, ajuste: Ajuste): PrecioRapido {
  const r = precioDeRapida(v, cantidad, ajuste)
  if (!r.ok) throw new Error(`No debía fallar: ${r.error.mensaje}`)
  return r.valor
}

describe('precioDeRapida', () => {
  it('sin ajuste, el final es el precio de lista del motor', () => {
    expect(precio(CURVA, '2000', { tipo: 'ninguno' })).toEqual({
      precioLista: EN_2000, precioFinal: EN_2000, unitario: '0.3966', minimoAplicado: false,
    })
  })

  it('un monto sube o baja el final sobre la lista, y la lista no cambia', () => {
    expect(precio(CURVA, '2000', { tipo: 'monto', monto: '100' })).toMatchObject({ precioLista: EN_2000, precioFinal: '893.26', unitario: '0.4466' })
    expect(precio(CURVA, '2000', { tipo: 'monto', monto: '-93.26' })).toMatchObject({ precioLista: EN_2000, precioFinal: '700.00', unitario: '0.3500' })
  })

  it('un precio fijado a mano reemplaza el final, con el unitario que le corresponde', () => {
    expect(precio(CURVA, '2000', { tipo: 'precio', precio: '750' })).toMatchObject({ precioLista: EN_2000, precioFinal: '750.00', unitario: '0.3750' })
  })

  it('en una referencia el precio de lista es el guardado', () => {
    expect(precio(CURVA, '1000', { tipo: 'ninguno' }).precioLista).toBe('580.00')
  })

  it('el mínimo se aplica a la lista, y el ajuste va encima', () => {
    const conMinimo: VariantePrecio = { ...CURVA, precioMinimo: '250' }
    expect(precio(conMinimo, '100', { tipo: 'monto', monto: '10' })).toEqual({
      precioLista: '250.00', precioFinal: '260.00', unitario: '2.6000', minimoAplicado: true,
    })
  })

  it('un final de cero o menos se rechaza', () => {
    for (const ajuste of [
      { tipo: 'monto', monto: `-${EN_2000}` },
      { tipo: 'monto', monto: '-900' },
      { tipo: 'precio', precio: '0' },
    ] as Ajuste[]) {
      const r = precioDeRapida(CURVA, '2000', ajuste)
      expect(!r.ok && r.error.codigo, JSON.stringify(ajuste)).toBe('precio_no_positivo')
    }
  })

  it('fuera de 100 a 5.000 responde como el motor: hay que cotizar aparte', () => {
    for (const cantidad of ['99', '5001']) {
      const r = precioDeRapida(CURVA, cantidad, { tipo: 'monto', monto: '100' })
      expect(!r.ok && r.error.codigo, cantidad).toBe('fuera_de_rango')
    }
  })
})

describe('redondeo comercial (PRP-005)', () => {
  const conRedondeo = (r: RedondeoComercial, ajuste: Ajuste = { tipo: 'ninguno' }) => {
    const p = precioDeRapida(CURVA, '2000', ajuste, r)
    if (!p.ok) throw new Error(p.error.mensaje)
    return p.valor
  }

  it('lleva la lista hacia arriba al múltiplo elegido: 793.26 → 794 / 795 / 800, y «ninguno» no toca nada', () => {
    expect(EN_2000).toBe('793.26')
    expect(conRedondeo('ninguno').precioLista).toBe('793.26')
    expect(conRedondeo('1').precioLista).toBe('794.00')
    expect(conRedondeo('5').precioLista).toBe('795.00')
    expect(conRedondeo('10').precioLista).toBe('800.00')
  })

  it('un total que ya es múltiplo no sube, y 994.37 a 5 queda en 995.00', () => {
    expect(redondearComercial('795.00', '5')).toBe('795.00')
    expect(redondearComercial('795', '5')).toBe('795.00')
    expect(redondearComercial('994.37', '5')).toBe('995.00')
    expect(redondearComercial('994.37', 'ninguno')).toBe('994.37')
  })

  it('el ajuste se suma después del redondeo, y el unitario sale del final', () => {
    expect(conRedondeo('5', { tipo: 'monto', monto: '100' })).toEqual({
      precioLista: '795.00', precioFinal: '895.00', unitario: '0.4475', minimoAplicado: false,
    })
    expect(conRedondeo('5', { tipo: 'precio', precio: '750' })).toMatchObject({ precioLista: '795.00', precioFinal: '750.00' })
  })

  it('con el precio mínimo, el mínimo se redondea también (es parte de la lista)', () => {
    const conMinimo: VariantePrecio = { ...CURVA, precioMinimo: '251.30' }
    const p = precioDeRapida(conMinimo, '100', { tipo: 'ninguno' }, '5')
    expect(p.ok && p.valor).toMatchObject({ precioLista: '255.00', minimoAplicado: true })
  })
})

describe('ajuste por cliente (PRP-006)', () => {
  const con = (cliente: string | null, redondeo: RedondeoComercial = 'ninguno', ajuste: Ajuste = { tipo: 'ninguno' }) => {
    const p = precioDeRapida(CURVA, '2000', ajuste, redondeo, cliente)
    if (!p.ok) throw new Error(p.error.mensaje)
    return p.valor
  }

  it('sin ajuste del cliente no cambia nada y no agrega el campo', () => {
    expect(con(null)).toEqual({ precioLista: '793.26', precioFinal: '793.26', unitario: '0.3966', minimoAplicado: false })
  })

  it('−10 % baja la lista: 793.26 → 713.93 (713.934 al centavo), y lo declara', () => {
    expect(con('-10')).toEqual({ precioLista: '713.93', precioFinal: '713.93', unitario: '0.3570', minimoAplicado: false, ajusteClientePct: '-10' })
    expect(con('5.5').precioLista).toBe('836.89') // 793.26 × 1.055 = 836.8893
  })

  it('el orden es lista → cliente → redondeo → ajuste manual', () => {
    expect(con('-10', '5').precioLista).toBe('715.00') // 713.93 sube a 715
    expect(con('-10', '5', { tipo: 'monto', monto: '100' })).toMatchObject({ precioLista: '715.00', precioFinal: '815.00' })
    expect(con('-10', 'ninguno', { tipo: 'precio', precio: '700' })).toMatchObject({ precioLista: '713.93', precioFinal: '700.00' })
  })
})
