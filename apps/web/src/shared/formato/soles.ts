import { aCentimos, formatearSoles, type Centimos } from '@capaz/shared';

export { formatearSoles };

/** `123450` → `1,234.50` (sin el símbolo: lo usa el campo de monto, que ya muestra «S/»). */
export function centimosATexto(valor: Centimos): string {
  return formatearSoles(valor).replace(/^(-?)S\/ /, '$1');
}

/**
 * Lo que escribe una persona → céntimos, o nulo si no es un monto válido. Acepta `S/`, comas de
 * miles y espacios; hasta dos decimales. El texto vacío es nulo.
 */
export function textoACentimos(texto: string): Centimos | null {
  const limpio = texto.replace(/^\s*(-?)\s*S\/\.?\s*/i, '$1').replace(/,/g, '').trim();
  if (limpio === '') return null;
  try {
    return aCentimos(limpio);
  } catch {
    return null;
  }
}
