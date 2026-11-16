/**
 * Deteccion local de proformas / cotizaciones.
 *
 * Existe porque, sin esto, pedir una proforma solo funcionaba cuando el LLM
 * respondia: el camino de respaldo de /api/extract devuelve es_proforma=false
 * siempre. Con OpenRouter caido o sin saldo, el dueño no podia cotizar.
 * Detectado con la prueba de punta a punta, que corre a proposito sin clave.
 *
 * Ej: "hazle una proforma a Juan por 500 tarjetas a 180 soles"
 *     "cotiza a Pacheco 1000 volantes en 250"
 *     "/proforma Maria 300"
 *     "presupuesto para Rosa de 1 banner a 90"
 *     "Proforma Juan, 500 tarjetas, 180 soles"  ← lo que ensena la app
 */

/**
 * Quita tildes antes de comparar.
 *
 * En JS, \b es ASCII: despues de una vocal acentuada no hay frontera de
 * palabra, asi que /\bcotiza\w*\b/ NO casa con "cotízale". Es el mismo fallo
 * que hace que inferirTipo no reconozca "compré" ni "pagué". Normalizando
 * primero, el problema desaparece para toda esta familia de verbos.
 */
function sinTildes(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** ¿La frase pide una cotizacion en vez de registrar un movimiento? */
export function esProforma(text: string): boolean {
  const plano = sinTildes(text)

  // Un abono a una deuda existente nunca es una cotizacion.
  if (/\bde\s+(?:su|la)\s+deuda\b|\ba\s+cuenta\b/.test(plano)) return false

  return /\b(proforma\w*|cotiza\w*|cotizacion\w*|presupuest\w*)\b/.test(plano)
}

/**
 * Palabras que se cuelan como nombre y no lo son.
 *
 * A los articulos ("una proforma a un cliente") hubo que sumarles las
 * preposiciones al admitir el dictado sin preposicion: en "proforma de 500
 * soles" el patron sin preposicion muerde "de" y devolvia "de" como cliente
 * de la cotizacion.
 */
const NO_ES_NOMBRE =
  /^(?:un|una|unos|unas|el|la|los|las|mi|su|de|del|al|a|y|o|en|con|por|para|que|soles?)$/i

/**
 * Nombre del cliente en una frase de cotizacion.
 *
 * Dos maneras de nombrar al destinatario, y las dos se usan a diario:
 *   · con preposicion — "hazle una proforma A Juan por…"
 *   · pegado a la palabra clave — "Proforma Juan, 500 tarjetas, 180 soles",
 *     que es justo lo que el modo Proforma arma (prefijo + lo dictado) y lo
 *     que el campo de texto ensena como ejemplo.
 *
 * Se corta ante lo que claramente ya no es el nombre: una coma, una cifra,
 * "por", "de", "en".
 */
export function contactoDeProforma(text: string): string | null {
  const NOMBRE = '[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\\s]{0,40}?'
  // La coma va primero porque es el corte del formato dictado de corrido:
  // sin ella "Juan, 500 tarjetas" no cortaba (el `\\s+\\d` exige un espacio
  // antes de la cifra y ahi lo que hay es la coma) y se perdia el cliente.
  const CORTE = '(?=\\s*,|\\s+(?:por|de|en|con|para)\\b|\\s+\\d|\\s*$)'

  // Se busca sobre el texto sin tildes (mismo motivo que en esProforma) pero
  // el nombre se recorta del ORIGINAL, para no devolver "Maria" por "María".
  const plano = sinTildes(text)

  const patrones = [
    // "hazle una proforma a Juan por..." / "cotízale a la señora Cristina..."
    new RegExp(`\\b(?:proforma\\w*|cotiza\\w*|cotizacion\\w*|presupuest\\w*)\\s+(?:para|a)\\s+(?:el\\s+|la\\s+)?(?:cliente\\s+|senor(?:a)?\\s+|don\\s+|dona\\s+)?(${NOMBRE})${CORTE}`, 'i'),
    // "/proforma Maria 300"
    new RegExp(`^/proforma\\s+(${NOMBRE})${CORTE}`, 'i'),
    // Sin preposicion: "cotiza Pacheco 1000 volantes", "Proforma Rosa, 2
    // millares de volantes, 250 soles". Va al final para que "proforma a
    // Juan por…" lo resuelva antes el patron con preposicion.
    new RegExp(
      `\\b(?:proforma\\w*|cotiza\\w*|cotizacion\\w*|presupuest\\w*)\\s+(?:el\\s+|la\\s+)?(?:cliente\\s+|senor(?:a)?\\s+|don\\s+|dona\\s+)?(${NOMBRE})${CORTE}`,
      'i'
    ),
  ]

  for (const patron of patrones) {
    const m = plano.match(patron)
    if (!m || m.index === undefined) continue
    // Recorte por posicion: NFD no cambia el largo de las vocales acentuadas
    // (letra + diacritico se colapsan al quitar el diacritico), asi que se
    // localiza el fragmento en el original por su texto plano.
    const inicio = plano.indexOf(m[1], m.index)
    const nombre = (inicio >= 0 ? text.slice(inicio, inicio + m[1].length) : m[1]).trim()
    if (NO_ES_NOMBRE.test(nombre)) continue
    if (!/^\d/.test(nombre)) return nombre
  }

  return null
}
