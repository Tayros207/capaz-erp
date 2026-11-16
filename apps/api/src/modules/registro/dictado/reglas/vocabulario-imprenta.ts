/**
 * Que palabras NO pueden ser el nombre de un cliente.
 *
 * Vive en shared porque hacen falta dos lecturas distintas del mismo dictado:
 * la del chat (un movimiento) y la de la orden de trabajo. Las dos cometian el
 * mismo error de dos formas:
 *
 *   · el chat inventaba contactos llamados «Cartulina» y «Volantes»;
 *   · la orden se llevaba el producto DENTRO del nombre —«Cristina millar»—
 *     y de paso lo perdia de la descripcion del trabajo.
 *
 * Inventar un nombre es peor que no encontrarlo: el que falta se ve al mirar
 * la lista de clientes, el inventado se queda ahi con deuda propia.
 */

/** Palabras de union: no dicen nada sobre si el resto es una persona. */
const UNIONES = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'en',
  'con', 'por', 'para', 'a', 'al', 'mi', 'su', 'lo',
  // Gramatica suelta que se cuela al hablar: «ES para Cristina», «Rosa ME
  // encargó». Sin ellas el nombre se llevaba «es» o «me» por delante.
  'es', 'son', 'esta', 'este', 'esa', 'ese', 'eso', 'esto', 'que', 'ya', 'tu',
  'me', 'nos', 'te', 'le', 'les', 'se',
])

/** Numeros dichos en palabras: tampoco son un nombre. */
const NUMEROS = new Set([
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta',
  'setenta', 'ochenta', 'noventa', 'cien', 'ciento', 'doscientos', 'doscientas',
  'trescientos', 'trescientas', 'cuatrocientos', 'cuatrocientas', 'quinientos',
  'quinientas', 'seiscientos', 'seiscientas', 'setecientos', 'setecientas',
  'ochocientos', 'ochocientas', 'novecientos', 'novecientas', 'mil', 'millon', 'millones',
])

/** Lo que se imprime, con lo que se imprime, y lo que se paga en el taller. */
const COSAS = new Set([
  // lo que se imprime
  'volante', 'volantes', 'tarjeta', 'tarjetas', 'afiche', 'afiches', 'banner', 'banners',
  'sticker', 'stickers', 'talonario', 'talonarios', 'boleta', 'boletas', 'factura', 'facturas',
  'folleto', 'folletos', 'triptico', 'tripticos', 'diptico', 'dipticos', 'catalogo', 'catalogos',
  'revista', 'revistas', 'libro', 'libros', 'cuaderno', 'cuadernos', 'agenda', 'agendas',
  'calendario', 'calendarios', 'sobre', 'sobres', 'membrete', 'membretes', 'sello', 'sellos',
  'gigantografia', 'gigantografias', 'lona', 'lonas', 'polo', 'polos', 'gorra', 'gorras',
  'taza', 'tazas', 'copia', 'copias', 'troquel', 'troqueles', 'presentacion',
  // material e insumos
  'papel', 'papeles', 'cartulina', 'cartulinas', 'bond', 'couche', 'folcote', 'pliego', 'pliegos',
  'tinta', 'tintas', 'plancha', 'planchas', 'barniz', 'vinil', 'viniles', 'laminado',
  'plastificado', 'troquelado', 'acabado', 'acabados', 'material', 'materiales',
  'insumo', 'insumos', 'color', 'colores', 'metro', 'metros', 'cara', 'caras',
  // servicios y gastos del taller
  'luz', 'agua', 'internet', 'telefono', 'alquiler', 'sueldo', 'sueldos', 'planilla',
  'movilidad', 'pasaje', 'pasajes', 'gasolina', 'combustible', 'mantenimiento',
  'repuesto', 'repuestos', 'impuesto', 'impuestos', 'igv', 'arbitrios', 'local', 'taller',
  'maquina', 'maquinas',
  // palabras de la propia frase
  'sol', 'soles', 'adelanto', 'anticipo', 'abono', 'deuda', 'saldo', 'total', 'monto',
  'plata', 'dinero', 'trabajo', 'trabajos', 'servicio', 'servicios', 'pedido', 'pedidos',
  'orden', 'ordenes', 'contrato', 'proforma', 'cotizacion', 'millar', 'millares',
  'docena', 'docenas', 'unidad', 'unidades', 'cantidad', 'diseno', 'impresion', 'impresiones',
  'valor', 'precio', 'entrega', 'cuenta', 'nueva', 'nuevo', 'full',
  'ayer', 'hoy', 'manana', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado',
  'domingo', 'eso', 'esto', 'algo', 'cosa', 'cosas', 'ahi', 'alli', 'aqui', 'favor',
  // Lo que sigue a «a», «con» o «para» sin ser nadie. Hace falta desde que el
  // nombre se acepta en minusculas: «pagué a crédito» no es un señor Crédito
  // y «me pagó todo» no es una señora Todo.
  'credito', 'contado', 'plazo', 'plazos', 'cuota', 'cuotas', 'medias', 'mitad',
  'mano', 'cambio', 'nombre', 'tiempo', 'vez', 'veces', 'gusto', 'parte', 'resto',
  'todo', 'toda', 'todos', 'todas', 'nada', 'poco', 'poca', 'mucho', 'mucha',
  'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'ambos', 'cada', 'casi',
  'tambien', 'ademas', 'entonces', 'porque', 'pero', 'aunque', 'mientras',
  'antes', 'despues', 'luego', 'ahora', 'siempre', 'nunca', 'aun', 'todavia',
  // Los verbos con los que se le MANDA a la app. Nunca son un nombre, y sin
  // ellos «cliente juan registra…» dictado en minusculas dejaba el cliente en
  // «juan registra».
  'registra', 'registro', 'registrar', 'registrame', 'anota', 'anotar', 'anotame',
  'apunta', 'apuntar', 'apuntame', 'crea', 'crear', 'haz', 'hacer', 'hazme',
  'genera', 'generar', 'agrega', 'agregar', 'anade', 'anadir', 'pon', 'poner',
  'ponme', 'quiero', 'quisiera', 'necesito', 'dame', 'dice', 'dijo',
])

function sinTildes(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** ¿Esta palabra puede formar parte del nombre de una persona o empresa? */
export function esPalabraDeNombre(palabra: string): boolean {
  const p = sinTildes(palabra).replace(/[^\w]/g, '')
  if (!p) return false
  if (/\d/.test(p)) return false
  return !COSAS.has(p) && !NUMEROS.has(p) && !UNIONES.has(p)
}

/**
 * ¿Lo capturado es un producto y no una persona?
 *
 * Se ignoran las uniones: «millar de volantes» son «millar» y «volantes», y
 * las dos son cosas, asi que el conjunto tampoco es nadie.
 */
export function pareceProducto(nombre: string): boolean {
  const palabras = sinTildes(nombre)
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !UNIONES.has(p))
  if (palabras.length === 0) return true
  return palabras.every((p) => COSAS.has(p) || NUMEROS.has(p) || /^\d+$/.test(p))
}

/**
 * Deja del nombre capturado solo lo que de verdad es nombre.
 *
 * Dictando SIN COMAS —que es como llega la voz, porque el reconocimiento casi
 * nunca las pone— el nombre se comia lo que venia detras: «orden para Cristina
 * millar de volantes» daba el cliente «Cristina millar», y encima la
 * descripcion del trabajo se quedaba en «de volantes».
 *
 * Se corta en la primera palabra que no puede ser nombre, y como mucho cuatro:
 * nadie dicta un nombre mas largo, y de ahi en adelante siempre es el trabajo.
 */
export function recortarNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const buenas: string[] = []

  for (const parte of partes) {
    if (buenas.length >= 4) break
    if (!esPalabraDeNombre(parte)) break

    // UN NOMBRE PROPIO VA EN MAYUSCULA, y esa es la pista mas fiable de donde
    // acaba cuando lo que sigue no es un producto sino un verbo: «Rosa me
    // encargó mil volantes» daba el cliente «Rosa me encargó», porque ni «me»
    // ni «encargó» estan —ni pueden estar— en ninguna lista de cosas.
    //
    // Solo aplica si la primera palabra ya venia en mayuscula. Dictando todo
    // en minusculas la regla se apaga sola y manda la lista, como antes.
    if (buenas.length > 0 && empiezaEnMayuscula(buenas[0]) && !empiezaEnMayuscula(parte)) break

    buenas.push(parte)
  }

  return buenas.join(' ')
}

function empiezaEnMayuscula(palabra: string): boolean {
  const inicial = palabra.charAt(0)
  return inicial !== '' && inicial === inicial.toUpperCase() && inicial !== inicial.toLowerCase()
}

/**
 * Deja el nombre presentable: «cristina neira» -> «Cristina Neira».
 *
 * El reconocimiento de voz devuelve los nombres en minuscula mas veces de las
 * que uno cree, y ese nombre se guarda tal cual en la lista de clientes.
 */
export function capitalizarNombre(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}
