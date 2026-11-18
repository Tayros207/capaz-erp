/**
 * ¿Dos descripciones de producto son lo mismo?
 *
 * Misma idea que la comparación de nombres de contactos de SF: la descripción corta tiene que caber ENTERA en la larga,
 * comparando token por token con su sonido y no con su ortografía. Si no cabe, el parecido de letras solo sirve para
 * ordenar y tiene un techo que nunca lo hace pasar por «misma descripción».
 *
 * Ajustes propios de productos: se ignoran artículos, preposiciones, «x» y unidades de conteo (millar, ciento, und,
 * docena, pza); el plural se lleva al singular («cajas» → «caja»); un número suelto es una cantidad y se descarta, pero
 * «a4», «150g» o «20x20» se conservan (son parte del producto).
 */

/** Desde aquí es «misma descripción». Solo se alcanza si la corta cabe entera en la larga. */
export const UMBRAL_MISMA_DESCRIPCION = 0.75;
/** Desde aquí se muestra como «parecida» (solo en el historial, nunca como último precio). */
export const UMBRAL_PARECIDA = 0.55;
/** Techo de un par que NO cumple la contención. */
const TECHO_SIN_ESTRUCTURA = 0.74;
const MAX_CARACTERES = 200;
const MAX_TOKENS = 16;
const MINIMO_TOKEN_IDENTIFICABLE = 3;

export type Coincidencia = 'misma_descripcion' | 'parecida';

const RUIDO = new Set([
  'de', 'del', 'la', 'las', 'lo', 'los', 'el', 'un', 'una', 'unos', 'unas', 'al', 'a', 'o', 'y', 'e', 'u',
  'para', 'por', 'con', 'sin', 'en', 'x',
  // unidades de conteo
  'millar', 'millares', 'ciento', 'cientos', 'cien', 'und', 'unds', 'unid', 'unidad', 'unidades', 'docena', 'docenas', 'pza', 'pzas', 'pieza', 'piezas',
]);

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** «caja» ← «cajas»; la «e» final se ignora al comparar para que «sobres» y «sobre», «papeles» y «papel» coincidan. */
function singular(t: string): string {
  const s = t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;
  return s.length >= 5 && s.endsWith('e') ? s.slice(0, -1) : s;
}

function tokensDe(texto: string): string[] {
  if (typeof texto !== 'string') return [];
  const limpio = sinTildes(texto.slice(0, MAX_CARACTERES))
    // «20 x 20» y «20×20» son una medida; «150 gr» y «150 g» son lo mismo.
    .replace(/(\d)\s*[x×]\s*(?=\d)/g, '$1x')
    .replace(/(\d)\s*(?:grs|gr|g)\b/g, '$1g')
    .replace(/(\d)\s*(?:cms|cm)\b/g, '$1cm')
    .replace(/(\d)\s*(?:mms|mm)\b/g, '$1mm');
  return limpio
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !RUIDO.has(t) && !/^\d+$/.test(t))
    .map(singular)
    .filter((t) => t.length > 1)
    .slice(0, MAX_TOKENS);
}

/** La descripción reducida a lo comparable. `''` si no queda nada. */
export function normalizarDescripcion(texto: string): string {
  return tokensDe(texto).join(' ');
}

/** Cómo suena el token (b/v, c/s/z, h muda, ll/y). Los tokens con dígitos se dejan tal cual: «a4» no es «a»+«4». */
function claveFonetica(token: string): string {
  if (/\d/.test(token)) return token;
  return token
    .replace(/ch(?=[bcdfgjklmnpqrstvwxyz])/g, 'k')
    .replace(/ch/g, '1')
    .replace(/qu/g, 'k')
    .replace(/gu([ei])/g, 'g$1')
    .replace(/g([ei])/g, 'j$1')
    .replace(/c([ei])/g, 's$1')
    .replace(/[cq]/g, 'k')
    .replace(/z/g, 's')
    .replace(/ll/g, 'y')
    .replace(/y/g, 'i')
    .replace(/[vw]/g, 'b')
    .replace(/h/g, '')
    .replace(/1/g, 'ch')
    .replace(/(.)\1+/g, '$1');
}

const clavesDe = (texto: string): string[] => tokensDe(texto).map(claveFonetica);

function clavesComunes(a: string[], b: string[]): string[] {
  const disponibles = [...b];
  const comunes: string[] = [];
  for (const clave of a) {
    const i = disponibles.indexOf(clave);
    if (i !== -1) {
      comunes.push(clave);
      disponibles.splice(i, 1);
    }
  }
  return comunes;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      siguiente[j] = Math.min((fila[j] ?? 0) + 1, (siguiente[j - 1] ?? 0) + 1, (fila[j - 1] ?? 0) + costo);
    }
    fila = siguiente;
  }
  return fila[b.length] ?? 0;
}

function parecidoDeTexto(a: string, b: string): number {
  const largo = Math.max(a.length, b.length);
  return largo === 0 ? 0 : 1 - levenshtein(a, b) / largo;
}

const redondear = (valor: number): number => Math.round(valor * 1000) / 1000;

/**
 * Qué tan parecidas son dos descripciones, de 0 a 1. Simétrica.
 * ≥ 0,75 solo si la corta cabe entera en la larga (y algo de lo compartido identifica: ≥ 3 caracteres o lleva un dígito);
 * por debajo queda el parecido de letras, con techo 0,74.
 */
export function similitudDeDescripciones(a: string, b: string): number {
  const clavesA = clavesDe(a);
  const clavesB = clavesDe(b);
  if (clavesA.length === 0 || clavesB.length === 0) return 0;
  const comunes = clavesComunes(clavesA, clavesB);
  const cobertura = comunes.length / Math.min(clavesA.length, clavesB.length);
  const proporcion = comunes.length / Math.max(clavesA.length, clavesB.length);
  const identifica = comunes.some((c) => c.length >= MINIMO_TOKEN_IDENTIFICABLE || /\d/.test(c));
  const estructural = cobertura === 1 && identifica ? UMBRAL_MISMA_DESCRIPCION + (1 - UMBRAL_MISMA_DESCRIPCION) * proporcion : 0;
  const textual = Math.min(parecidoDeTexto([...clavesA].sort().join(' '), [...clavesB].sort().join(' ')), TECHO_SIN_ESTRUCTURA);
  return redondear(Math.max(estructural, textual));
}

/** `null` si no alcanza ni para «parecida». */
export function coincidenciaDeDescripcion(puntaje: number): Coincidencia | null {
  if (puntaje >= UMBRAL_MISMA_DESCRIPCION) return 'misma_descripcion';
  if (puntaje >= UMBRAL_PARECIDA) return 'parecida';
  return null;
}

/**
 * Trozos con los que prefiltrar en SQL antes de puntuar en memoria: el arranque de cada token tal como se escribe y el de
 * su clave fonética, ya sin tildes y con b/v, s/z/c y h muda plegadas igual que lo hace el SQL del servidor.
 */
export function raicesDeBusqueda(texto: string, largo = 3, maximo = 12): string[] {
  const raices = new Set<string>();
  for (const token of tokensDe(texto)) {
    if (/^\d+$/.test(token)) continue;
    const plegado = plegarParaBuscar(token);
    if (plegado.length >= largo) raices.add(plegado.slice(0, largo));
    const clave = plegarParaBuscar(claveFonetica(token));
    if (clave.length >= largo) raices.add(clave.slice(0, largo));
  }
  return [...raices].slice(0, maximo);
}

/** Plegado simple (v/w→b, z→s, sin h) que el servidor aplica igual a la descripción guardada con `translate`. */
export function plegarParaBuscar(texto: string): string {
  return sinTildes(texto).replace(/[vw]/g, 'b').replace(/z/g, 's').replace(/h/g, '');
}
