/**
 * RED DE SEGURIDAD — clasificacion contable local.
 *
 * Esta funcion decide en que cajon cae cada sol. Un fallo aqui no rompe la
 * app: la deja mintiendo en los reportes, que es peor. Por eso cada categoria
 * se prueba con frases dictadas tal como las diria el dueño de la imprenta
 * (con tildes, con muletillas y con el monto en medio), y no con las palabras
 * clave sueltas.
 */

import { describe, expect, test } from 'vitest'
import { inferirCategoria, sugerirPorHistorial } from './categoria.js'

describe('inferirCategoria — egresos', () => {
  test('materia_prima: lo que entra al almacen de papel', () => {
    expect(inferirCategoria('compré cartulina 350 soles a Pacheco', 'egreso')).toBe('materia_prima')
    expect(inferirCategoria('egreso 800, 20 pliegos de couché', 'egreso')).toBe('materia_prima')
    expect(inferirCategoria('pagué 1200 por dos millares de papel bond', 'egreso')).toBe(
      'materia_prima'
    )
    expect(inferirCategoria('me trajeron folcote por 460 soles', 'egreso')).toBe('materia_prima')
  })

  test('insumos: lo que se consume imprimiendo', () => {
    expect(inferirCategoria('compré tinta negra 45.50', 'egreso')).toBe('insumos')
    expect(inferirCategoria('egreso 320 soles en planchas', 'egreso')).toBe('insumos')
    expect(inferirCategoria('pagué 80 soles de alcohol isopropílico', 'egreso')).toBe('insumos')
  })

  test('acabados_terceros: el acabado que PAGAS a otro taller', () => {
    expect(inferirCategoria('pagué 200 al plastificado de las tarjetas', 'egreso')).toBe(
      'acabados_terceros'
    )
    expect(inferirCategoria('egreso 150 troquelado con Rojas', 'egreso')).toBe('acabados_terceros')
    expect(inferirCategoria('mandé el empastado de 20 libros, 180 soles', 'egreso')).toBe(
      'acabados_terceros'
    )
  })

  test('mano_obra', () => {
    expect(inferirCategoria('pagué el sueldo del operario 1500', 'egreso')).toBe('mano_obra')
    expect(inferirCategoria('egreso 300 soles destajo de Manuel', 'egreso')).toBe('mano_obra')
    expect(inferirCategoria('pago al personal 900 soles', 'egreso')).toBe('mano_obra')
    // Pagarle al diseñador es mano de obra; "diseno" es lo que se COBRA.
    expect(inferirCategoria('pagué 500 al diseñador', 'egreso')).toBe('mano_obra')
  })

  test('maquinaria', () => {
    expect(inferirCategoria('compré un repuesto para la guillotina 450', 'egreso')).toBe('maquinaria')
    expect(inferirCategoria('pagué 250 al técnico que revisó la offset', 'egreso')).toBe('maquinaria')
    expect(inferirCategoria('mantenimiento de la máquina 600 soles', 'egreso')).toBe('maquinaria')
    expect(inferirCategoria('cambié los rodillos, 380', 'egreso')).toBe('maquinaria')
  })

  test('servicios', () => {
    expect(inferirCategoria('pagué el recibo de luz 180 soles', 'egreso')).toBe('servicios')
    expect(inferirCategoria('egreso 120 de internet', 'egreso')).toBe('servicios')
    expect(inferirCategoria('pagué el agua 60 soles', 'egreso')).toBe('servicios')
  })

  test('local', () => {
    expect(inferirCategoria('pagué el alquiler del local 1200', 'egreso')).toBe('local')
    expect(inferirCategoria('egreso 300 soles de arbitrios', 'egreso')).toBe('local')
  })

  test('transporte', () => {
    expect(inferirCategoria('pagué 30 de movilidad', 'egreso')).toBe('transporte')
    expect(inferirCategoria('egreso 25 soles en taxi al centro', 'egreso')).toBe('transporte')
    expect(inferirCategoria('gasté 90 de gasolina', 'egreso')).toBe('transporte')
  })

  test('impuestos', () => {
    expect(inferirCategoria('pagué 500 a la SUNAT', 'egreso')).toBe('impuestos')
    expect(inferirCategoria('egreso 320 de IGV del mes', 'egreso')).toBe('impuestos')
    expect(inferirCategoria('me llegó una multa de 200 soles', 'egreso')).toBe('impuestos')
    expect(inferirCategoria('pagué el impuesto a la renta 900', 'egreso')).toBe('impuestos')
  })
})

describe('inferirCategoria — ingresos', () => {
  test('impresion_offset', () => {
    expect(inferirCategoria('ingreso 640, un millar de volantes', 'ingreso')).toBe('impresion_offset')
    expect(inferirCategoria('cobré 1200 por 5 millares de afiches', 'ingreso')).toBe(
      'impresion_offset'
    )
    expect(inferirCategoria('vendí 300 revistas a la parroquia', 'ingreso')).toBe('impresion_offset')
  })

  test('impresion_digital', () => {
    expect(inferirCategoria('ingreso 180 por 500 tarjetas de presentación', 'ingreso')).toBe(
      'impresion_digital'
    )
    expect(inferirCategoria('cobré 90 por un tiraje corto', 'ingreso')).toBe('impresion_digital')
    expect(inferirCategoria('vendí 100 tarjetas a Cristina, 60 soles', 'ingreso')).toBe(
      'impresion_digital'
    )
  })

  test('gran_formato', () => {
    expect(inferirCategoria('ingreso 450 por una gigantografía', 'ingreso')).toBe('gran_formato')
    expect(inferirCategoria('cobré 200 por un banner de dos metros', 'ingreso')).toBe('gran_formato')
    expect(inferirCategoria('vendí un roll up en 350 soles', 'ingreso')).toBe('gran_formato')
  })

  test('acabados: el acabado que COBRAS', () => {
    expect(inferirCategoria('ingreso 80 por el anillado de 20 tesis', 'ingreso')).toBe('acabados')
    expect(inferirCategoria('cobré 150 por empastados', 'ingreso')).toBe('acabados')
  })

  test('diseno', () => {
    expect(inferirCategoria('ingreso 300 por el diseño del logo', 'ingreso')).toBe('diseno')
    expect(inferirCategoria('cobré 250 por la diagramación de la revista', 'ingreso')).toBe('diseno')
    expect(inferirCategoria('ingreso 120, arte final para el cliente', 'ingreso')).toBe('diseno')
  })
})

describe('inferirCategoria — desempate por coincidencia mas larga', () => {
  test('la frase mas especifica le gana a la palabra suelta', () => {
    // "mantenimiento" solo seria maquinaria; "del taller" lo manda a local.
    expect(inferirCategoria('mantenimiento del taller 200 soles', 'egreso')).toBe('local')
    expect(inferirCategoria('mantenimiento de la impresora 200 soles', 'egreso')).toBe('maquinaria')

    // "alquiler" solo seria local; alquilar la maquina no es alquilar el sitio.
    expect(inferirCategoria('alquiler de máquina 800 soles', 'egreso')).toBe('maquinaria')
    expect(inferirCategoria('alquiler 800 soles', 'egreso')).toBe('local')

    // El catalogo pone los arbitrios municipales entre los impuestos.
    expect(inferirCategoria('pagué los arbitrios municipales 150', 'egreso')).toBe('impuestos')

    // Lo que se paga es el traslado, no el material trasladado.
    expect(inferirCategoria('pagué 40 de flete de la cartulina', 'egreso')).toBe('transporte')

    // Los volantes salen en offset aunque el dictado diga "full color", que
    // suelto seria impresion digital.
    expect(inferirCategoria('cobré 700 por un millar de volantes full color', 'ingreso')).toBe(
      'impresion_offset'
    )
    expect(inferirCategoria('ingreso 250, 1000 volantes full color', 'ingreso')).toBe(
      'impresion_offset'
    )
    expect(inferirCategoria('cobré 90 por un tiraje corto full color', 'ingreso')).toBe(
      'impresion_digital'
    )
  })

  test('lo dictado tras "para" es el motivo, no lo que se compro', () => {
    expect(inferirCategoria('compré tinta para la offset', 'egreso')).toBe('insumos')
    expect(inferirCategoria('gasté 1200 en planchas para la máquina', 'egreso')).toBe('insumos')
    expect(inferirCategoria('pagué 30 de movilidad para traer el papel', 'egreso')).toBe('transporte')

    // Si la clausula principal no dice nada, se reintenta con la frase entera.
    expect(inferirCategoria('pagué 100 para el alquiler', 'egreso')).toBe('local')
  })
})

describe('inferirCategoria — el tipo manda', () => {
  test('la misma palabra cambia de categoria segun entre o salga plata', () => {
    expect(inferirCategoria('plastificado de 500 volantes', 'egreso')).toBe('acabados_terceros')
    expect(inferirCategoria('plastificado de 500 volantes', 'ingreso')).toBe('acabados')
    expect(inferirCategoria('anillado de 20 tesis', 'egreso')).toBe('acabados_terceros')
    expect(inferirCategoria('anillado de 20 tesis', 'ingreso')).toBe('acabados')
  })

  test('nunca devuelve una categoria del tipo contrario', () => {
    // Vocabulario de compra pedido como ingreso: mejor nada que un ingreso
    // fantasma en "impresion offset".
    expect(inferirCategoria('compré cartulina 350 soles', 'ingreso')).toBeNull()
    expect(inferirCategoria('pagué el recibo de luz 180', 'ingreso')).toBeNull()

    // Vocabulario de venta pedido como egreso.
    expect(inferirCategoria('vendí un millar de volantes', 'egreso')).toBeNull()
    expect(inferirCategoria('cobré 450 por una gigantografía', 'egreso')).toBeNull()
  })
})

describe('inferirCategoria — casos limite', () => {
  test('texto vacio o en blanco', () => {
    expect(inferirCategoria('', 'egreso')).toBeNull()
    expect(inferirCategoria('   ', 'ingreso')).toBeNull()
  })

  test('sin vocabulario de imprenta devuelve null, no "otros"', () => {
    expect(inferirCategoria('hola qué tal', 'egreso')).toBeNull()
    expect(inferirCategoria('anota un movimiento de 50 soles', 'ingreso')).toBeNull()
    expect(inferirCategoria('egreso 200 soles, proveedor Pacheco', 'egreso')).toBeNull()
  })

  test('insensible a tildes y a mayusculas', () => {
    expect(inferirCategoria('DISEÑO DE LOGO', 'ingreso')).toBe('diseno')
    expect(inferirCategoria('Compré Couché', 'egreso')).toBe('materia_prima')
    expect(inferirCategoria('GIGANTOGRAFÍA para la bodega', 'ingreso')).toBe('gran_formato')
  })

  test('es una funcion pura: el mismo texto da siempre lo mismo', () => {
    // Los regex se comparten entre llamadas; si alguno llevara /g, el
    // lastIndex haria que la segunda vez fallara.
    const frase = 'compré cartulina y tinta 350 soles'
    expect(inferirCategoria(frase, 'egreso')).toBe(inferirCategoria(frase, 'egreso'))
    expect(inferirCategoria(frase, 'egreso')).toBe('materia_prima')
  })
})

describe('sugerirPorHistorial', () => {
  test('sugiere la dominante cuando pasa el 60%', () => {
    expect(
      sugerirPorHistorial([
        { categoria: 'materia_prima', veces: 8 },
        { categoria: 'insumos', veces: 2 },
      ])
    ).toBe('materia_prima')

    // 3 de 5 = 60% exacto: el umbral es inclusivo.
    expect(
      sugerirPorHistorial([
        { categoria: 'materia_prima', veces: 3 },
        { categoria: 'insumos', veces: 2 },
      ])
    ).toBe('materia_prima')
  })

  test('no opina con un solo registro: eso es anecdota, no habito', () => {
    expect(sugerirPorHistorial([{ categoria: 'materia_prima', veces: 1 }])).toBeNull()
    expect(sugerirPorHistorial([])).toBeNull()
  })

  test('sin mayoria clara devuelve null', () => {
    expect(
      sugerirPorHistorial([
        { categoria: 'materia_prima', veces: 5 },
        { categoria: 'insumos', veces: 4 },
        { categoria: 'transporte', veces: 1 },
      ])
    ).toBeNull()

    // Empate: no hay dominante aunque la fraccion diera el ancho.
    expect(
      sugerirPorHistorial([
        { categoria: 'materia_prima', veces: 3 },
        { categoria: 'insumos', veces: 3 },
      ])
    ).toBeNull()
  })

  test('ignora categorias fuera del catalogo y conteos no positivos', () => {
    // "sin_categoria" es marcador de UI y "papel" no existe: no cuentan ni
    // siquiera para el total.
    expect(
      sugerirPorHistorial([
        { categoria: 'sin_categoria', veces: 9 },
        { categoria: 'papel', veces: 4 },
        { categoria: 'materia_prima', veces: 2 },
      ])
    ).toBe('materia_prima')

    expect(
      sugerirPorHistorial([
        { categoria: 'materia_prima', veces: 2 },
        { categoria: 'insumos', veces: 0 },
        { categoria: 'transporte', veces: -3 },
      ])
    ).toBe('materia_prima')

    expect(sugerirPorHistorial([{ categoria: 'sin_categoria', veces: 20 }])).toBeNull()
  })

  test('suma filas repetidas de la misma categoria', () => {
    expect(
      sugerirPorHistorial([
        { categoria: 'insumos', veces: 1 },
        { categoria: 'insumos', veces: 1 },
        { categoria: 'materia_prima', veces: 1 },
      ])
    ).toBe('insumos')
  })
})
