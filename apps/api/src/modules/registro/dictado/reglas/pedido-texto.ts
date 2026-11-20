// REGLA NUEVA para dictar pedidos: ayudantes de texto y números. Porte adaptado de SF (features/ordenes/lib/dictado-orden.ts):
// `quitar` y `sinTildes` son literales de SF; `milesimasDeNumero` y `numeroAlInicio` son nuevos (lectura en milésimas, 3 decimales,
// comas de miles y números en palabras). Puro: solo importa de dictado/.
import { buscarMontoEnPalabras, valorPalabraNumero } from './numeros-en-palabras.js';

/** Quita tildes para comparar: en JS `\b` es ASCII y detrás de una vocal acentuada no hay frontera de palabra. */
export const sinTildes = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Quita `largo` caracteres desde `desde` y compacta los espacios. */
export function quitar(texto: string, desde: number, largo: number): string {
  return `${texto.slice(0, desde)} ${texto.slice(desde + largo)}`.replace(/\s{2,}/g, ' ').trim();
}

/** «0.365» -> 365, «1,000» -> 1000000, «90,50» -> 90500. Hasta 3 decimales; null si no es un número claro. */
export function milesimasDeNumero(crudo: string): number | null {
  let valor: number;
  if (/^[1-9]\d{0,2}(?:,\d{3})+$/.test(crudo)) {
    valor = Number(crudo.replace(/,/g, '')) * 1000;
  } else {
    const m = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(crudo);
    if (!m) return null;
    valor = Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'));
  }
  return Number.isSafeInteger(valor) ? valor : null;
}

const NUMERO_AL_INICIO = /^\s*([1-9]\d{0,2}(?:,\d{3})+|\d+(?:[.,]\d{1,3})?)(?![\d\p{L}])/u;

/** Un número al comienzo del texto, en cifras o en palabras. `fin` es donde acaba dentro del texto. */
export function numeroAlInicio(texto: string): { milesimas: number; fin: number } | null {
  const m = NUMERO_AL_INICIO.exec(texto);
  if (m) {
    const milesimas = milesimasDeNumero(m[1]!);
    return milesimas === null ? null : { milesimas, fin: m[0].length };
  }
  const fichas = [...texto.matchAll(/\p{L}+/gu)];
  const primera = fichas[0];
  if (!primera || texto.slice(0, primera.index).trim() !== '') return null;
  const valida = (f: RegExpMatchArray | undefined): boolean => f !== undefined && valorPalabraNumero(f[0]) !== null;
  let hasta = 0;
  for (let i = 0; i < fichas.length; i++) {
    const f = fichas[i]!;
    if (i > 0 && texto.slice(fichas[i - 1]!.index + fichas[i - 1]![0].length, f.index).trim() !== '') break;
    const esY = sinTildes(f[0]) === 'y' && i > 0 && hasta === i && valida(fichas[i + 1]);
    if (!valida(f) && !esY) break;
    hasta = i + 1;
  }
  if (hasta === 0) return null;
  const tramo = fichas.slice(0, hasta).map((f) => f[0]).join(' ');
  const monto = buscarMontoEnPalabras(`${tramo} soles`);
  if (!monto) return null;
  const ultima = fichas[hasta - 1]!;
  return { milesimas: monto.soles * 1000, fin: ultima.index + ultima[0].length };
}
