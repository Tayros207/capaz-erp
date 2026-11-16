/**
 * RED DE SEGURIDAD — enriquecerExtraccion es el ultimo filtro antes de que el
 * usuario vea la tarjeta de confirmacion. Es tambien el unico camino cuando
 * el LLM falla (ver el catch de /api/extract), asi que lo que salga de aqui
 * es literalmente lo que se propone guardar en la contabilidad.
 */

import { describe, expect, test } from 'vitest'
import { enriquecerExtraccion } from './enriquecer.js'
import type { Extraccion } from './extraccion.js'

/** Lo que devuelve el catch de /api/extract cuando el LLM no responde. */
const VACIO: Extraccion = {
  tipo: null,
  monto_centimos: null,
  contacto_nombre: null,
  contacto_tipo: null,
  descripcion: null,
  es_abono: false,
  es_consulta: false,
  es_proforma: false,
  comando: null,
}

const sinLLM = (texto: string) => enriquecerExtraccion(texto, { ...VACIO })

/** Lo mismo, pero con el chip de modo pulsado. */
const conChip = (texto: string, modo: 'ingreso' | 'egreso') =>
  enriquecerExtraccion(texto, { ...VACIO }, { modo })

/** Lo que devolveria el LLM si estuviera respondiendo. */
const conLLM = (texto: string, delModelo: Partial<Extraccion>) =>
  enriquecerExtraccion(texto, { ...VACIO, ...delModelo })

describe('enriquecerExtraccion sin ayuda del LLM', () => {
  test('ingreso simple', () => {
    const r = sinLLM('Ingreso 500 soles, cliente Juan, flyers')
    expect(r.tipo).toBe('ingreso')
    expect(r.monto_centimos).toBe(50000)
    expect(r.contacto_tipo).toBe('cliente')
  })

  test('egreso simple', () => {
    const r = sinLLM('Egreso 200 soles, proveedor Pacheco, cartulina')
    expect(r.tipo).toBe('egreso')
    expect(r.monto_centimos).toBe(20000)
    expect(r.contacto_tipo).toBe('proveedor')
  })

  test('contrato con adelanto conserva total y adelanto por separado', () => {
    const r = sinLLM('Contrato 240, adelanto 100, cliente Cristina')
    expect(r.tipo).toBe('ingreso')
    expect(r.monto_centimos).toBe(24000)
    expect(r.adelanto_centimos).toBe(10000)
    expect(r.contacto_nombre).toBe('Cristina')
    expect(r.es_abono).toBe(false)
  })

  test('el adelanto siempre es menor que el total', () => {
    const r = sinLLM('Contrato 240, adelanto 100, cliente Cristina')
    expect(r.adelanto_centimos!).toBeLessThan(r.monto_centimos!)
  })

  test('abono a deuda: marca es_abono y limpia el adelanto', () => {
    const r = sinLLM('Juan abona 100 soles de su deuda')
    expect(r.es_abono).toBe(true)
    expect(r.monto_centimos).toBe(10000)
    expect(r.contacto_nombre).toBe('Juan')
    expect(r.adelanto_centimos).toBeNull()
  })

  test('respeta lo que ya trajo el LLM', () => {
    const r = enriquecerExtraccion('lo que sea', {
      ...VACIO,
      tipo: 'egreso',
      monto_centimos: 12345,
      contacto_nombre: 'Comercial Pacheco',
    })
    expect(r.tipo).toBe('egreso')
    expect(r.monto_centimos).toBe(12345)
    expect(r.contacto_nombre).toBe('Comercial Pacheco')
  })

  test('los montos siempre son enteros en centimos', () => {
    for (const frase of ['45.50 soles', '0.05 soles', '1200 soles']) {
      const m = sinLLM(frase).monto_centimos
      if (m !== null) expect(Number.isInteger(m)).toBe(true)
    }
  })
})

describe('categoria contable', () => {
  test('infiere la categoria del texto cuando el LLM no la trae', () => {
    expect(sinLLM('Egreso 200 soles, proveedor Pacheco, cartulina').categoria).toBe('materia_prima')
    expect(sinLLM('Egreso 180 soles, recibo de luz').categoria).toBe('servicios')
    expect(sinLLM('Ingreso 500 soles, cliente Juan, millar de volantes').categoria).toBe(
      'impresion_offset'
    )
  })

  test('respeta la categoria del LLM si es coherente con el tipo', () => {
    const r = enriquecerExtraccion('lo que sea', {
      ...VACIO,
      tipo: 'egreso',
      monto_centimos: 5000,
      categoria: 'insumos',
    })
    expect(r.categoria).toBe('insumos')
  })

  test('DESCARTA una categoria de ingreso en un egreso', () => {
    // Si el LLM se equivoca de lado, aceptarlo descuadraria los reportes en
    // silencio. Se descarta y se reintenta con el parser local.
    const r = enriquecerExtraccion('compra de cartulina', {
      ...VACIO,
      tipo: 'egreso',
      monto_centimos: 5000,
      categoria: 'impresion_offset',
    })
    expect(r.categoria).not.toBe('impresion_offset')
    expect(r.categoria).toBe('materia_prima')
  })

  test('sin tipo resuelto no clasifica', () => {
    expect(sinLLM('cartulina folcote').categoria).toBeNull()
  })

  test('sin señal clara deja sin clasificar, no inventa', () => {
    expect(sinLLM('Egreso 100 soles, cosa rara').categoria).toBeNull()
  })

  test('no rompe nada de lo anterior: el resto de campos sigue igual', () => {
    const r = sinLLM('Contrato 240, adelanto 100, cliente Cristina')
    expect(r.monto_centimos).toBe(24000)
    expect(r.adelanto_centimos).toBe(10000)
    expect(r.contacto_nombre).toBe('Cristina')
  })
})

describe('una compra se registra como compra', () => {
  test('"compré ... por N soles" es un EGRESO del proveedor', () => {
    // Eran dos fallos encadenados: inferirTipo no reconocia "compré" por la
    // tilde, y al quedarse sin tipo se forzaba 'ingreso'. Una COMPRA entraba a
    // la contabilidad como VENTA, y el proveedor a la lista de quien te debe.
    const r = sinLLM('compré cartulina folcote 500 pliegos por 350 soles a Comercial Pacheco')
    expect(r.tipo).toBe('egreso')
    expect(r.contacto_tipo).toBe('proveedor')
    expect(r.contacto_nombre).toBe('Comercial Pacheco')
    expect(r.monto_centimos).toBe(35000)
  })

  test('"pagué la luz" es un egreso', () => {
    expect(sinLLM('pagué la luz 180 soles').tipo).toBe('egreso')
  })

  test('el monto en palabras es un monto, no un contacto', () => {
    const r = sinLLM('ingreso de mil quinientos soles')
    expect(r.monto_centimos).toBe(150000)
    expect(r.contacto_nombre).toBeNull()
  })
})

/**
 * El caso que motivo todo esto: el cliente no dicta con formato, habla. Estas
 * ocho frases son las que se probaron a mano y salian mal.
 */
describe('habla natural y desordenada', () => {
  test('reconoce el gasto aunque venga envuelto en muletillas', () => {
    const r = sinLLM('sabes que anótame que le compré a Pacheco unas cartulinas y me salieron 350 soles')
    expect(r.tipo).toBe('egreso')
    expect(r.monto_centimos).toBe(35000)
    expect(r.contacto_nombre).toBe('Pacheco')
    expect(r.categoria).toBe('materia_prima')
  })

  test('reconoce a quien te pago, no al reves', () => {
    const r = sinLLM('mmm a ver, me pagó la señora Rosa 80 soles por los volantes')
    expect(r.tipo).toBe('ingreso')
    expect(r.monto_centimos).toBe(8000)
    expect(r.contacto_nombre).toBe('Rosa')
  })

  test('el tipo equivocado ya no arrastra a la categoria', () => {
    // Salia 'ingreso' por culpa de «apunta», y entonces la categoria se
    // filtraba por el lado de las ventas y «tinta» se quedaba sin clasificar.
    const r = sinLLM('ya pues apunta ahí que gasté en tinta 120 soles')
    expect(r.tipo).toBe('egreso')
    expect(r.categoria).toBe('insumos')
  })

  test('un trabajo con adelanto dictado de corrido', () => {
    const r = sinLLM('oye regístrame que Cristina me quedó debiendo, le hice unas tarjetas de 240 y me adelantó 100')
    expect(r.tipo).toBe('ingreso')
    expect(r.monto_centimos).toBe(24000)
    expect(r.adelanto_centimos).toBe(10000)
    expect(r.contacto_nombre).toBe('Cristina')
  })
})


/**
 * Tocar el chip es decir QUE se esta registrando, con el dedo. Es la unica
 * señal del sistema que no hay que interpretar, asi que gana a todo lo demas.
 */
describe('el chip de modo manda', () => {
  test('una palabra de la descripcion ya no voltea el tipo', () => {
    // «servicio», «trabajo» y «pedido» salen todo el rato al describir un
    // gasto, y antes empataban con «Egreso» — y el empate lo ganaba ingreso.
    expect(conChip('Egreso 200 soles, servicio de luz', 'egreso').tipo).toBe('egreso')
    expect(conChip('Egreso 300, trabajo de plastificado', 'egreso').tipo).toBe('egreso')
    expect(conChip('Egreso 120, pedido de tintas', 'egreso').tipo).toBe('egreso')
  })

  test('gana incluso al verbo de la frase', () => {
    expect(conChip('Ingreso 500, compré las tarjetas', 'ingreso').tipo).toBe('ingreso')
    expect(conChip('Egreso 500, me pagaron', 'egreso').tipo).toBe('egreso')
  })

  test('arrastra el tipo de contacto', () => {
    expect(conChip('Egreso 350, Pacheco, cartulina', 'egreso').contacto_tipo).toBe('proveedor')
    expect(conChip('Ingreso 350, Cristina, tarjetas', 'ingreso').contacto_tipo).toBe('cliente')
  })
})

/**
 * El lector local es el respaldo, no el juez. Antes sustituia la respuesta del
 * modelo en dos campos, y uno de ellos era el mas delicado que hay.
 */
describe('el modelo manda sobre el lector local', () => {
  test('no le pisa el monto ni el adelanto de un contrato', () => {
    const r = conLLM('contrato de 800 soles con adelanto de 300', {
      tipo: 'ingreso',
      monto_centimos: 80000,
      adelanto_centimos: 30000,
    })
    expect(r.monto_centimos).toBe(80000)
    expect(r.adelanto_centimos).toBe(30000)
  })

  test('no le pisa la descripcion corta', () => {
    const r = conLLM('sabes que anótame el millar de volantes de Cristina en 240 soles', {
      tipo: 'ingreso',
      monto_centimos: 24000,
      descripcion: 'millar de volantes',
    })
    expect(r.descripcion).toBe('millar de volantes')
  })

  test('pero descarta un resumen que no resume nada', () => {
    // Si devuelve casi la frase entera no ha resumido: no aporta sobre el
    // texto crudo y se prefiere lo que saque la heuristica local.
    const texto = 'Egreso 350 soles, proveedor Pacheco, cartulina folcote'
    const r = conLLM(texto, { tipo: 'egreso', monto_centimos: 35000, descripcion: texto })
    expect(r.descripcion).not.toBe(texto)
  })
})
