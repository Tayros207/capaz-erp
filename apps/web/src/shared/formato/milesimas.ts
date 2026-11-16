// Cantidades y precios unitarios en milésimas enteras (ADR-012): 12.5 se guarda como 12500.

const NUMERO = /^\d+(\.\d{1,3})?$/;

/** «S/ 1,234.5» o «1,234.5» → 1234500 milésimas; nulo si no es válido (hasta 3 decimales, sin negativos). Vacío es nulo. */
export function textoAMilesimas(texto: string): number | null {
  const limpio = texto.replace(/^\s*S\/\.?\s*/i, '').replace(/,/g, '').trim();
  if (!NUMERO.test(limpio)) return null;
  const [enteros = '0', decimales = ''] = limpio.split('.');
  const valor = Number(enteros) * 1000 + Number(decimales.padEnd(3, '0'));
  return Number.isSafeInteger(valor) ? valor : null;
}

/** 12500 → «12.50»; 12505 → «12.505» (los tres decimales solo si hacen falta). */
export function milesimasATexto(milesimas: number): string {
  const enteros = Math.trunc(milesimas / 1000);
  const decimales = String(milesimas % 1000).padStart(3, '0');
  const conComas = enteros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${conComas}.${decimales.endsWith('0') ? decimales.slice(0, 2) : decimales}`;
}

/** Una cantidad sin ceros sobrantes, con su unidad: 12000 → «12»; 12500, «m» → «12.5 m»; 1234567 → «1,234.567». */
export function formatearCantidad(milesimas: number, unidad?: string): string {
  const enteros = Math.trunc(milesimas / 1000);
  const decimales = String(milesimas % 1000).padStart(3, '0').replace(/0+$/, '');
  const conComas = enteros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const numero = decimales ? `${conComas}.${decimales}` : conComas;
  return unidad?.trim() ? `${numero} ${unidad.trim()}` : numero;
}
