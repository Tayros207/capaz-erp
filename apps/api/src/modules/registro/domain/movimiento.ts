import type { Aviso } from '@capaz/shared';
import { exigirCentimos, rechazada, type Regla } from './regla.js';

// Reglas de los movimientos de dinero (reglas 4, 6, 7, 8 y 9 de la ficha). Todo en céntimos enteros.

export type TipoDeMovimiento = 'ingreso' | 'egreso';

/** Fecha del movimiento: hoy si no llega; nunca futura (las fechas `AAAA-MM-DD` se comparan como texto). */
export function fechaDeMovimiento(fecha: string | undefined, hoy: string): Regla<{ fecha: string }> {
  if (fecha === undefined) return { ok: true, fecha: hoy };
  if (fecha > hoy) return rechazada('argumentos_invalidos', 'La fecha de un movimiento no puede ser futura.');
  return { ok: true, fecha };
}

/** Una cuenta archivada no recibe movimientos. */
export function cuentaUtilizable(cuenta: { nombre: string; archivadoEn: Date | null }): Regla {
  return cuenta.archivadoEn ? rechazada('conflicto', `La cuenta «${cuenta.nombre}» está archivada.`) : { ok: true };
}

/** La categoría debe ser del mismo tipo que el movimiento y estar en uso. */
export function categoriaUtilizable(tipo: TipoDeMovimiento, categoria: { nombre: string; tipo: string; archivadoEn: Date | null }): Regla {
  if (categoria.tipo !== tipo) {
    return rechazada('argumentos_invalidos', `La categoría «${categoria.nombre}» es de ${categoria.tipo}s: no sirve para un ${tipo}.`);
  }
  return categoria.archivadoEn ? rechazada('conflicto', `La categoría «${categoria.nombre}» está archivada.`) : { ok: true };
}

/** Solo se anula un movimiento activo. */
export function puedeAnularseElMovimiento(estado: string): Regla {
  return estado === 'activo' ? { ok: true } : rechazada('conflicto', 'Ese movimiento ya está anulado.');
}

/** Saldo de una cuenta = saldo inicial + ingresos activos − egresos activos. */
export function saldoDeCuenta(saldoInicialCentimos: number, ingresosCentimos: number, egresosCentimos: number): number {
  for (const [v, n] of [[saldoInicialCentimos, 'saldo inicial'], [ingresosCentimos, 'ingresos'], [egresosCentimos, 'egresos']] as const) exigirCentimos(v, n);
  if (ingresosCentimos < 0 || egresosCentimos < 0) throw new RangeError('Los ingresos y los egresos se suman en positivo.');
  const saldo = saldoInicialCentimos + ingresosCentimos - egresosCentimos;
  exigirCentimos(saldo, 'saldo');
  return saldo;
}

/** Importe con signo: los egresos restan. */
export const montoConSigno = (tipo: TipoDeMovimiento, montoCentimos: number): number => (tipo === 'ingreso' ? montoCentimos : -montoCentimos);

/** Un egreso que deja la cuenta en negativo se permite, con aviso. */
export function avisoDeSaldoNegativo(tipo: TipoDeMovimiento, nombreDeCuenta: string, saldoCentimos: number): Aviso | null {
  if (tipo !== 'egreso' || saldoCentimos >= 0) return null;
  return { codigo: 'saldo_negativo', nivel: 'comercial', mensaje: `La cuenta «${nombreDeCuenta}» queda con saldo negativo.` };
}
