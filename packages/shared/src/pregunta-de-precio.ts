/**
 * Detecta la pregunta «¿cuánto le cobramos a X por Y?» (dictada o escrita) y separa el cliente del producto.
 * Devuelve `null` si el texto no es una pregunta de precio: así el dictado normal sigue su camino.
 */

export type PreguntaDePrecio = { clienteTexto: string; productoTexto: string };

/** Mismo largo que el original: quita tildes y pasa a minúsculas letra por letra para poder cortar el texto original. */
function plegar(texto: string): string {
  return Array.from(texto)
    .map((c) => c.normalize('NFD')[0]!.toLowerCase())
    .join('');
}

const VERBO = '(?:cobramos|cobre|cobro|cobraron|cobraste|cobrabamos|vendimos|vendi|facturamos|cotizamos|cobramos)';
const COLA = '(?:\\s+(?:la\\s+)?(?:ultima|anterior|pasada)\\s+vez)?[\\s?!.¿¡]*$';
const SEPARADORES_PRODUCTO = ['por', 'para', 'del', 'de', 'en'];
const SEPARADORES_CLIENTE = ['para', 'a'];

/** Trozos limpios (sin la cola de «la última vez») o `null` si alguno queda vacío. */
function limpiar(texto: string, desde: number, hasta: number): string | null {
  const t = texto.slice(desde, hasta).replace(/^[\s,;:¿¡"'«]+|[\s,;:?!.¡"'»]+$/g, '').trim();
  return t.length >= 2 ? t : null;
}

function cortar(original: string, plano: string, patron: string, orden: 'cliente-producto' | 'producto-cliente'): PreguntaDePrecio | null {
  const m = new RegExp(patron, 'd').exec(plano);
  const i1 = m?.indices?.[1];
  const i2 = m?.indices?.[2];
  if (!i1 || !i2) return null;
  const a = limpiar(original, i1[0], i1[1]);
  const b = limpiar(original, i2[0], i2[1]);
  if (!a || !b) return null;
  return orden === 'cliente-producto' ? { clienteTexto: a, productoTexto: b } : { clienteTexto: b, productoTexto: a };
}

export function detectarPreguntaDePrecio(texto: string): PreguntaDePrecio | null {
  if (typeof texto !== 'string') return null;
  const original = texto.trim();
  if (original.length < 8 || original.length > 300) return null;
  const plano = plegar(original);

  // «cuánto le cobramos a Cristina por las cajas de bocaditos (la última vez)»
  const cuanto = `(?:^|[\\s¿¡])(?:a\\s+)?cuanto\\s+(?:(?:se\\s+)?(?:le|les|lo|la)\\s+)?${VERBO}\\s+`;
  for (const sep of SEPARADORES_PRODUCTO) {
    const r = cortar(original, plano, `${cuanto}a\\s+(.+?)\\s+${sep}\\s+(.+?)${COLA}`, 'cliente-producto');
    if (r) return r;
  }
  // «a cuánto le vendimos las cajas de bocaditos a Cristina»
  for (const sep of SEPARADORES_CLIENTE) {
    const r = cortar(original, plano, `${cuanto}(?!a\\s)(.+?)\\s+${sep}\\s+(.+?)${COLA}`, 'producto-cliente');
    if (r) return r;
  }

  // «precio anterior de volantes para Imprenta Sur», «último precio de las cajas a Cristina»
  const precio = '(?:(?:el\\s+)?(?:ultimo|anterior|previo)\\s+precio|(?:el\\s+)?precio\\s+(?:anterior|previo|pasado))\\s+(?:de\\s+(?:la\\s+|las\\s+|los\\s+|el\\s+)?|del\\s+)';
  for (const sep of SEPARADORES_CLIENTE) {
    const r = cortar(original, plano, `(?:^|\\s)${precio}(.+?)\\s+${sep}\\s+(.+?)${COLA}`, 'producto-cliente');
    if (r) return r;
  }
  return null;
}
