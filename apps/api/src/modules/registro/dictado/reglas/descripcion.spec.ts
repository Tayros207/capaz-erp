/**
 * Lo que salga de aqui es la celda "Trabajo" del Excel que ve el contador.
 * Frases sacadas de los dictados reales del dueño.
 */

import { describe, expect, test } from 'vitest'
import { limpiarNombreDeContacto, formatearNombreDeContacto, inferirDescripcion } from './descripcion.js'

describe('inferirDescripcion deja solo el producto', () => {
  test('quita monto, instruccion y cliente', () => {
    expect(inferirDescripcion('Contrato 8500 soles, cliente Cristian Neira, millar de volantes')).toBe(
      'Millar de volantes'
    )
  })

  test('quita monto, instruccion y proveedor', () => {
    expect(inferirDescripcion('Egreso 350 soles, proveedor Pacheco, cartulina folcote')).toBe(
      'Cartulina folcote'
    )
  })

  test('ingreso con cliente de dos nombres', () => {
    expect(
      inferirDescripcion('Ingreso 1200 soles, cliente Rosa Diaz, tarjetas de presentacion')
    ).toBe('Tarjetas de presentacion')
  })

  test('sin contacto: queda el concepto del gasto', () => {
    expect(inferirDescripcion('Egreso 180 soles, recibo de luz')).toBe('Recibo de luz')
  })

  test('el adelanto tampoco es descripcion', () => {
    expect(inferirDescripcion('Trabajo 240 soles, cliente Cristina, tarjetas, adelanto 100')).toBe(
      'Tarjetas'
    )
  })

  test('dictado sin comas: el nombre en mayusculas marca donde acaba', () => {
    expect(inferirDescripcion('Egreso 350 soles proveedor Pacheco cartulina folcote')).toBe(
      'Cartulina folcote'
    )
  })

  test('"egreso 200 de cartulina" pierde el conector', () => {
    expect(inferirDescripcion('Egreso 200 de cartulina')).toBe('Cartulina')
  })
})

describe('cuando NO hay nada que inferir devuelve null', () => {
  test('un texto que ya es solo la descripcion se respeta tal cual', () => {
    // La cantidad "150" no lleva "soles" ni instruccion delante: es parte del
    // producto, no el importe del movimiento.
    expect(inferirDescripcion('150 PLIEGOS DE COCUHE BRILLO')).toBeNull()
    expect(inferirDescripcion('cartulina folcote')).toBeNull()
    expect(inferirDescripcion('lo que sea')).toBeNull()
  })

  test('texto vacio', () => {
    expect(inferirDescripcion('')).toBeNull()
    expect(inferirDescripcion('   ')).toBeNull()
  })

  test('si al quitar todo no queda nada, no se inventa', () => {
    expect(inferirDescripcion('Egreso 350 soles')).toBeNull()
    expect(inferirDescripcion('Ingreso 500 soles, cliente Juan')).toBeNull()
  })

  test('nunca devuelve un monto como descripcion', () => {
    for (const frase of [
      'compré cartulina folcote 500 pliegos por 350 soles a Comercial Pacheco',
      'haz 1000 volantes por 500 soles',
    ]) {
      const desc = inferirDescripcion(frase)
      if (desc !== null) expect(desc).not.toMatch(/^\s*S?\/?\s*\d+([.,]\d+)?\s*soles?\b/i)
    }
  })
})

describe('la descripcion dictada explicitamente manda', () => {
  test('"la descripcion es X"', () => {
    expect(
      inferirDescripcion(
        'anota un trabajo de 640 para el cliente se llama Cristian Neira y la descripcion es millar de volantes'
      )
    ).toBe('Millar de volantes')
  })

  test('"estoy haciendo X"', () => {
    expect(inferirDescripcion('estoy haciendo 500 tarjetas para Rosa')).toBe('500 tarjetas para Rosa')
  })
})

describe('nombres de contacto', () => {
  test('limpiarNombreDeContacto corta la descripcion pegada', () => {
    expect(limpiarNombreDeContacto('Cristian Neira descripcion millar')).toBe('Cristian Neira')
    expect(limpiarNombreDeContacto('se llama Rosa')).toBe('Rosa')
  })

  test('formatearNombreDeContacto normaliza mayusculas', () => {
    expect(formatearNombreDeContacto('cristian NEIRA')).toBe('Cristian Neira')
    expect(formatearNombreDeContacto('comercial pacheco')).toBe('Comercial Pacheco')
  })
})

/**
 * Habla natural: la frase viene envuelta en muletillas que no describen nada
 * y acababan enteras en la celda «Trabajo» del Excel que lee el contador.
 */
describe('muletillas de quien habla en vez de dictar', () => {
  test('quita la apertura conversacional', () => {
    expect(inferirDescripcion('sabes que anótame cartulina folcote')).toBe('Cartulina folcote')
    expect(inferirDescripcion('ya pues apunta ahí tinta negra')).toBe('Tinta negra')
    expect(inferirDescripcion('oye regístrame el millar de volantes')).toBe('Millar de volantes')
  })

  test('no confunde una descripcion que EMPIEZA por esas palabras', () => {
    // «ya laminado» describe un acabado; no es un «ya pues».
    expect(inferirDescripcion('150 PLIEGOS DE COCUHE BRILLO')).toBeNull()
  })
})

/**
 * LA DESCRIPCION ES SOLO EL TRABAJO.
 *
 * Es lo que el operario lee en el papel que va a la maquina y lo que el
 * contador ve en la celda «Trabajo» del Excel. Hablando de corrido —sin las
 * comas que la voz no pone— se llevaba la frase entera: «crea un nuevo
 * ingreso de un de un millar de volantes 240 soles cliente Cristina».
 */
describe('solo las palabras del trabajo', () => {
  test('quita el verbo con el que se le manda a la app', () => {
    expect(inferirDescripcion('crea un nuevo ingreso de un millar de volantes')).toBe(
      'Millar de volantes'
    )
    expect(inferirDescripcion('haz un nuevo egreso de tinta')).toBe('Tinta')
    expect(inferirDescripcion('quiero registrar un ingreso de tarjetas')).toBe('Tarjetas')
    expect(inferirDescripcion('genera un egreso de cartulina folcote')).toBe('Cartulina folcote')
  })

  test('quita tambien el importe y el cliente de la COLA', () => {
    // Con comas cada tramo llegaba limpio; dictando no hay comas y todo cae
    // en un solo tramo, del que antes solo se limpiaba el principio.
    expect(inferirDescripcion('egreso de un millar de volantes 240 soles')).toBe(
      'Millar de volantes'
    )
    expect(inferirDescripcion('ingreso de tarjetas 240 soles cliente Cristina')).toBe('Tarjetas')
    expect(inferirDescripcion('egreso de cartulina por 350')).toBe('Cartulina')
  })

  test('deshace lo que la voz repite al dudar', () => {
    expect(inferirDescripcion('ingreso de un de un millar de volantes')).toBe('Millar de volantes')
  })

  test('pero respeta una descripcion dictada tal cual', () => {
    // Sin instruccion ni monto en soles no hay nada que quitar, y una
    // cantidad al principio es parte del trabajo, no su precio.
    expect(inferirDescripcion('150 PLIEGOS DE COCUHE BRILLO')).toBeNull()
  })
})

/**
 * HABLARLE COMO A UNA PERSONA.
 *
 * Al dictar se saluda y se pide por favor. Una sola palabra desconocida al
 * principio —«hola»— paraba TODA la limpieza, porque solo se recorta lo
 * conocido y desde el principio: la descripcion se quedaba con la frase
 * entera. Y con «buenos días,» delante era peor, porque la coma lo dejaba en
 * un tramo aparte y la descripcion acababa siendo el saludo.
 */
describe('saludos y cortesias', () => {
  test('el saludo no es la descripcion', () => {
    expect(
      inferirDescripcion('hola registra un nuevo ingreso del cliente juan por un millar de troquel por 290 soles')
    ).toBe('Millar de troquel')
    expect(
      inferirDescripcion('buenos días, anota un egreso del proveedor pacheco por cartulina folcote de 350 soles')
    ).toBe('Cartulina folcote')
    expect(inferirDescripcion('buenas, apunta un egreso de tinta 120 soles')).toBe('Tinta')
  })

  /**
   * «del cliente juan por…»: el nombre en minuscula tiraba el tramo ENTERO a
   * la basura, porque no se sabia donde acababa. Ahora si se sabe.
   */
  test('el nombre en minuscula ya no se lleva el trabajo por delante', () => {
    expect(inferirDescripcion('egreso del proveedor pacheco por cartulina folcote de 350 soles')).toBe(
      'Cartulina folcote'
    )
    expect(inferirDescripcion('ingreso del cliente juan por tarjetas de 240 soles')).toBe('Tarjetas')
  })
})
