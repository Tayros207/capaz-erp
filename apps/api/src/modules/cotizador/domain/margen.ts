// Margen de una cotización con el motor (`calcularMargen`): (subtotal − costo) / subtotal × 100. Puro.
import { centimosAImporte } from './adaptador-de-dinero.js';
import { aTexto, DECIMALES_PORCENTAJE } from './motor/base/dinero.js';
import { calcularMargen } from './motor/costeo/calcular-cotizacion.js';

/** El tope de la columna `margen_pct` (numeric(7,3)). */
const TOPE = 9999;

/** `'35.00'`; `null` si no hay costo o el subtotal no es positivo. Un margen fuera de ±9999 se recorta al tope. */
export function margenDe(subtotalCentimos: number, costoCentimos: number | null): string | null {
  if (costoCentimos === null) return null;
  const m = calcularMargen(centimosAImporte(subtotalCentimos), centimosAImporte(costoCentimos));
  if (!m) return null;
  const n = Number(aTexto(m.mostradoPct, DECIMALES_PORCENTAJE));
  return (n > TOPE ? TOPE : n < -TOPE ? -TOPE : n).toFixed(DECIMALES_PORCENTAJE);
}

/** ¿Queda por debajo del mínimo configurado? (Emitir entonces exige un motivo.) */
export const margenBajoElMinimo = (margenPct: string, umbralMinimoPct: string): boolean => Number(margenPct) < Number(umbralMinimoPct);
