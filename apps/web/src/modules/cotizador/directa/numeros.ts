// Números como los escribe una persona en la hoja Directa: «1.000.000», «0,42», «1,234.56», «12.50».
// Nunca se usa parseFloat: el resultado es un entero escalado (milésimas o céntimos), como el resto del sistema.

const SOLO_CIFRAS_Y_SEPARADORES = /^[\d.,]+$/;
/** Miles bien formados: de 1 a 3 cifras sin cero inicial y luego grupos de exactamente 3. */
const PRIMER_GRUPO = /^[1-9]\d{0,2}$/;

const contar = (texto: string, c: string): number => texto.split(c).length - 1;

/** Entero sin sus separadores de miles, o `null` si están mal puestos. */
function quitarMiles(entera: string, grupo: string): string | null {
  if (!entera.includes(grupo)) return /^\d*$/.test(entera) ? entera : null;
  const [primero = '', ...resto] = entera.split(grupo);
  return PRIMER_GRUPO.test(primero) && resto.every((g) => /^\d{3}$/.test(g)) ? primero + resto.join('') : null;
}

/**
 * ¿Qué carácter hace de decimal? `null` si no hay decimales; `'?'` si el texto no se entiende.
 * `unicoEsDecimal`: un solo separador (una sola vez) es siempre decimal, aunque lo sigan 3 cifras (regla del precio unitario).
 */
function marcaDecimal(texto: string, unicoEsDecimal = false): string | null {
  const punto = texto.includes('.');
  const coma = texto.includes(',');
  if (!punto && !coma) return null;
  // Con los dos presentes manda el último: «1,234.56» y «1.234,56» dicen lo mismo.
  if (punto && coma) return texto[Math.max(texto.lastIndexOf('.'), texto.lastIndexOf(','))] ?? '?';
  const unico = punto ? '.' : ',';
  if (contar(texto, unico) > 1) return null; // repetido: solo puede ser separador de miles
  if (unicoEsDecimal) return unico;
  const [antes = '', despues = ''] = texto.split(unico);
  // Uno solo seguido de exactamente 3 cifras («1.000», «12,500») es de miles; si no, decimal.
  return PRIMER_GRUPO.test(antes) && despues.length === 3 ? null : unico;
}

/**
 * Lo escrito → entero escalado a `maxDecimales` (3 para cantidad y precio, 2 para importe), o `null` si está vacío,
 * mal escrito, tiene más decimales de los admitidos o no cabe en un entero seguro. Los ceros de más a la derecha se admiten.
 */
export function leerDecimal(texto: string, maxDecimales: number, opciones: { unicoEsDecimal?: boolean } = {}): number | null {
  const limpio = texto.replace(/[\s  ]/g, '');
  if (limpio === '' || !SOLO_CIFRAS_Y_SEPARADORES.test(limpio)) return null;
  const marca = marcaDecimal(limpio, opciones.unicoEsDecimal);
  if (marca !== null && contar(limpio, marca) !== 1) return null;
  const [izquierda = '', fraccionBruta = ''] = marca === null ? [limpio] : limpio.split(marca);
  const grupo = marca === '.' ? ',' : marca === ',' ? '.' : limpio.includes(',') ? ',' : '.';
  const entera = quitarMiles(izquierda, grupo);
  if (entera === null || !/^\d*$/.test(fraccionBruta) || (izquierda === '' && fraccionBruta === '')) return null;
  const fraccion = fraccionBruta.replace(/0+$/, '');
  if (fraccion.length > maxDecimales) return null;
  const valor = BigInt((entera || '0') + fraccion.padEnd(maxDecimales, '0'));
  return valor > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(valor);
}

/**
 * El precio unitario (milésimas). En gráfica un unitario suele llevar 3 decimales («0.085», «1.250»), así que un separador
 * único, punto o coma, es SIEMPRE decimal: «1.250» es S/ 1.25 y nunca S/ 1250. Los miles solo valen repetidos («1.250.000»)
 * o con el otro separador como decimal («1,250.50»). Cantidad e importe siguen con `leerDecimal`.
 */
export const leerPrecio = (texto: string): number | null => leerDecimal(texto, 3, { unicoEsDecimal: true });

/**
 * Un entero escalado → texto para mostrar, con coma decimal y miles con punto («1.234,50»). Deja al menos `minDecimales`
 * y quita los ceros sobrantes. Es solo para mostrar lo calculado: no se vuelve a leer.
 */
export function textoDeDecimal(escalado: number, decimales: number, minDecimales = 0): string {
  const base = 10n ** BigInt(decimales);
  const valor = BigInt(escalado);
  const entera = (valor / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  let fraccion = (valor % base).toString().padStart(decimales, '0');
  while (fraccion.length > minDecimales && fraccion.endsWith('0')) fraccion = fraccion.slice(0, -1);
  return fraccion === '' ? entera : `${entera},${fraccion}`;
}
