/**
 * RED DE SEGURIDAD — comportamiento capturado del codigo tal como estaba antes
 * de agregar proformas y categorias. Si algo aqui se pone rojo, es que una
 * funcionalidad que ya usaba el piloto se rompio.
 *
 * Los casos marcados como BUG documentan comportamiento incorrecto que YA
 * existia. Se dejan fijados a proposito: cuando se corrijan, el test debe
 * actualizarse de forma deliberada, no por accidente.
 */

import { describe, expect, test } from 'vitest'
import {
  todosLosMontosEnCentimos,
  numeroEnSoles,
  inferirContacto,
  inferirTipo,
  montoACentimos,
  leerContratoConAdelanto,
  centimosComoTexto,
} from './monto.js'

describe('montoACentimos', () => {
  test('cifras simples en soles', () => {
    expect(montoACentimos('Ingreso 500 soles, cliente Juan, flyers')).toBe(50000)
    expect(montoACentimos('Egreso 200 soles, proveedor Pacheco')).toBe(20000)
    expect(montoACentimos('pagué la luz 180 soles')).toBe(18000)
  })

  test('decimales con punto y con coma', () => {
    expect(montoACentimos('egreso 45.50 tinta negra')).toBe(4550)
    expect(montoACentimos('egreso 45,50 tinta negra')).toBe(4550)
  })

  test('nunca usa flotantes: 0.1 + 0.2 no puede aparecer', () => {
    expect(montoACentimos('10.10 soles')).toBe(1010)
    expect(Number.isInteger(montoACentimos('33.33 soles'))).toBe(true)
  })

  test('sin cifra devuelve null', () => {
    expect(montoACentimos('hola que tal')).toBeNull()
    expect(montoACentimos('/hoy')).toBeNull()
  })

  test('lee el monto dicho en palabras dentro de la frase', () => {
    expect(montoACentimos('ingreso de mil quinientos soles')).toBe(150000)
    expect(montoACentimos('me salieron trescientos cincuenta soles')).toBe(35000)
    expect(montoACentimos('cobre ochenta soles por los volantes')).toBe(8000)
    expect(montoACentimos('ciento veinte soles de tinta')).toBe(12000)
  })

  test('no toma por monto un numero que solo cuenta cosas', () => {
    // "un millar de volantes" registraba un movimiento de S/1.00.
    expect(montoACentimos('un millar de volantes')).toBeNull()
    expect(montoACentimos('una cartulina')).toBeNull()
  })
})

describe('numeroEnSoles / todosLosMontosEnCentimos', () => {
  test('toma el primer numero de la frase', () => {
    expect(numeroEnSoles('500 soles')).toBe(500)
    expect(numeroEnSoles('S/ 1500')).toBe(1500)
  })

  test('recoge todos los montos en orden de aparicion', () => {
    expect(todosLosMontosEnCentimos('Contrato 240, adelanto 100')).toEqual([24000, 10000])
  })

  test('ignora ceros y negativos', () => {
    expect(numeroEnSoles('0 soles')).toBeNull()
  })
})

describe('inferirTipo', () => {
  test('reconoce ingresos y egresos sin tilde', () => {
    expect(inferirTipo('Ingreso 500 soles')).toBe('ingreso')
    expect(inferirTipo('Egreso 200 soles')).toBe('egreso')
    expect(inferirTipo('compra de cartulina')).toBe('egreso')
    expect(inferirTipo('pago de luz')).toBe('egreso')
  })

  test('sin verbo reconocible devuelve null', () => {
    expect(inferirTipo('cartulina folcote')).toBeNull()
  })

  test('los verbos con tilde se reconocen igual que sin ella', () => {
    // El \b de JS es ASCII y tras "é"/"ó"/"í" no hay frontera de palabra, asi
    // que estos verbos —los mas naturales al hablar— no casaban con nada.
    expect(inferirTipo('compré cartulina por 350 soles')).toBe('egreso')
    expect(inferirTipo('pagué la luz 180 soles')).toBe('egreso')
    expect(inferirTipo('gastó 1200 en planchas')).toBe('egreso')
    expect(inferirTipo('vendí 1000 volantes')).toBe('ingreso')
    expect(inferirTipo('cobré 300 a Cristina')).toBe('ingreso')

    // Y siguen funcionando sin tilde
    expect(inferirTipo('compre cartulina por 350 soles')).toBe('egreso')
    expect(inferirTipo('pague la luz 180 soles')).toBe('egreso')
  })

  /**
   * El pronombre invierte el verbo. Es la señal mas fiable del castellano
   * hablado y no se miraba: «me pagó la señora Rosa» se guardaba como un gasto.
   */
  test('distingue quien paga a quien', () => {
    expect(inferirTipo('me pagó la señora Rosa 80 soles')).toBe('ingreso')
    expect(inferirTipo('me pagaron 500')).toBe('ingreso')
    expect(inferirTipo('le pagué 350 a Pacheco')).toBe('egreso')
    expect(inferirTipo('me compró 500 tarjetas')).toBe('ingreso')
    expect(inferirTipo('compré 500 tarjetas')).toBe('egreso')
  })

  /**
   * La palabra que el dueño pone delante —la del chip de modo— manda sobre
   * cualquier palabra suelta de la descripcion.
   */
  test('la palabra explicita gana al contexto', () => {
    expect(inferirTipo('Egreso 200 soles, servicio de luz')).toBe('egreso')
    expect(inferirTipo('Egreso 300, trabajo de plastificado')).toBe('egreso')
    expect(inferirTipo('Egreso 120, pedido de tintas')).toBe('egreso')
    expect(inferirTipo('Ingreso 500, compra de Juan')).toBe('ingreso')
  })

  test('no adivina cuando no hay ninguna señal', () => {
    // Antes contestaba «ingreso» ante la duda: un gasto guardado como venta
    // infla el balance y mete al proveedor entre los que te deben.
    expect(inferirTipo('350 de cartulina')).toBeNull()
    expect(inferirTipo('Cristina 240')).toBeNull()
  })

  test('no confunde la orden a la app con el sentido del dinero', () => {
    // «anota», «apunta» y «registra» estaban en la lista de ingreso y
    // volteaban cualquier gasto que se pidiera por favor.
    expect(inferirTipo('anótame que gasté en tinta 120 soles')).toBe('egreso')
    expect(inferirTipo('ya pues apunta ahí que pagué la luz')).toBe('egreso')
  })
})

describe('leerContratoConAdelanto', () => {
  test('contrato con adelanto explicito', () => {
    expect(leerContratoConAdelanto('Contrato 240, adelanto 100, cliente Cristina')).toEqual({
      monto_centimos: 24000,
      adelanto_centimos: 10000,
    })
  })

  test('contrato total + adelanto', () => {
    expect(leerContratoConAdelanto('cliente Neira contrato total 800 adelanto 300')).toEqual({
      monto_centimos: 80000,
      adelanto_centimos: 30000,
    })
  })

  test('el adelanto nunca puede igualar o superar el total', () => {
    const r = leerContratoConAdelanto('contrato 100 adelanto 100')
    expect(r?.adelanto_centimos).toBeNull()
  })

  test('"por N" se toma como valor total', () => {
    expect(leerContratoConAdelanto('trabajo por 350 soles')?.monto_centimos).toBe(35000)
  })

  test('frase sin señal de contrato devuelve null', () => {
    expect(leerContratoConAdelanto('hola que tal')).toBeNull()
  })
})

describe('inferirContacto', () => {
  it.each([
    'pagué el recibo de luz 180 soles ayer',
    'Recibí 180 por el servicio de ayer',
    'cobré 200 por el servicio',
    'compré tinta a 50 soles',
    'pagué el servicio de agua',
  ])('palabras del dictado nunca son contacto: «%s»', (frase) => {
    expect(inferirContacto(frase)).toBeNull()
  })

  it('un nombre real tras «pagué a» sigue saliendo', () => {
    expect(inferirContacto('pagué a Rosa 80 soles')).toBe('Rosa')
  })

  test('extrae el nombre tras "cliente" y tras "se llama"', () => {
    expect(inferirContacto('Contrato 240, adelanto 100, cliente Cristina')).toBe('Cristina')
    expect(
      inferirContacto('anota un trabajo de 640 para el cliente se llama Cristian Neira y la descripcion es millar')
    ).toBe('Cristian Neira')
  })

  test('no arrastra palabras que no son parte del nombre', () => {
    // Devolvia «Neira contrato»: otro Neira distinto del de las demas veces,
    // con su propia deuda y su propia fila en la lista de clientes.
    expect(inferirContacto('cliente Neira contrato total 800 adelanto 300')).toBe('Neira')
  })

  test('el rubro forma parte del nombre del negocio', () => {
    // Asi lo tiene apuntado el dueño en su lista: «Distribuidora Pacheco».
    expect(inferirContacto('compré papel bond 200 soles en la distribuidora Pacheco')).toBe(
      'distribuidora Pacheco'
    )
    expect(inferirContacto('Egreso 350 soles, proveedor Comercial Pacheco, cartulina')).toBe(
      'Comercial Pacheco'
    )
  })

  /**
   * Habla natural, sin decir «cliente» ni «proveedor». Antes ninguna de estas
   * dejaba contacto, y un movimiento sin contacto no entra en la deuda de
   * nadie: es de los que despues no se sabe a quien cobrarle.
   */
  test('encuentra el nombre aunque nadie diga «cliente»', () => {
    expect(inferirContacto('Juan abona 100 soles de su deuda')).toBe('Juan')
    expect(inferirContacto('le compré a Pacheco unas cartulinas 350 soles')).toBe('Pacheco')
    expect(inferirContacto('me pagó la señora Rosa 80 soles')).toBe('Rosa')
    expect(inferirContacto('Cristina me quedó debiendo 240')).toBe('Cristina')
    expect(inferirContacto('500 soles que entraron de Juan')).toBe('Juan')
  })

  /**
   * Inventar un nombre es peor que perderlo: el perdido se nota al mirar la
   * lista y el inventado se queda ahi, con deuda propia.
   */
  test('nunca convierte un producto ni un monto en persona', () => {
    expect(inferirContacto('ingreso de mil quinientos soles')).toBeNull()
    expect(inferirContacto('me salieron 350 de cartulina')).toBeNull()
    expect(inferirContacto('registrar 500 por el millar de volantes')).toBeNull()
    expect(inferirContacto('pagué 200 de luz')).toBeNull()
  })

  /**
   * La coma es como separa quien dicta. Antes de reconocerla, estos movimientos
   * se guardaban SIN CLIENTE: no entraban en la deuda de nadie y despues no
   * habia a quien cobrarle.
   */
  test('el nombre termina en la coma, no solo al final del dictado', () => {
    expect(
      inferirContacto('Egreso 350 soles, proveedor Comercial Pacheco, cartulina folcote')
    ).toBe('Comercial Pacheco')
    expect(inferirContacto('Egreso 200 soles, proveedor Distribuidora Lima, tintas')).toBe(
      'Distribuidora Lima'
    )
    expect(inferirContacto('Ingreso 500 soles, cliente Wilfredo Ica, millar de volantes')).toBe(
      'Wilfredo Ica'
    )
  })

  test('sin coma sigue comportandose igual que antes', () => {
    expect(inferirContacto('Egreso 350 soles proveedor Comercial Pacheco')).toBe(
      'Comercial Pacheco'
    )
    expect(inferirContacto('egreso 120 soles comercial Pacheco')).toBe('Comercial Pacheco')
  })
})

describe('centimosComoTexto', () => {
  test('siempre dos decimales', () => {
    expect(centimosComoTexto(50000)).toBe('500.00')
    expect(centimosComoTexto(4550)).toBe('45.50')
    expect(centimosComoTexto(5)).toBe('0.05')
  })
})

describe('el nombre no se traga la conjuncion', () => {
  test('«juanito y adelanto 20» es Juanito, no «Juanito Y»', () => {
    // Dictado de corrido, sin comas. El nombre se llevaba la «y» y creaba un
    // contacto NUEVO: la deuda del mismo cliente salia partida en dos.
    expect(
      inferirContacto('contrato de 240 soles de un millar de tarjetas del cliente juanito y adelanto 20 soles')
    ).toBe('juanito')
  })

  test('y con anticipo o a cuenta, igual', () => {
    expect(inferirContacto('contrato 300 soles cliente Rosa y anticipo 50')).toBe('Rosa')
    expect(inferirContacto('contrato 300 soles cliente Rosa y a cuenta 50')).toBe('Rosa')
  })
})

/**
 * MAS FORMAS DE DECIR LO MISMO.
 *
 * Cada una de estas se quedaba SIN TIPO, que es lo mismo que no registrarse:
 * sin tipo no se abre la tarjeta y solo sale una pista.
 */
describe('mas maneras de decir que entra o sale plata', () => {
  test('sale plata', () => {
    expect(inferirTipo('saqué 200 para la gasolina')).toBe('egreso')
    expect(inferirTipo('salió 80 de movilidad')).toBe('egreso')
    expect(inferirTipo('le di 150 al practicante')).toBe('egreso')
    expect(inferirTipo('invertí 1200 en una plancha')).toBe('egreso')
    expect(inferirTipo('compramos dos millares de papel bond en 400')).toBe('egreso')
    expect(inferirTipo('pagamos el alquiler del local 900 soles')).toBe('egreso')
  })

  test('entra plata', () => {
    expect(inferirTipo('me depositaron 500 de Juan')).toBe('ingreso')
    expect(inferirTipo('me devolvieron 50 de la tinta')).toBe('ingreso')
    expect(inferirTipo('entró 300 de Cristina')).toBe('ingreso')
    expect(inferirTipo('facturé 1500 a Imprenta Mateo')).toBe('ingreso')
    expect(inferirTipo('la señora Rosa me canceló los 240')).toBe('ingreso')
  })

  test('«me salieron» sigue siendo ambiguo y no se adivina', () => {
    // Puede ser lo que costo o lo que quedo. Mejor no saber que equivocarse:
    // por eso entra «salió» pero no «salieron».
    expect(inferirTipo('me salieron 350 de cartulina')).toBeNull()
  })
})

describe('mas maneras de nombrar al cliente', () => {
  test('el nombre detras del verbo y del importe', () => {
    expect(inferirContacto('me abonó 100 Cristina a cuenta de su deuda')).toBe('Cristina')
    expect(inferirContacto('me pagó 240 la señora Rosa')).toBe('Rosa')
  })

  test('«con» presenta al contacto igual que «a» o «para»', () => {
    expect(inferirContacto('cancelé la deuda con Pacheco, 350')).toBe('Pacheco')
  })
})

/**
 * LA VOZ NO SIEMPRE PONE MAYUSCULAS.
 *
 * Y de eso dependian todos los patrones de nombre: dictando «le compré a
 * pacheco» el movimiento se guardaba SIN PROVEEDOR, mientras que escrito con
 * mayuscula funcionaba. Justo al reves de lo que hace falta, porque esta
 * pantalla existe para hablarle.
 */
describe('el nombre dictado en minusculas', () => {
  test('se encuentra igual que con mayuscula', () => {
    expect(inferirContacto('le compré a pacheco cartulina 350 soles')).toBe('pacheco')
    expect(inferirContacto('me pagó cristina 240 por las tarjetas')).toBe('cristina')
    expect(inferirContacto('cobré 300 a la señora rosa')).toBe('rosa')
    expect(inferirContacto('me abonó 100 juan pérez')).toBe('juan pérez')
    expect(inferirContacto('egreso 200 con la distribuidora mendoza')).toBe('distribuidora mendoza')
  })

  test('mayuscula y minuscula dan el mismo resultado', () => {
    const frases = [
      'le compré a Pacheco cartulina 350 soles',
      'me pagó Cristina 240 por las tarjetas',
      'egreso 350 soles proveedor Pacheco cartulina folcote',
    ]
    for (const f of frases) {
      expect(inferirContacto(f.toLowerCase())?.toLowerCase()).toBe(inferirContacto(f)?.toLowerCase())
    }
  })

  /**
   * El riesgo de aceptar minusculas es inventar contactos con cualquier
   * palabra suelta. Inventar un nombre es peor que perderlo: el que falta se
   * ve al mirar la lista de clientes y el inventado se queda ahi con deuda.
   */
  test('pero no convierte cualquier palabra en persona', () => {
    expect(inferirContacto('pagué a crédito 200 de cartulina')).toBeNull()
    expect(inferirContacto('me pagó todo, 500 soles')).toBeNull()
    expect(inferirContacto('compré al contado 350')).toBeNull()
    expect(inferirContacto('egreso 100, entrega para el viernes')).toBeNull()
    expect(inferirContacto('me dejó a cuenta 100')).toBeNull()
    expect(inferirContacto('compré 350 de cartulina a medias')).toBeNull()
    expect(inferirContacto('pagué 200 de luz')).toBeNull()
    expect(inferirContacto('me pagaron 500')).toBeNull()
  })
})

/**
 * «CLIENTE FULANO» DICTADO DE CORRIDO.
 *
 * El patron mas antiguo del modulo solo sabia terminar el nombre en una coma,
 * al final del texto o ante un puñado de palabras. Dictando no hay comas y
 * detras del nombre viene el trabajo, asi que «cliente Juan registra humilla
 * de troquel de 240 soles» no casaba con NADA y el movimiento se guardaba SIN
 * CLIENTE -- teniendo la palabra «cliente» delante del nombre.
 */
describe('el cliente dicho sin comas', () => {
  test('se encuentra aunque detras venga el trabajo y el importe', () => {
    expect(inferirContacto('cliente Juan registra humilla de troquel de 240 soles')).toBe('Juan')
    expect(inferirContacto('cliente juan registra humilla de troquel de 240 soles')).toBe('juan')
    expect(inferirContacto('ingreso cliente Cristina Neira millar de volantes 240 soles')).toBe(
      'Cristina Neira'
    )
  })

  test('igual con el proveedor', () => {
    expect(inferirContacto('egreso proveedor Comercial Pacheco cartulina folcote 350 soles')).toBe(
      'Comercial Pacheco'
    )
    expect(inferirContacto('egreso proveedor pacheco cartulina 350')).toBe('pacheco')
  })

  test('y sigue funcionando con comas, como siempre', () => {
    expect(
      inferirContacto('Egreso 350 soles, proveedor Comercial Pacheco, cartulina folcote')
    ).toBe('Comercial Pacheco')
    expect(inferirContacto('cliente Juan, humilla de troquel, 240 soles')).toBe('Juan')
  })
})
