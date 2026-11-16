import { formatearSoles } from '@capaz/shared';
import type { TipoDeDeuda } from './codigos.js';
import { exigirCentimos, rechazada, type Regla } from './regla.js';

// Reglas de las cuentas por cobrar y por pagar (reglas 2 a 6 de la ficha). Todo en céntimos enteros.

export type EstadoDeDeuda = 'pendiente' | 'parcial' | 'pagada' | 'anulada';
export type EstadoAbierto = Exclude<EstadoDeDeuda, 'anulada'>;
export type SaldoDeDeuda = { estado: EstadoDeDeuda; totalCentimos: number; abonadoCentimos: number };

/** `pendiente` (nada abonado), `parcial` (algo) o `pagada` (todo). Lanza si los importes no cuadran. */
export function estadoDeDeuda(totalCentimos: number, abonadoCentimos: number): EstadoAbierto {
  exigirCentimos(totalCentimos, 'total');
  exigirCentimos(abonadoCentimos, 'abonado');
  if (totalCentimos <= 0) throw new RangeError('El total de una deuda es mayor que cero.');
  if (abonadoCentimos < 0 || abonadoCentimos > totalCentimos) throw new RangeError('Lo abonado no puede ser negativo ni superar el total.');
  if (abonadoCentimos === 0) return 'pendiente';
  return abonadoCentimos === totalCentimos ? 'pagada' : 'parcial';
}

export function saldoDeDeuda(totalCentimos: number, abonadoCentimos: number): number {
  estadoDeDeuda(totalCentimos, abonadoCentimos);
  return totalCentimos - abonadoCentimos;
}

/** Un abono a una deuda por cobrar es dinero que entra; a una por pagar, dinero que sale. */
export const tipoDeMovimientoDeAbono = (tipo: TipoDeDeuda): 'ingreso' | 'egreso' => (tipo === 'por_cobrar' ? 'ingreso' : 'egreso');

export type DespuesDeAbonar = { abonadoCentimos: number; saldoCentimos: number; estado: EstadoAbierto; quedaPagada: boolean };

/** Abonar: la deuda debe estar abierta y el monto no puede superar el saldo. No redondea ni reparte: suma exacta. */
export function aplicarAbono(deuda: SaldoDeDeuda, montoCentimos: number): Regla<DespuesDeAbonar> {
  exigirCentimos(montoCentimos, 'monto');
  if (montoCentimos <= 0) return rechazada('argumentos_invalidos', 'El monto debe ser mayor que cero.');
  if (deuda.estado === 'anulada') return rechazada('conflicto', 'Esa deuda está anulada: no admite abonos.');
  if (deuda.estado === 'pagada') return rechazada('conflicto', 'Esa deuda ya está pagada.');
  const saldo = saldoDeDeuda(deuda.totalCentimos, deuda.abonadoCentimos);
  if (montoCentimos > saldo) {
    return rechazada('conflicto', `El abono (${formatearSoles(montoCentimos)}) supera el saldo pendiente (${formatearSoles(saldo)}).`);
  }
  const abonadoCentimos = deuda.abonadoCentimos + montoCentimos;
  const estado = estadoDeDeuda(deuda.totalCentimos, abonadoCentimos);
  return { ok: true, abonadoCentimos, saldoCentimos: deuda.totalCentimos - abonadoCentimos, estado, quedaPagada: estado === 'pagada' };
}

export type DespuesDeRevertir = { abonadoCentimos: number; saldoCentimos: number; estado: EstadoDeDeuda };

/**
 * Al anular un abono, su monto vuelve al saldo y el estado se recalcula. Si el monto supera lo abonado, los datos
 * están rotos: se lanza (nunca se deja un abonado negativo). Una deuda anulada sigue anulada.
 */
export function revertirAbono(deuda: SaldoDeDeuda, montoCentimos: number): DespuesDeRevertir {
  exigirCentimos(montoCentimos, 'monto');
  if (montoCentimos <= 0) throw new RangeError('El monto que se revierte es mayor que cero.');
  if (montoCentimos > deuda.abonadoCentimos) throw new RangeError('El abono que se anula supera lo abonado en la deuda.');
  const abonadoCentimos = deuda.abonadoCentimos - montoCentimos;
  const estado = deuda.estado === 'anulada' ? 'anulada' : estadoDeDeuda(deuda.totalCentimos, abonadoCentimos);
  return { abonadoCentimos, saldoCentimos: deuda.totalCentimos - abonadoCentimos, estado };
}

/** Una deuda solo se anula sin abonos vivos (decisión D16: no se pregunta «devuelto o retenido»). */
export function puedeAnularseLaDeuda(deuda: Pick<SaldoDeDeuda, 'estado' | 'abonadoCentimos'>, abonosVivos: number): Regla {
  if (deuda.estado === 'anulada') return rechazada('conflicto', 'Esa deuda ya está anulada.');
  if (deuda.abonadoCentimos > 0 || abonosVivos > 0) {
    const n = Math.max(abonosVivos, 1);
    return rechazada('conflicto', n === 1 ? 'Anula primero su abono.' : `Anula primero sus ${n} abonos.`);
  }
  return { ok: true };
}

/** Una deuda anulada ya no se corrige: es un documento cerrado. */
export function puedeEditarseLaDeuda(estado: EstadoDeDeuda): Regla {
  return estado === 'anulada' ? rechazada('conflicto', 'Una deuda anulada no se edita.') : { ok: true };
}

/** El vencimiento no puede ser anterior a la fecha de la deuda (las fechas `AAAA-MM-DD` se comparan como texto). */
export function validarVencimiento(fecha: string, venceEn: string | null | undefined): Regla {
  if (venceEn != null && venceEn < fecha) return rechazada('argumentos_invalidos', 'El vencimiento no puede ser anterior a la fecha de la deuda.');
  return { ok: true };
}

/** Vencida: abierta (`pendiente` o `parcial`) y con vencimiento anterior a hoy. El día que vence todavía no lo está. */
export function estaVencida(deuda: { estado: EstadoDeDeuda; venceEn: string | null }, hoy: string): boolean {
  return (deuda.estado === 'pendiente' || deuda.estado === 'parcial') && deuda.venceEn !== null && deuda.venceEn < hoy;
}
