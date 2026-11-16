import { recortarNombre } from './vocabulario-imprenta.js'

/**
 * De un dictado largo saca la descripcion corta del trabajo.
 *
 * POR QUE SE LIMPIA POR SUSTRACCION Y NO SOLO CON PATRONES
 * -------------------------------------------------------
 * El dueño dicta "Contrato 8500 soles, cliente Cristian Neira, millar de
 * volantes". El monto ya tiene su columna en el Excel y el nombre tambien: si
 * la descripcion los repite, la celda "Trabajo" que ve el contador dice tres
 * veces lo mismo y no se lee de un vistazo QUE se imprimio. Lo unico que aporta
 * ahi es "millar de volantes".
 *
 * Por eso el dictado se parte por comas y se tiran los tramos que ya tienen
 * columna propia: el importe, la palabra de instruccion y el cliente/proveedor.
 * Lo que sobra es el producto.
 *
 * CUANDO DEVUELVE null
 * --------------------
 * Cuando no se pudo quitar nada. El llamador se queda con el texto completo,
 * que es el comportamiento de siempre. Preferimos una descripcion larga a una
 * inventada: "150 PLIEGOS DE COCUHE BRILLO" no lleva instruccion ni monto en
 * soles, asi que se respeta tal cual.
 */

/**
 * Palabras con las que el dueño ABRE el dictado, no con las que describe el
 * trabajo. Deliberadamente NO estan aqui "recibo" (recibo de luz), "compra" ni
 * "proforma": quitarlas dejaria la celda con el nombre del cliente o vacia.
 */
const INSTRUCCION =
  /^(?:contratos?|tratos?|trabajos?|ingres[oó]s?|egresos?|an[oó]t[a-záéíóúñ]*|ap[uú]nt[a-záéíóúñ]*|reg[ií]str[a-záéíóúñ]*|cre[ae][a-záéíóúñ]*|h[aá]zme|h[aá]z|hacer|gener[ae][a-záéíóúñ]*|agreg[ae][a-záéíóúñ]*|a[ñn]ad[ae][a-záéíóúñ]*|quiero|quisiera|necesito|nuev[oa]s?|adelantos?|anticipos?|abonar?|abonos?)\b[\s:.\-–]*/i

/**
 * Como ABRE la gente cuando habla en vez de dictar: «sabes que...», «oye...»,
 * «ya pues apunta ahí que...», «hazme el favor de...». No describen nada y se
 * colaban enteras en la celda «Trabajo» del Excel que lee el contador.
 *
 * Las tildes van escritas a mano en cada palabra ([aá], [ií]) porque el \w de
 * JavaScript es ASCII y se detiene justo antes de ellas — el mismo motivo por
 * el que «anótame» no casaba con la lista de instrucciones de arriba.
 */
const MULETILLA =
  /^(?:hola|holi|buenas(?:\s+(?:tardes|noches|d[ií]as))?|buenos\s+d[ií]as|qu[eé]\s+tal|oiga|oigan|disculp[ae]|perdon[ae]|ya\s+pues|ya\s+pe|oye|oe|mira|sabes|mmm+|eh+|a\s+ver|h[aá]zme\s+el\s+favor(?:\s+de)?|por\s+favor|quiero\s+que|necesito\s+que|dime)\b[\s,:.\-–]*/i

/** Lo que queda colgando una vez quitada la muletilla: «...que», «...ahí». */
// El corte va con (?![a-z…]) y no con \b por el mismo motivo de siempre: «ahí»
// acaba en tilde, y tras una tilde el \b de JavaScript no ve frontera ninguna.
const RELLENO = /^(?:que|ah[ií]|pues|ya|este)(?![a-záéíóúñ])[\s,:.\-–]*/i

/** El nombre ya viaja en su columna: aqui solo estorba. */
const CONTACTO_AL_INICIO = /^(?:(?:para|de|del)\s+)?(?:el\s+|la\s+)?(?:cliente|proveedor)\b/i

/**
 * "cliente Cristian Neira ..." dictado sin comas. Se exige inicial mayuscula
 * para saber donde termina el nombre y empieza el producto, que va en
 * minusculas ("cliente Cristian Neira millar de volantes").
 */
const CONTACTO_CON_NOMBRE =
  /^(?:(?:para|de|del)\s+)?(?:el\s+|la\s+)?(?:cliente|proveedor)\s+(?:se\s+llama\s+)?(?:[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]*(?:\s+|$)){1,4}/

/** "8500 soles", "S/ 350", "240". */
const MONTO = /^(?:s\/\.?\s*)?\d+(?:[.,]\d{1,2})?\s*(?:soles?)?\b[\s:.\-–]*/i

/** Lo que une la instruccion con el producto: "egreso 200 DE cartulina". */
const CONECTOR = /^(?:de|del|por|en|a|con|para|es|son|un|una|unos|unas|el|la|los|las)\b\s+/i

/** Patrones donde el dueño dice explicitamente cual es la descripcion. */
const EXPLICITOS = [
  /descripci[oó]n\s+del\s+(?:producto|trabajo|servicio).*?(?:se\s+llaman?|son|es)\s+(.+)$/i,
  /(?:la\s+)?descripci[oó]n(?:\s+del\s+(?:trabajo|producto|servicio))?\s+(?:es\s+|:\s*)?(.+)$/i,
  /descripci[oó]n\s+(.+)$/i,
  /(?:estoy\s+)?haciendo\s+(.+?)(?:\.|$)/i,
  /(?:trabajo|servicio|pedido)\s+(?:es|de)\s+(.+?)(?:\.|$)/i,
]

/**
 * El importe cuando va al FINAL, que es donde cae al hablar de corrido:
 * «millar de volantes 240 soles». Con comas nunca hizo falta —cada tramo
 * llegaba limpio—, pero el dictado por voz no las pone y todo cae junto.
 */
const MONTO_FINAL = /[\s,;.:-]*(?:\b(?:de|por|en|a)\s+)?(?:s\/\.?\s*)?\d+(?:[.,]\d{1,2})?\s*(?:soles?)?\s*$/i

/** «…cliente Cristina» al final: el nombre ya viaja en su columna. */
const CONTACTO_FINAL =
  /[\s,;.:-]*(?:\b(?:del?|para)\s+)?(?:\b(?:el|la)\s+)?\b(?:cliente|proveedor|se[nñ]ora?|don|do[nñ]a)\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+)?\s*$/i

const LARGO_MINIMO = 3
const LARGO_MAXIMO = 200

/**
 * «de un de un millar» -> «de un millar».
 *
 * Al dictar se duda y se repite, y el reconocimiento lo transcribe todo. Esa
 * repeticion acababa entera en la celda «Trabajo» del Excel que ve el
 * contador.
 */
function quitarRepeticiones(texto: string): string {
  let previo = ''
  let salida = texto
  while (previo !== salida) {
    previo = salida
    salida = salida.replace(/\b((?:\S+\s+){0,2}\S+)\s+\1\b/gi, '$1')
  }
  return salida
}

export function inferirDescripcion(text: string): string | null {
  const bruto = quitarRepeticiones((text ?? '').trim().replace(/\s+/g, ' '))
  if (!bruto) return null

  const limpio = limpiar(descripcionExplicita(bruto) ?? bruto)
  if (!esDescripcionUtil(limpio)) return null

  // Nada que quitar: no hay descripcion que inferir, la tiene el llamador.
  if (limpio.toLowerCase() === bruto.toLowerCase()) return null

  return capitalizar(limpio)
}

function descripcionExplicita(text: string): string | null {
  for (const patron of EXPLICITOS) {
    const match = text.match(patron)
    if (match?.[1]) return match[1]
  }
  return null
}

/**
 * El dictado viene separado por comas ("monto, cliente, producto"): cada tramo
 * se limpia por su cuenta y los que quedan vacios desaparecen.
 */
function limpiar(texto: string): string {
  return texto
    .split(/[,;]+/)
    .map(limpiarTramo)
    .filter((tramo) => tramo.length > 0)
    .join(', ')
}

function limpiarTramo(tramo: string): string {
  let resto = tramo.trim().replace(/\s+/g, ' ')

  // Se quita de a poco y desde el principio, que es donde el dueño pone lo que
  // ya esta capturado en otras columnas. En bucle porque "Egreso 350 soles"
  // son dos quites encadenados.
  let recorto = false
  for (let cambio = true; cambio && resto.length > 0; ) {
    cambio = false

    const muletilla = resto.match(MULETILLA)
    if (muletilla) {
      resto = resto.slice(muletilla[0].length)
      recorto = true
      cambio = true
    }

    // El relleno solo se quita DESPUES de haber recortado algo: un tramo que
    // empieza por «ya» de verdad («ya laminado») no es una muletilla.
    const relleno = recorto ? resto.match(RELLENO) : null
    if (relleno) {
      resto = resto.slice(relleno[0].length)
      cambio = true
    }

    const sinContacto = quitarContacto(resto)
    if (sinContacto !== null) {
      resto = sinContacto
      recorto = true
      cambio = true
    }

    const instruccion = resto.match(INSTRUCCION)
    if (instruccion) {
      resto = resto.slice(instruccion[0].length)
      recorto = true
      cambio = true
    }

    // El numero solo se va si lleva "soles" pegado o si ya se quito la
    // instruccion. Asi "150 PLIEGOS DE COCUHE BRILLO" conserva su cantidad.
    const monto = resto.match(MONTO)
    if (monto && (recorto || /soles?|s\//i.test(monto[0]))) {
      resto = resto.slice(monto[0].length)
      recorto = true
      cambio = true
    }

    const conector = recorto ? resto.match(CONECTOR) : null
    if (conector) {
      resto = resto.slice(conector[0].length)
      cambio = true
    }

    // Y por la cola. Solo despues de haber recortado algo por delante: asi
    // «150 PLIEGOS DE COCUHE BRILLO», que se dicto tal cual, se respeta.
    if (recorto) {
      const contactoFinal = resto.match(CONTACTO_FINAL)
      if (contactoFinal?.index !== undefined && contactoFinal.index > 0) {
        resto = resto.slice(0, contactoFinal.index)
        cambio = true
      }

      const montoFinal = resto.match(MONTO_FINAL)
      if (montoFinal?.index !== undefined && montoFinal.index > 0) {
        resto = resto.slice(0, montoFinal.index)
        cambio = true
      }
    }
  }

  return resto.trim()
}

/**
 * Quita "cliente Fulano" del principio del tramo. Devuelve null si el tramo no
 * empieza nombrando al contacto, y cadena vacia cuando el nombre viene en
 * minusculas: ahi no se sabe donde acaba el nombre y empieza el producto, asi
 * que el tramo entero se da por perdido antes que cortarlo por la mitad.
 */
function quitarContacto(tramo: string): string | null {
  if (!CONTACTO_AL_INICIO.test(tramo)) return null

  const conNombre = tramo.match(CONTACTO_CON_NOMBRE)
  if (conNombre) return tramo.slice(conNombre[0].length).trim()

  // NOMBRE EN MINUSCULA. Antes se daba el tramo entero por perdido porque no
  // se sabia donde acababa el nombre y empezaba el producto -- y dictando eso
  // se llevaba por delante el trabajo: «proveedor pacheco por cartulina
  // folcote de 350» dejaba la descripcion vacia y se guardaba la frase cruda.
  //
  // Ahora si se sabe: `recortarNombre` corta en el primer producto, numero o
  // palabra de gramatica, que es exactamente lo que hace falta aqui.
  const sinEtiqueta = tramo.replace(CONTACTO_AL_INICIO, '').trim()
  const nombre = recortarNombre(sinEtiqueta)
  return nombre ? sinEtiqueta.slice(nombre.length).trim() : ''
}

function esDescripcionUtil(desc: string): boolean {
  if (desc.length < LARGO_MINIMO || desc.length > LARGO_MAXIMO) return false
  // Sin una sola letra es un resto de numeros: no describe nada.
  return /[a-záéíóúñ]/i.test(desc)
}

/** Solo la primera letra: "PLIEGOS" en mayusculas se dictó asi a proposito. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function limpiarNombreDeContacto(name: string): string {
  return name
    .replace(/\s+descripci[oó]n.*$/i, '')
    .replace(/^(?:se\s+llama\s+)/i, '')
    .trim()
}

export function formatearNombreDeContacto(name: string): string {
  const cleaned = limpiarNombreDeContacto(name)
  return cleaned
    .split(/\s+/)
    .map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'comercial') return 'Comercial'
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}
