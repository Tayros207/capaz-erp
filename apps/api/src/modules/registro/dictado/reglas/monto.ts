import { pareceProducto, recortarNombre } from './vocabulario-imprenta.js'
import { montoEnPalabrasSoles } from './numeros-en-palabras.js'

/** Extrae todos los montos en soles encontrados en el texto */
export function todosLosMontosEnCentimos(text: string): number[] {
  const found: number[] = []
  const regex = /(\d+(?:[.,]\d{1,2})?)\s*(?:soles?|s\/\.?)?/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const n = Number.parseFloat(match[1].replace(',', '.'))
    if (!Number.isNaN(n) && n > 0) found.push(Math.round(n * 100))
  }
  return found
}

/** Contrato / valor total + adelanto parcial */
export function leerContratoConAdelanto(
  text: string
): { monto_centimos: number; adelanto_centimos: number | null } | null {
  // Sin tildes, y por la misma razon que en inferirTipo: «adelantó» no casaba
  // con «adelanto» y el adelanto dictado de corrido —«y me adelantó 100»— se
  // perdia entero. El trabajo se guardaba como si no se hubiera pagado nada.
  const lower = sinTildes(text)
  const esContrato =
    /\b(contrato|trato|registr\w*|anot\w*|apunt\w*|trabajo|pedido|servicio|valor|adelanto|anticipo)\b/.test(
      lower
    )

  const valorMatch = lower.match(
    /(?:valor|precio|total|por)\s*(?:de\s+)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles?)?/i
  )
  const totalContratoMatch = lower.match(
    /(?:el\s+)?contrato\s+total\s+(?:es\s+)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles?)?/i
  )
  const adelantoMatch = lower.match(
    /(?:adelanto|anticipo|abono|pag[oó])\s*(?:de\s+)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles?)?/i
  )

  const montos = todosLosMontosEnCentimos(lower)
  if (montos.length === 0 && !valorMatch && !totalContratoMatch) return null

  let total = valorMatch
    ? Math.round(Number.parseFloat(valorMatch[1].replace(',', '.')) * 100)
    : totalContratoMatch
      ? Math.round(Number.parseFloat(totalContratoMatch[1].replace(',', '.')) * 100)
      : null
  let adelanto = adelantoMatch
    ? Math.round(Number.parseFloat(adelantoMatch[1].replace(',', '.')) * 100)
    : null

  if (montos.length >= 2 && (adelantoMatch || /adelanto|anticipo/.test(lower))) {
    const sorted = [...montos].sort((a, b) => b - a)
    total = total ?? sorted[0]
    adelanto = adelanto ?? sorted[1]
  } else if (montos.length === 1) {
    total = total ?? montos[0]
  } else if (montos.length >= 1 && esContrato) {
    total = total ?? Math.max(...montos)
  }

  if (total === null) return null
  if (adelanto !== null && adelanto >= total) adelanto = null

  if (esContrato || valorMatch || adelantoMatch || totalContratoMatch) {
    return { monto_centimos: total, adelanto_centimos: adelanto }
  }

  return null
}

/** Extrae número de soles de frases naturales: "500 soles", "S/ 1500", etc. */
export function numeroEnSoles(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:soles?|s\/\.?)?/i)
  if (!match) {
    const anyNum = text.match(/(\d+(?:[.,]\d{1,2})?)/)
    if (!anyNum) return null
    const n = Number.parseFloat(anyNum[1].replace(',', '.'))
    return Number.isNaN(n) || n <= 0 ? null : n
  }
  const n = Number.parseFloat(match[1].replace(',', '.'))
  return Number.isNaN(n) || n <= 0 ? null : n
}

/** Convierte texto PEN a céntimos (enteros) */
export function montoACentimos(input: string): number | null {
  const soles = numeroEnSoles(input)
  if (soles !== null) return Math.round(soles * 100)

  // Sin digitos: puede que lo haya dicho en palabras. Se recorre la frase
  // ENTERA. Antes habia dos cercos que lo hacian casi inutil: solo se intentaba
  // si el texto contenia «mil/cien/ciento/quinientos/doscientos/trescientos», y
  // el lector exigia que TODAS las palabras fueran numeros, asi que
  // «me salieron trescientos cincuenta soles» moria en la primera.
  const palabras = montoEnPalabrasSoles(input)
  return palabras !== null ? palabras * 100 : null
}

export function centimosComoTexto(centimos: number): string {
  return (centimos / 100).toFixed(2)
}

/**
 * Minusculas y sin tildes.
 *
 * IMPRESCINDIBLE, y no por prolijidad: el `\b` de JavaScript solo considera
 * letra a [A-Za-z0-9_]. Una vocal acentuada NO lo es, asi que un patron como
 * `\bpag[oó]\b` no casaba NUNCA con «pagó»: la palabra acababa en un caracter
 * que el motor lee como separador y el limite de palabra fallaba en silencio.
 *
 * El efecto era que las formas que mas se usan al hablar —pagó, gastó, cobró,
 * vendí, recibí, pagué, compré, cobré— no las detectaba ninguna regla y el
 * movimiento se quedaba sin tipo. Y como el dictado por voz devuelve el texto
 * acentuado, era justo la entrada natural del microfono la que no se entendia.
 */
function sinTildes(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * NIVEL 1 · La palabra explicita.
 *
 * La pone el chip de modo y la dice quien ya sabe dictar. Manda sobre todo lo
 * demas: si el dueño puso «Egreso» delante, eso es lo que quiso registrar.
 */
const EXPLICITO_INGRESO = /\bingresos?\b/
const EXPLICITO_EGRESO = /\begresos?\b/

/**
 * NIVEL 2 · El pronombre, que invierte el verbo.
 *
 * Es la señal mas fiable del castellano hablado y la que faltaba entera:
 * «me pagó 80» es plata que ENTRA y «le pagué 80» es plata que SALE, con el
 * mismo verbo. Sin esto, «me pagó la señora Rosa 80 soles» se registraba como
 * egreso, o sea al reves y en la cuenta de otro.
 *
 * Se exige tercera persona en «comprar» (compró, compraron) porque «me compré
 * una maquina» es reflexivo y significa lo contrario.
 */
const RECIBIDO =
  /\b(?:me|nos)\s+(?:lo\s+|la\s+|los\s+|las\s+)?(?:pag\w*|deposit\w*|cancel\w*|abon\w*|devolv\w*|devuelv\w*|reembols\w*|compr(?:o|aron))\b/

/** NIVEL 2 · Verbos que solo pueden ir en un sentido. */
const VERBO_INGRESO = /\b(?:cobr\w*|vend\w*|ventas?|factur\w*|recibi\w*|entro|entraron|entrada)\b/
/**
 * «saqué 200 para la gasolina», «salió 80 de movilidad», «le di 150 al
 * practicante»: formas de decir que sale plata que no llevan ningun verbo de
 * los obvios y se quedaban sin tipo.
 *
 * Se admite «salió» (tercera del singular) pero NO «salieron»: «me salieron
 * 350» es ambiguo —puede ser lo que costo o lo que quedo— y ahi es mejor no
 * saber que equivocarse.
 */
const VERBO_EGRESO =
  /\b(?:pagu\w*|pagamos|compr\w*|gast\w*|invert\w*|invirt\w*|desembols\w*|saqu\w*|sac(?:o|amos|aron)|sali[oó]|salida|(?:le|les)\s+di)\b/

/**
 * NIVEL 3 · Contexto, que pesa poco a proposito.
 *
 * Estas palabras salen en frases de los DOS lados: «servicio» esta en el
 * servicio que vendes y en el recibo de luz que pagas. Antes pesaban igual que
 * un verbo y, al empatar, habia una linea que le daba la victoria a ingreso
 * siempre. Por eso «Egreso 200, servicio de luz» acababa siendo un ingreso.
 *
 * Ahora solo deciden cuando no se dijo ningun verbo, que es cuando de verdad
 * es lo unico que hay.
 */
const CONTEXTO_INGRESO =
  /\b(?:contrato|trato|trabajo|pedido|servicio|valor\s+de|adelanto\s+de\s+cliente)\b/
const CONTEXTO_EGRESO = /\b(?:pagos?|compras?|recibo|proveedor)\b/

/**
 * Ingreso o egreso, por niveles de certeza.
 *
 * Deliberadamente NO mira «anota», «apunta» ni «registra»: son la orden que el
 * dueño da a la app, no el sentido del dinero. Estaban en la lista de ingreso
 * y volteaban cualquier gasto que se dictara pidiendolo por favor.
 *
 * Devuelve null sin adivinar cuando no hay ninguna señal. Antes, ante la duda,
 * contestaba «ingreso»: un gasto mal guardado como venta infla el balance del
 * dia y ademas mete al proveedor en la lista de quien te debe.
 */
export function inferirTipo(text: string): 'ingreso' | 'egreso' | null {
  const t = sinTildes(text)

  // 1. La palabra explicita. Si estan las dos («Egreso 200 del ingreso de
  //    ayer»), gana la que va delante: es la que se puso a proposito.
  const decidido = elQuePrimero(t, EXPLICITO_INGRESO, EXPLICITO_EGRESO)
  if (decidido) return decidido

  // 2. El verbo. El pronombre se mira antes que nada porque invierte el
  //    sentido, y «me pagó» comparte verbo con «le pagué».
  if (RECIBIDO.test(t)) return 'ingreso'
  const porVerbo = elQuePrimero(t, VERBO_INGRESO, VERBO_EGRESO)
  if (porVerbo) return porVerbo

  // 3. Contexto. Solo llega aqui quien no dijo ningun verbo.
  return elQuePrimero(t, CONTEXTO_INGRESO, CONTEXTO_EGRESO)
}

/**
 * Cual de los dos lados aparece, y si aparecen los dos, cual va primero.
 *
 * Lo primero que se dice es el movimiento que se esta anotando; lo de despues
 * suele ser la referencia («cobré 300 y pagué 100 de la cartulina»).
 */
function elQuePrimero(
  texto: string,
  ingreso: RegExp,
  egreso: RegExp
): 'ingreso' | 'egreso' | null {
  const i = texto.search(ingreso)
  const e = texto.search(egreso)
  if (i === -1 && e === -1) return null
  if (e === -1) return 'ingreso'
  if (i === -1) return 'egreso'
  return i < e ? 'ingreso' : 'egreso'
}

/**
 * Donde termina el nombre de un contacto dentro del dictado.
 *
 * La coma es el separador REAL de quien dicta: "egreso 350 soles, proveedor
 * Comercial Pacheco, cartulina folcote". Sin ella aqui, el nombre solo se
 * reconocia si llegaba al final del texto o topaba con "por"/"descripcion", y
 * ese movimiento se guardaba SIN CLIENTE. Un movimiento sin cliente no entra en
 * la deuda de nadie: es de los que despues no se sabe a quien cobrarle.
 *
 * Se agrega a los cortes que ya habia, nunca en su lugar.
 */
// `y adelanto` cierra el nombre igual que una coma. Dictando de corrido —
// «del cliente juanito y adelanto 20 soles»— el nombre se llevaba la
// conjuncion y quedaba «Juanito Y»: un contacto NUEVO, con ese nombre, que ya
// no es el mismo Juanito de las otras veces. Su deuda sale partida en dos.
const FIN_DEL_NOMBRE = String.raw`\s+y\s+(?:adelant\w*|anticip\w*|a\s+cuenta)\b|\s*[,;]|\s*$`

/** Tratamientos que preceden al nombre sin formar parte de el. */
const TRATAMIENTO = String.raw`(?:se[nñ]or(?:a|ita)?|sr\.?|sra\.?|srta\.?|don|do[nñ]a)\s+`

/**
 * Un nombre propio dictado: empieza en mayuscula y son hasta tres palabras.
 *
 * La mayuscula es la unica pista fiable de donde acaba el nombre y empieza el
 * producto cuando se habla de corrido, sin comas: «a Pacheco unas cartulinas».
 */
const NOMBRE_PROPIO = String.raw`[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ]+){0,2}`

/**
 * Un nombre SIN exigir mayuscula.
 *
 * El reconocimiento de voz no siempre la pone, y de eso dependian todos los
 * patrones de aqui abajo: dictando «le compré a pacheco cartulina 350» el
 * movimiento se guardaba SIN PROVEEDOR, mientras que escrito con mayuscula
 * funcionaba. Justo al reves de lo que hace falta, porque esta pantalla
 * existe para hablarle.
 *
 * Se puede ser permisivo aqui porque quien decide de verdad es `nombreLimpio`:
 * descarta productos, numeros y gramatica suelta, y recorta en la primera
 * palabra que no puede ser nombre.
 */
const NOMBRE_CUALQUIERA = String.raw`[A-Za-zÁÉÍÓÚáéíóúÑñ]{3,}(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}){0,2}`

/**
 * Como aparece el nombre cuando NADIE dice «cliente» ni «proveedor», que es
 * como habla la gente: «le compré a Pacheco», «me pagó la señora Rosa»,
 * «Cristina me quedó debiendo». Antes ninguna de las tres dejaba contacto, y
 * un movimiento sin contacto no entra en la deuda de nadie.
 */
const CONTACTO_NATURAL: readonly RegExp[] = [
  // «...a Pacheco», «para Cristina Neira», «con Pacheco»
  new RegExp(String.raw`\b(?:a|para|con)\s+(?:la\s+|el\s+)?(?:${TRATAMIENTO})?(${NOMBRE_PROPIO})`),
  // «me abonó 100 Cristina», «me pagó 240 la señora Rosa»: el nombre va
  // DETRAS del verbo y del importe, que es como sale al hablar de corrido.
  new RegExp(
    String.raw`\b(?:pag|abon|deposit|cancel|entreg)[a-záéíóúñ]*\s+(?:\d+(?:[.,]\d{1,2})?\s*(?:soles?\s*)?)?(?:la\s+|el\s+)?(?:${TRATAMIENTO})?(${NOMBRE_PROPIO})`
  ),
  // «la señora Rosa», «don Juan»
  new RegExp(String.raw`\b(?:la\s+|el\s+)?${TRATAMIENTO}(${NOMBRE_PROPIO})`),
  // «Cristina me quedó debiendo», «Juan abonó», «Rosa me pagó».
  // La terminacion se escribe [a-záéíóúñ]* y no \w*: \w es ASCII y se paraba
  // justo antes de la tilde, que es donde acaban casi todos estos verbos.
  new RegExp(
    String.raw`\b(${NOMBRE_PROPIO})\s+(?:me\s+|nos\s+)?(?:pag|abon|qued|deb|compr|encarg|pidi)[a-záéíóúñ]*`
  ),
  // «que entraron de Juan» — con mayuscula, para no volver a coger «de cartulina»
  new RegExp(String.raw`\bde\s+(?:la\s+|el\s+)?(?:${TRATAMIENTO})?(${NOMBRE_PROPIO})`),
  // «en la distribuidora Pacheco», «en la imprenta Gonzales». El rubro forma
  // parte del nombre: asi es como el dueño la tiene apuntada en su lista.
  new RegExp(
    String.raw`\b(?:en|a|de)\s+(?:la\s+|el\s+)?((?:distribuidora|imprenta|comercial|empresa|tienda|librer[ií]a|ferreter[ií]a|papeler[ií]a|bodega)\s+${NOMBRE_PROPIO})`,
    'i'
  ),
]

/**
 * Los mismos sitios, pero aceptando el nombre en minuscula.
 *
 * Van DESPUES de los de mayuscula a proposito: cuando la voz si la puso, esa
 * pista es mas fiable y debe ganar. Estos son la red de abajo.
 */
const CONTACTO_NATURAL_MINUSCULA: readonly RegExp[] = [
  new RegExp(String.raw`\b(?:a|para|con)\s+(?:la\s+|el\s+)?(?:${TRATAMIENTO})?(${NOMBRE_CUALQUIERA})`, 'i'),
  new RegExp(
    String.raw`\b(?:pag|abon|deposit|cancel|entreg)[a-záéíóúñ]*\s+(?:\d+(?:[.,]\d{1,2})?\s*(?:soles?\s*)?)?(?:la\s+|el\s+)?(?:${TRATAMIENTO})?(${NOMBRE_CUALQUIERA})`,
    'i'
  ),
]

/**
 * Recorta y descarta de una vez: el nombre se queda en lo que de verdad es
 * nombre, y si no queda nada no hay contacto.
 *
 * Se aplica a TODOS los patrones, no solo a los nuevos: «cliente Neira
 * contrato total 800» devolvia «Neira contrato» y creaba un contacto con esa
 * palabra pegada al apellido —otro Neira distinto del de las demas veces, con
 * su deuda aparte.
 */
function nombreLimpio(candidato: string | null | undefined): string | null {
  const bruto = candidato?.trim()
  if (!bruto) return null
  if (pareceProducto(bruto)) return null
  const recortado = recortarNombre(bruto)
  return recortado.length > 0 ? recortado : null
}

export function inferirContacto(text: string): string | null {
  const seLlamaMatch = text.match(
    new RegExp(
      String.raw`\b(?:el\s+)?cliente\s+se\s+llama\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s]{0,40}?)(?=\s+y\s+|\s+la\s+descrip|\s+descrip|\s+por\b|${FIN_DEL_NOMBRE})`,
      'i'
    )
  )
  const seLlama = nombreLimpio(seLlamaMatch?.[1])
  if (seLlama) return seLlama

  // SIN LOOKAHEAD, y esa es la correccion.
  //
  // Antes el nombre solo sabia terminar en una coma, al final del texto o ante
  // un puñado de palabras («por», «total», «adelanto»). Dictando no hay comas
  // y detras del nombre viene el trabajo: «cliente Juan registra humilla de
  // troquel de 240 soles» no casaba con NADA —la clase de caracteres no cruza
  // digitos— y el movimiento se guardaba SIN CLIENTE, teniendo la palabra
  // «cliente» delante del nombre.
  //
  // Ahora se captura de largo y recorta `nombreLimpio`, que ya sabe donde
  // acaba un nombre: en un producto, en un numero, en gramatica suelta o en el
  // primer verbo de mando.
  const clienteMatch = text.match(
    new RegExp(
      String.raw`\bcliente\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s]{0,50})`,
      'i'
    )
  )
  if (clienteMatch && !/^se\s+llama\b/i.test(clienteMatch[1].trim())) {
    const limpio = nombreLimpio(clienteMatch[1])
    if (limpio) return limpio
  }

  const proveedorMatch = text.match(
    new RegExp(
      String.raw`\bproveedor\s+(?:comercial\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s]{0,40})`,
      'i'
    )
  )
  // "proveedor Comercial Pacheco" pierde el "Comercial" al capturar, y sin el
  // deja de ser el nombre que el dueño reconoce en su lista.
  if (proveedorMatch) {
    const name = proveedorMatch[1].trim()
    const limpio = nombreLimpio(
      /\bproveedor\s+comercial\b/i.test(text) ? `Comercial ${name}` : name
    )
    if (limpio) return limpio
  }

  const comercialMatch = text.match(
    new RegExp(
      String.raw`\bcomercial\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s]{0,30}?)(?=\s+descrip|\s+proveedor\b|${FIN_DEL_NOMBRE})`,
      'i'
    )
  )
  if (comercialMatch && /\begreso\b/i.test(text)) {
    const limpio = nombreLimpio(`Comercial ${comercialMatch[1].trim()}`)
    if (limpio) return limpio
  }

  // Habla natural: nadie dijo «cliente» ni «proveedor».
  for (const patron of CONTACTO_NATURAL) {
    const limpio = nombreLimpio(text.match(patron)?.[1])
    if (limpio) return limpio
  }

  // Y lo mismo aceptando minusculas, que es como llega la mitad del dictado.
  for (const patron of CONTACTO_NATURAL_MINUSCULA) {
    const limpio = nombreLimpio(text.match(patron)?.[1])
    if (limpio) return limpio
  }

  // Ultimo respaldo: «de Fulano» en minusculas. Se filtra por producto, que es
  // lo que le faltaba: de aqui salian los contactos «Cartulina» y «Volantes».
  const matches = [...text.matchAll(
    new RegExp(
      String.raw`\bde\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s]{0,40}?)(?=\s+por\b|${FIN_DEL_NOMBRE})`,
      'gi'
    )
  )]
  for (let i = matches.length - 1; i >= 0; i--) {
    const limpio = nombreLimpio(matches[i][1])
    if (limpio) return limpio
  }
  return null
}
