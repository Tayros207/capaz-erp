import { formatearSoles } from '@capaz/shared';
import { estadoDeDeuda, type EstadoAbierto } from './deuda.js';
import { exigirCentimos, rechazada, type Regla } from './regla.js';

// Ajuste del total de una deuda (corregir una venta ya confirmada). Lo ya abonado NO se toca. Si el cliente pagó de más,
// el exceso queda A SU FAVOR (no se devuelve ni se crea una deuda por pagar: es solo una adaptación contable interna).

export type ResultadoDelAjuste = {
  /** Total de la deuda tras el ajuste: el pedido corregido, o lo abonado si el cliente ya pagó más que eso. */
  totalNuevoCentimos: number;
  /** `totalNuevo − totalActual`, con signo. */
  montoCentimos: number;
  /** Lo pagado de más (0 si no hay): total del pedido = total de la deuda − a favor. */
  aFavorCentimos: number;
  estado: EstadoAbierto;
  /** El ajuste no cambia nada (mismo total y mismo excedente). */
  sinCambio: boolean;
};

/**
 * `nuevoTotalCentimos` es el total que debe tener la venta. Cero (o menos) se rechaza: para dejarla sin valor se anula la deuda.
 * Respeta los CHECK de la base: total > 0 y abonado ≤ total; por eso la deuda nunca baja de lo abonado y queda pagada.
 */
export function calcularAjuste(deuda: { totalCentimos: number; abonadoCentimos: number }, nuevoTotalCentimos: number, aFavorActualCentimos: number): Regla<ResultadoDelAjuste> {
  exigirCentimos(nuevoTotalCentimos, 'nuevo total');
  if (nuevoTotalCentimos <= 0) return rechazada('argumentos_invalidos', 'El total no puede quedar en cero: para dejar la deuda sin valor, anúlala.');
  const aFavorCentimos = Math.max(0, deuda.abonadoCentimos - nuevoTotalCentimos);
  const totalNuevoCentimos = Math.max(nuevoTotalCentimos, deuda.abonadoCentimos);
  return {
    ok: true,
    totalNuevoCentimos,
    montoCentimos: totalNuevoCentimos - deuda.totalCentimos,
    aFavorCentimos,
    estado: estadoDeDeuda(totalNuevoCentimos, deuda.abonadoCentimos),
    sinCambio: totalNuevoCentimos === deuda.totalCentimos && aFavorCentimos === aFavorActualCentimos,
  };
}

/** `pedido:<id>:v<n>` (la referencia con que «Corregir venta» y su respaldo ajustan la deuda) → pedido y versión; `null` si es otra cosa. */
export function versionDePedidoEnReferencia(ref: string | null | undefined): { pedidoId: string; version: number } | null {
  const m = /^pedido:([0-9a-f-]{36}):v(\d{1,7})$/.exec(ref ?? '');
  return m ? { pedidoId: m[1]!, version: Number(m[2]) } : null;
}

/** La frase que explica un ajuste. */
export const frasesDeAjuste = (a: Pick<ResultadoDelAjuste, 'aFavorCentimos'> & { totalAnteriorCentimos: number; totalNuevoCentimos: number }): string =>
  `Total de la deuda ${formatearSoles(a.totalAnteriorCentimos)} → ${formatearSoles(a.totalNuevoCentimos)}${a.aFavorCentimos > 0 ? `; a favor del cliente ${formatearSoles(a.aFavorCentimos)}` : ''}`;
