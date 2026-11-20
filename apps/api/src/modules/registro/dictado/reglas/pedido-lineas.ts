// Porte adaptado de SF (features/ordenes/lib/dictado-orden.ts:333-440), con otra forma de salida: cada trozo de la frase da una
// LÍNEA de pedido (cantidad y precio en milésimas) en vez de un `TrabajoSimple`. Cambios respecto a SF:
//  - `quitarEtiquetas` es literal; `descripcionAlrededor` es el cuerpo de `trabajoConImporte` devolviendo solo la descripción.
//  - Cada trozo se lee de dos maneras (unitaria «500 a 0.365» o trabajo entero «banner 90»), con `duda` cuando es ambiguo.
//  - Los decimales llegan a 3 cifras (SF cortaba «0.365» en 0.36), la «y» de «ciento cuarenta y cinco» no parte la frase
//    y un número al inicio sin precio da una línea `sin_precio` en vez de un trabajo de S/ 500.
import { buscarMontoEnPalabras } from './numeros-en-palabras.js';
import { milesimasDeNumero, numeroAlInicio, sinTildes } from './pedido-texto.js';

export type UnidadDictada = 'unidad' | 'millar' | 'docena';
export type LineaDictada = {
  descripcion: string;
  unidad: UnidadDictada;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number | null;
  forma: 'unitario' | 'entero';
  duda: 'sin_precio' | 'total_o_unitario' | null;
};

const MARCA = String.raw`(cada\s+(?:una?|uno|millar|docena)|c\/u|la\s+unidad|por\s+unidad|el\s+millar|por\s+millar|la\s+docena|por\s+docena)`;
const RE_PRECIO_A = new RegExp(String.raw`^(.+?)\s+a\s+(?:s\/\.?\s*)?(\d+(?:[.,]\d{1,3})?)\s*(?:soles?)?\s*${MARCA}?\s*$`, 'i');
const FACTOR: Record<UnidadDictada, number> = { unidad: 1, docena: 12, millar: 1000 };
const RE_CIFRA = /(?<![\p{L}\d])(\d+(?:[.,]\d{1,3})?)(?![\p{L}\d])\s*(?:soles?)?/giu;
const DECENAS = '(?:treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)';
const RE_PARTIR = new RegExp(
  String.raw`(?<!${DECENAS})\s+(?:y|e)\s+|(?<=${DECENAS})\s+(?:y|e)\s+(?!(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b)`,
  'i',
);

const tieneImporte = (t: string): boolean => /(?<![\p{L}\d])\d+(?:[.,]\d{1,3})?(?![\p{L}\d])/u.test(t) || buscarMontoEnPalabras(t) !== null;

/**
 * Quita las etiquetas del formulario que se cuelan al dictar leyendo la pantalla: «trabajo a realizar millar de volantes, valor 240».
 * Solo las etiquetas COMPLETAS, nunca la palabra suelta («trabajo de imprenta» es una descripción real).
 */
export function quitarEtiquetas(t: string): string {
  return t
    .replace(/^\s*(?:el\s+)?trabajo\s+a\s+realizar\s*[:,-]?\s*/i, '')
    .replace(/^\s*(?:la\s+)?descripci[oó]n\s*[:,-]?\s*/i, '')
    .replace(/[\s,;.:-]*(?:el\s+)?valor(?:\s+del\s+trabajo)?\s*[:,-]?\s*$/i, '')
    .replace(/[\s,;.:-]*(?:el\s+)?precio\s*[:,-]?\s*$/i, '')
    .replace(/^[\s,;.:-]+|[\s,;.:-]+$/g, '')
    .trim();
}

/** Se parte SOLO por «y»/«e» (nunca por comas), salvo la «y» de un número en palabras («ciento cuarenta y cinco»). */
export function partirEnTrozos(t: string): string[] {
  return t.split(RE_PARTIR);
}

/** La cantidad con que empieza el trozo y su unidad de conteo (millar, docena). null si lo que hay es un importe. */
export function cantidadAlInicio(t: string): { cantidadMilesimas: number; unidad: UnidadDictada; resto: string } | null {
  const n = numeroAlInicio(t);
  let resto = n ? t.slice(n.fin) : t;
  if (n && /^\s*(?:soles?|s\/)/i.test(sinTildes(resto))) return null;
  let unidad: UnidadDictada = 'unidad';
  const u = /^\s*(millar(?:es)?|docenas?)\b\s*(?:de\s+)?/i.exec(sinTildes(resto));
  if (u) {
    unidad = u[1]!.startsWith('m') ? 'millar' : 'docena';
    resto = resto.slice(u[0].length);
  }
  const cantidadMilesimas = n ? n.milesimas : u ? 1000 : null;
  if (cantidadMilesimas === null || !/\p{L}/u.test(resto)) return null;
  return { cantidadMilesimas, unidad, resto: resto.trim() };
}

type Cantidad = NonNullable<ReturnType<typeof cantidadAlInicio>>;

/** Lectura unitaria «N cosas a P». null si no es segura (entonces manda la lectura de trabajo entero). */
function porUnidad(c: Cantidad, m: RegExpExecArray): LineaDictada | null {
  const precio = milesimasDeNumero(m[2]!);
  if (precio === null || precio <= 0) return null;
  const marcaTexto = sinTildes(m[3] ?? '');
  const marca: UnidadDictada | null = !marcaTexto ? null : marcaTexto.includes('millar') ? 'millar' : marcaTexto.includes('docena') ? 'docena' : 'unidad';
  const precioPor: UnidadDictada = marca ?? (c.unidad !== 'unidad' && precio < 1000 ? 'unidad' : c.unidad);
  let cantidad = c.cantidadMilesimas;
  if (precioPor !== c.unidad) {
    const unidades = c.cantidadMilesimas * FACTOR[c.unidad];
    if (unidades % FACTOR[precioPor] !== 0) return null;
    cantidad = unidades / FACTOR[precioPor];
  }
  const descripcion = quitarEtiquetas(m[1]!.replace(/^(?:(?:de|del)\s+)+/i, '')).trim();
  if (!descripcion) return null;
  const segura = marca !== null || precioPor !== 'unidad' || precio < 1000 || cantidad === 1000;
  if (!segura) return null;
  return { descripcion, unidad: precioPor, cantidadMilesimas: cantidad, precioUnitarioMilesimas: precio, forma: 'unitario', duda: null };
}

/** Separa la descripción de su importe sabiendo dónde está el importe dentro del trozo (puede ir antes o después). */
function descripcionAlrededor(limpio: string, desde: number, hasta: number): string | null {
  const antes = quitarEtiquetas(
    limpio
      .slice(0, desde)
      .replace(/\b(?:a|en|por)\s*$/i, '')
      .replace(/^(?:\s*(?:de|del|por|para|en|con|un|una|unos|unas|el|la|los|las)\s+)+/i, '')
      .replace(/[\s,;.:]+$/g, '')
      .trim(),
  );
  const despues = quitarEtiquetas(
    limpio
      .slice(hasta)
      .replace(/^[\s,;.:]*(?:\b(?:de|del|por|para|en|con)\b\s+)?(?:\b(?:un|una|unos|unas|el|la|los|las)\b\s+)?/i, '')
      .trim(),
  );
  const soloConector = /^(?:de|del|por|para|en|con|a|y|soles?)?$/i.test(antes);
  return (soloConector ? despues : antes) || null;
}

/** Lectura de trabajo entero (SF): la ÚLTIMA cifra es el valor del trabajo; cantidad 1 unidad. */
function lineaEntera(limpio: string): LineaDictada | null {
  const cifras = [...limpio.matchAll(RE_CIFRA)];
  const ultima = cifras[cifras.length - 1];
  let valor: number | null;
  let desde: number;
  let hasta: number;
  if (ultima?.index !== undefined) {
    valor = milesimasDeNumero(ultima[1]!);
    desde = ultima.index;
    hasta = ultima.index + ultima[0].length;
  } else {
    const palabras = buscarMontoEnPalabras(limpio);
    if (!palabras) return null;
    valor = palabras.soles * 1000;
    desde = palabras.inicio;
    hasta = palabras.fin;
  }
  if (valor === null || valor <= 0) return null;
  const descripcion = descripcionAlrededor(limpio, desde, hasta);
  if (!descripcion) return null;
  return { descripcion, unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: valor, forma: 'entero', duda: null };
}

/** Un trozo de frase -> una línea de pedido. */
export function trozoALinea(trozo: string): LineaDictada | null {
  const limpio = trozo.replace(/^[\s,;.:]+|[\s,;.:]+$/g, '').replace(/^(?:(?:de|del|para|por|con)\s+)+/i, '');
  if (!limpio) return null;
  const c = cantidadAlInicio(limpio);
  const m = c ? RE_PRECIO_A.exec(c.resto) : null;
  if (c && m) {
    const unitaria = porUnidad(c, m);
    if (unitaria) return unitaria;
    const entera = lineaEntera(limpio);
    return entera ? { ...entera, duda: 'total_o_unitario' } : null;
  }
  if (c && !tieneImporte(c.resto)) {
    return {
      descripcion: quitarEtiquetas(c.resto),
      unidad: c.unidad,
      cantidadMilesimas: c.cantidadMilesimas,
      precioUnitarioMilesimas: null,
      forma: 'unitario',
      duda: 'sin_precio',
    };
  }
  return lineaEntera(limpio);
}
