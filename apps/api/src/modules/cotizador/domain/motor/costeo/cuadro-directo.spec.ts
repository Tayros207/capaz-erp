import { describe, expect, it } from 'vitest'
import { configuracionEsPE } from '../base/semilla-es-pe.js'
import type { ConfiguracionEmpresa } from '../base/empresa.js'
import { cuadroDeCotizacionDelCasoDeReferencia, lineasDelCasoDeReferencia } from './pruebas/caso-de-referencia.js'
import { VECTOR_BASE, vectorDe } from './pruebas/caso-base.js'
import type { Cuadro } from './tipos/borrador.js'
import type { Celdas, Columna, Directo, ItemDelCuadro } from './tipos/cuadro-directo.js'
import { calcularCuadro, cuadroEscalable, cuadroInicial, sincronizarFilas } from './cuadro.js'
import { calcularCuadroDirecto, referenciasDelCuadro } from './cuadro-directo.js'
import { generarReferencias } from './generar-referencias.js'

const CONFIG = configuracionEsPE
const VENTA_35 = { pct: '35', base: 'venta' } as const

// El oráculo de estas pruebas es aritmética aparte (en céntimos, con números), no el motor: con costo c y
// utilidad m sobre la venta, el precio es c / (1 − m/100), redondeado a 2 decimales.
/** Un número con N decimales exactos, sin pasar por toFixed (ADR-04): redondea a enteros y pone el punto. */
function conDecimales(n: number, decimales: number): string {
  const entero = Math.round(Math.abs(n) * 10 ** decimales)
  const digitos = String(entero).padStart(decimales + 1, '0')
  return `${n < 0 ? '-' : ''}${digitos.slice(0, -decimales)}.${digitos.slice(-decimales)}`
}
const precioSobreVenta = (costo: number, pct: number) => conDecimales(costo / (1 - pct / 100), 2)
const importe = (n: number) => conDecimales(n, 2)

/** Un cuadro sin filas de detalle (todo se escribe a mano), con la base en 1.000. */
function enBlanco(directo: Partial<Directo> = {}, cambios: Partial<Cuadro> = {}): Cuadro {
  const base = cuadroInicial('en_blanco', VENTA_35)
  return { ...base, ...cambios, directo: { ...base.directo!, ...directo } }
}

const celdas = (c100?: string, c1000?: string, c5000?: string): Celdas => ({
  ...(c100 === undefined ? {} : { '100': c100 }), ...(c1000 === undefined ? {} : { '1000': c1000 }), ...(c5000 === undefined ? {} : { '5000': c5000 }),
})

function calcular(cuadro: Cuadro, config: ConfiguracionEmpresa = CONFIG) {
  const r = calcularCuadroDirecto(cuadro, config)
  if (!r.ok) throw new Error(`No calcula: ${r.error.mensaje}`)
  return r.valor
}

/** El caso de referencia con las cantidades del vector a la base (1.000), como cuadro por partes SIN `directo`. */
function casoConDetalle(cambios: Partial<Cuadro> = {}): Cuadro {
  return {
    ...cuadroDeCotizacionDelCasoDeReferencia,
    trabajo: { ...cuadroDeCotizacionDelCasoDeReferencia.trabajo, cantidad: VECTOR_BASE.cantidad },
    lineas: lineasDelCasoDeReferencia.map((l) => ({ ...l, cantidad: VECTOR_BASE.cantidades[l.id] })),
    ...cambios,
  }
}

const COLUMNAS_DEL_CASO = ['100', '1000', '5000'] as const

describe('solo detalle (un cuadro sin `directo`, como los guardados antes del PRP-007)', () => {
  it('la columna base da el costo y el precio del oráculo, y es la misma cuenta que calcularCuadro', () => {
    const cuadro = casoConDetalle()
    const r = calcular(cuadro)
    expect(r.base).toBe('1000')
    expect(r.columnas['1000'].calculo).toMatchObject({ costoTotal: VECTOR_BASE.costoTotal, precio: VECTOR_BASE.precioSobreVenta35 })
    const exacto = calcularCuadro(cuadro, CONFIG)
    if (!exacto.ok) throw new Error('no calcula')
    expect(r.columnas['1000'].calculo).toEqual(exacto.valor.calculo)
  })

  it.each(COLUMNAS_DEL_CASO)('la columna %s sale igual que generarReferencias (la cuenta de siempre) y es la del oráculo', (c) => {
    const cuadro = casoConDetalle()
    const sinc = sincronizarFilas(cuadro)
    const referencias = generarReferencias(cuadroEscalable(sinc), cuadro.utilidad, CONFIG)
    if (!referencias.ok) throw new Error('no genera')
    const de = referencias.valor.calculos.find((x) => x.cantidad === c)?.calculo
    const columna = calcular(cuadro).columnas[c].calculo
    expect(columna?.precio).toBe(de?.precio)
    expect(columna?.costoTotal).toBe(de?.costoTotal)
    expect(columna?.porFactor).toEqual(de?.porFactor)
    // Y es lo que dice el oráculo independiente del PRP-001 a esa cantidad.
    expect(columna).toMatchObject({ costoTotal: vectorDe(c).costoTotal, precio: vectorDe(c).precioSobreVenta35 })
  })

  it('las filas y los orígenes: cada factor con filas sale «del detalle», los demás «vacía»', () => {
    const r = calcular(casoConDetalle())
    const origenes = Object.fromEntries(r.filas.map((f) => [f.clave, f.celdas['1000'].origen]))
    expect(origenes).toEqual({ material: 'detalle', planchas: 'detalle', impresion: 'detalle', diseno: 'detalle', acabado: 'detalle', indirectos: 'vacia' })
    expect(r.filas.map((f) => f.nombre)).toEqual(['Material', 'Placa', 'Impresión', 'Diseño gráfico', 'Acabado', 'Otros'])
  })

  it('las referencias del cuadro (para Precios) son los tres precios sugeridos del oráculo', () => {
    const r = referenciasDelCuadro(casoConDetalle(), CONFIG)
    if (!r.ok) throw new Error('no genera')
    expect([r.valor.p100, r.valor.p1000, r.valor.p5000]).toEqual(COLUMNAS_DEL_CASO.map((c) => vectorDe(c).precioSobreVenta35))
    expect(r.valor.calculos.map((x) => x.cantidad)).toEqual(['100', '1000', '5000'])
  })
})

describe('todo a mano (sin filas de detalle)', () => {
  const directo = {
    factores: {
      material: { celdas: celdas('25', '250', '1250'), fija: false },
      planchas: { celdas: celdas('40', '40', '40'), fija: true },
      impresion: { celdas: celdas('10', '60', '200'), fija: false },
    },
  }

  it('suma por columna y saca el precio del oráculo; lo no escrito vale cero y se ve como vacío', () => {
    const r = calcular(enBlanco(directo))
    const esperado = { '100': 75, '1000': 350, '5000': 1490 }
    for (const c of COLUMNAS_DEL_CASO) {
      expect(r.columnas[c].calculo).toMatchObject({ costoTotal: importe(esperado[c]), precio: precioSobreVenta(esperado[c], 35), precioAjustadoAMano: false })
      expect(r.columnas[c].completa).toBe(true)
    }
    expect(r.filas.find((f) => f.clave === 'diseno')?.celdas['100']).toEqual({ valor: '0.00', origen: 'vacia', delDetalle: null, motivo: null })
    expect(r.filas.find((f) => f.clave === 'material')?.celdas['1000']).toEqual({ valor: '250.00', origen: 'mano', delDetalle: null, motivo: null })
  })

  it('unitario = precio / cantidad de la columna, utilidad en soles = precio − costo, margen real y semáforo', () => {
    const c = calcular(enBlanco(directo)).columnas['1000'].calculo!
    expect(c.unitario).toBe(conDecimales(350 / 0.65 / 1000, 4))
    expect(c.utilidad).toBe(importe(Number(c.precio) - 350))
    expect(c.margenPct).toBe('35.00')
    expect(c.semaforo).toBe('verde')
  })

  it('el IGV y el total con IGV salen del precio de cada columna; sin impuesto no hay línea de impuesto', () => {
    const r = calcular(enBlanco(directo))
    const precio = Number(precioSobreVenta(350, 35))
    expect(r.columnas['1000'].impuesto).toEqual({ nombre: 'IGV', pct: '18.00', monto: importe(Math.round(precio * 18) / 100) })
    expect(r.columnas['1000'].totalConImpuesto).toBe(importe(precio + Math.round(precio * 18) / 100))
    const sinImpuesto = calcular(enBlanco(directo), { ...CONFIG, impuestoPct: '0' })
    expect(sinImpuesto.columnas['1000'].impuesto).toBeNull()
    expect(sinImpuesto.columnas['1000'].totalConImpuesto).toBe(sinImpuesto.columnas['1000'].calculo?.precio)
  })

  it('un cuadro vacío da todo en cero, completo y sin coherencia que evaluar', () => {
    const r = calcular(enBlanco())
    for (const c of COLUMNAS_DEL_CASO) expect(r.columnas[c].calculo).toMatchObject({ costoTotal: '0.00', precio: '0.00', semaforo: null })
    expect(r.coherencia).toBeNull()
  })
})

describe('ítems adicionales', () => {
  const item = (id: string, nombre: string, factor: ItemDelCuadro['factor'], despuesDe: ItemDelCuadro['despuesDe'], c: Celdas): ItemDelCuadro =>
    ({ id, nombre, factor, despuesDe, celdas: c, fija: false })

  it('suman a su factor y se pintan tras la fila indicada, en el orden de la lista', () => {
    const items = [
      item('i1', 'Plastificado', 'acabado', 'acabado', celdas('5', '30', '100')),
      item('i2', 'Encolado', 'acabado', 'acabado', celdas('2', '12', '50')),
      item('i3', 'Flete', 'indirectos', 'diseno', celdas('7', '7', '7')),
    ]
    const r = calcular(enBlanco({ items, factores: { acabado: { celdas: celdas('10', '10', '10'), fija: false } } }))
    expect(r.filas.map((f) => f.clave)).toEqual(['material', 'planchas', 'impresion', 'diseno', 'i3', 'acabado', 'i1', 'i2', 'indirectos'])
    // Acabado = su fila (10) + Plastificado + Encolado; Otros = Flete (suma a «indirectos» aunque se pinte tras Diseño).
    expect(r.columnas['1000'].calculo?.porFactor).toMatchObject({ acabado: '52.00', indirectos: '7.00' })
    expect(r.columnas['1000'].calculo?.costoTotal).toBe('59.00')
    expect(r.columnas['100'].calculo?.costoTotal).toBe(importe(10 + 5 + 2 + 7))
  })
})

describe('utilidad por columna', () => {
  it('cada columna usa la suya y, si no la tiene, la general; con su equivalente en la otra base', () => {
    const directo = { factores: { material: { celdas: celdas('100', '100', '100'), fija: false } }, utilidadPct: { '5000': '20' } }
    const r = calcular(enBlanco(directo, { utilidad: { pct: '30', base: 'venta' } }))
    expect(r.columnas['100'].calculo?.precio).toBe(precioSobreVenta(100, 30))
    expect(r.columnas['5000'].calculo?.precio).toBe(precioSobreVenta(100, 20))
    expect(r.columnas['100'].utilidad).toEqual({ pct: '30', deColumna: false, base: 'venta', equivalentePct: '42.86' })
    expect(r.columnas['5000'].utilidad).toEqual({ pct: '20', deColumna: true, base: 'venta', equivalentePct: '25.00' })
  })

  it('sobre el costo: precio = costo × (1 + %), y el equivalente sobre la venta es menor', () => {
    const directo = { factores: { material: { celdas: celdas('100', '100', '100'), fija: false } } }
    const r = calcular(enBlanco(directo, { utilidad: { pct: '30', base: 'costo' } }))
    expect(r.columnas['1000'].calculo?.precio).toBe('130.00')
    expect(r.columnas['1000'].utilidad.equivalentePct).toBe('23.08')
  })

  it('una utilidad imposible en una columna (100 % sobre la venta) hace fallar el cálculo con su motivo', () => {
    const r = calcularCuadroDirecto(enBlanco({ utilidadPct: { '100': '100' } }), CONFIG)
    expect(!r.ok && r.error.codigo).toBe('utilidad_imposible')
  })
})

describe('el detalle y lo escrito a mano conviven', () => {
  it('lo escrito a mano manda sobre el detalle en esa celda y deja a la vista lo que daba el detalle', () => {
    const cuadro = casoConDetalle({ directo: { ...enBlanco().directo!, factores: { acabado: { celdas: celdas(undefined, '999'), fija: false } } } })
    const r = calcular(cuadro)
    const acabado = r.filas.find((f) => f.clave === 'acabado')!
    expect(acabado.celdas['1000']).toEqual({ valor: '999.00', origen: 'mano', delDetalle: importe(Number(VECTOR_BASE.subtotales.l5) + Number(VECTOR_BASE.subtotales.l6)), motivo: null })
    expect(acabado.celdas['100'].origen).toBe('detalle')
    expect(r.columnas['1000'].calculo?.costoTotal).toBe(importe(Number(VECTOR_BASE.costoTotal) - Number(VECTOR_BASE.subtotales.l5) - Number(VECTOR_BASE.subtotales.l6) + 999))
  })

  it('un detalle que no se puede calcular deja incompleta SOLO esa columna, sin tocar lo escrito a mano', () => {
    // Volantes sin imposición: lo escrito a mano cubre todo menos Acabado, que sí tiene una fila de detalle por pliego. La base se calcula con lo anotado; 100 y 5.000 no se pueden escalar.
    const base = cuadroInicial('volantes', VENTA_35)
    const manual = { celdas: celdas('50', '50', '50'), fija: false }
    const cuadro = { ...base, directo: { ...base.directo!, factores: { material: manual, planchas: manual, impresion: manual, diseno: manual } } }
    const r = calcular(cuadro)
    expect(r.columnas['1000']).toMatchObject({ completa: true, motivo: null })
    expect(r.columnas['100']).toMatchObject({ completa: false, calculo: null, impuesto: null, totalConImpuesto: null })
    expect(r.columnas['100'].motivo).toContain('escala por pliego')
    expect(r.codigos['100']).toBe('imposicion_requerida')
    // Lo escrito a mano de la columna incompleta sigue ahí.
    expect(r.filas.find((f) => f.clave === 'material')?.celdas['100']).toMatchObject({ valor: '50.00', origen: 'mano' })
    expect(r.filas.find((f) => f.clave === 'acabado')?.celdas['100']).toMatchObject({ valor: null, origen: 'no_calculable' })
    const refs = referenciasDelCuadro(cuadro, CONFIG)
    expect(!refs.ok && refs.error.codigo).toBe('imposicion_requerida')
  })

  it('si en la fila hay algo escrito a mano, las cantidades que su detalle no puede calcular se deducen de eso y la columna se completa', () => {
    const base = cuadroInicial('volantes', VENTA_35)
    const manual = { celdas: celdas('50', '50', '50'), fija: false }
    const soloBase = { celdas: { '1000': '10' }, fija: false }
    const cuadro = { ...base, directo: { ...base.directo!, factores: { material: manual, planchas: manual, impresion: manual, diseno: manual, acabado: soloBase } } }
    const r = calcular(cuadro)
    const acabado = r.filas.find((f) => f.clave === 'acabado')!
    expect(acabado.celdas['100']).toMatchObject({ valor: '1.00', origen: 'deducida', desde: '1000' })
    expect(acabado.celdas['5000']).toMatchObject({ valor: '50.00', origen: 'deducida', desde: '1000' })
    for (const c of COLUMNAS_DEL_CASO) expect(r.columnas[c]).toMatchObject({ completa: true })
  })

  it('con el papel ligado a la imposición y sin ella, el material del detalle no se calcula, pero el escrito a mano sí', () => {
    const base = cuadroInicial('volantes', VENTA_35)
    const r = calcular(base)
    expect(r.filas.find((f) => f.clave === 'material')?.celdas['1000']).toMatchObject({ origen: 'no_calculable', valor: null })
    expect(r.columnas['1000']).toMatchObject({ completa: false })
    expect(r.filas.find((f) => f.clave === 'material')?.celdas['1000'].motivo).toContain('El papel aún no está calculado')
  })
})

describe('el precio final a mano y la base', () => {
  it('rige solo en la columna base; las demás siguen con su precio sugerido', () => {
    const directo = { factores: { material: { celdas: celdas('100', '100', '100'), fija: false } } }
    const r = calcular(enBlanco(directo, { precioFinal: '90.00' }))
    expect(r.columnas['1000'].calculo).toMatchObject({ precio: '90.00', precioAjustadoAMano: true, precioSugerido: precioSobreVenta(100, 35) })
    expect(r.columnas['100'].calculo).toMatchObject({ precio: precioSobreVenta(100, 35), precioAjustadoAMano: false })
  })

  it('con una cantidad que no es columna no hay base, y ninguna columna es la base', () => {
    const r = calcular(casoConDetalle({ trabajo: { ...casoConDetalle().trabajo, cantidad: '2500' } }))
    expect(r.base).toBeNull()
    for (const c of COLUMNAS_DEL_CASO) expect(r.columnas[c].esBase).toBe(false)
  })

  it('qué columnas se envían: las de `enviar`', () => {
    const base = enBlanco({ enviar: ['1000', '5000'] })
    const r = calcular(base)
    expect(COLUMNAS_DEL_CASO.map((c: Columna) => r.columnas[c].seEnvia)).toEqual([false, true, true])
  })
})

describe('coherencia entre columnas (invariantes A y B del PRP-001)', () => {
  const con = (a: string, b: string, c: string) => calcular(enBlanco({ factores: { material: { celdas: celdas(a, b, c), fija: false } } }))

  it('totales que crecen con la cantidad y unitario que baja: sin hallazgos', () => {
    expect(con('100', '500', '2000').coherencia).toEqual({ bloqueos: [], avisos: [] })
  })

  it('un total que no crece con la cantidad bloquea (B)', () => {
    expect(con('100', '90', '2000').coherencia?.bloqueos.map((h) => h.codigo)).toEqual(['total_no_crece'])
  })

  it('un unitario que sube con la cantidad avisa (A)', () => {
    const r = con('100', '1500', '2000')
    expect(r.coherencia?.bloqueos).toEqual([])
    expect(r.coherencia?.avisos.map((h) => h.codigo)).toContain('unitario_no_baja')
  })

  it('con una columna sin precio no hay nada que evaluar', () => {
    expect(con('100', '500', '0').coherencia).toBeNull()
  })
})
