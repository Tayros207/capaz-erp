import { hoyEnZona } from '../core/empresas/hoy.js';

// Fechas para las pruebas (no es código de producción). Se calculan al llamarlas, no al cargar el módulo, para que una
// prueba larga que cruce la medianoche no use un «hoy» viejo.

/** El día de hoy (zona de Lima), calculado en el momento de llamar. */
export const hoyDePrueba = (): string => hoyEnZona('America/Lima').dia;

/** Día de la empresa desplazado `n` días (negativo: hacia atrás). `desde` es hoy si no se indica. */
export function diaMas(n: number, desde: string = hoyDePrueba()): string {
  const f = new Date(`${desde}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}
