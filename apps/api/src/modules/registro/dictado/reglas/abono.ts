/**
 * Detección de abonos a deudas existentes.
 * Ej: "Juan Pablo Pérez abona 100 soles más de su deuda"
 *     "el cliente me pagó 50 de su deuda"
 *     "amortiza 200 la señora Cristina"
 */

/** ¿La frase habla de abonar/pagar parte de una deuda existente? */
export function esAbonoDeuda(text: string): boolean {
  const lower = text.toLowerCase()

  // Si registra un contrato/trabajo nuevo, el "abono/adelanto" es parte de ese
  // registro nuevo, no un pago a deuda anterior
  const esRegistroNuevo = /\b(contrato|valor\s+de|pedido|servicio|trabajo)\b/.test(lower)
  if (esRegistroNuevo) return false

  const mencionaDeuda = /\b(?:de\s+(?:su|la)\s+deuda|su\s+deuda|la\s+deuda|deuda\s+anterior|a\s+cuenta|lo\s+que\s+(?:me\s+)?debe|amortiz\w*)\b/.test(
    lower
  )
  const verboAbonar = /\babon(?:a|ó|o|ar|e)\b/.test(lower)

  return mencionaDeuda || verboAbonar
}

const PRONOMBRES = /^(?:me|nos|ya|hoy|le|les|se|él|ella)$/i

/** Extrae el nombre del contacto en frases de abono */
export function contactoDeAbono(text: string): string | null {
  // "Juan Pablo Pérez abona 100..."
  const antesDelVerbo = text.match(
    /^(?:el\s+|la\s+)?(?:cliente\s+|proveedor\s+|señora?\s+|don\s+|doña\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s]{1,40}?)\s+(?:me\s+|nos\s+)?(?:abon(?:a|ó|o)|amortiz(?:a|ó|o)|pag(?:a|ó|o)|deposit(?:a|ó|o)|dio|dej[oó])\b/i
  )
  if (antesDelVerbo) {
    const nombre = antesDelVerbo[1].trim()
    if (!/^\d/.test(nombre) && !PRONOMBRES.test(nombre)) return nombre
  }

  // "...la señora Cristina" / "...el cliente Pérez" al final de la frase
  const tituloAlFinal = text.match(
    /\b(?:señora?|don|doña|cliente|proveedor)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s]{1,40}?)\s*$/i
  )
  if (tituloAlFinal) {
    const nombre = tituloAlFinal[1].trim()
    if (!/^\d/.test(nombre) && !PRONOMBRES.test(nombre)) return nombre
  }

  // "abono de Juan Pérez" / "deuda de Juan Pérez"
  const despuesDeDe = text.match(
    /\b(?:abono|pago|deuda)\s+de\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s]{1,40}?)(?=\s+(?:por|de|que)\b|\s+\d|\s*$)/i
  )
  if (despuesDeDe) {
    const nombre = despuesDeDe[1].trim()
    if (!/^\d/.test(nombre) && !/^(?:su|la|el)$/i.test(nombre) && !PRONOMBRES.test(nombre)) {
      return nombre
    }
  }

  return null
}
