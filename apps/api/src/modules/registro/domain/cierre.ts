import { CARACTERES_MINIMOS_DE_EXPLICACION, formatearSoles, type AjusteAnteriorAlCierreDto, type EstadoDeSemana, type SaldoDeCierreDto } from '@capaz/shared';

// Cierre semanal: reglas puras. Dinero en céntimos enteros; la diferencia es contado menos sistema.

/** Prefijo de `origen_ref` de las diferencias de caja que crea el cierre semanal (`cierre:<lunes>:<cuenta>`): solo el sistema lo escribe. */
export const PREFIJO_DE_CIERRE = 'cierre:';
export const LIKE_DE_CIERRE = `${PREFIJO_DE_CIERRE}%`;

export type DiferenciaDeCaja = { tipo: 'ingreso' | 'egreso'; montoCentimos: number };

export const diferenciaDe = (sistemaCentimos: number, contadoCentimos: number): number => contadoCentimos - sistemaCentimos;

/** Sobra dinero: ingreso; falta dinero: egreso. Sin diferencia no hay movimiento. */
export function movimientoDeDiferencia(diferenciaCentimos: number): DiferenciaDeCaja | null {
  if (diferenciaCentimos === 0) return null;
  return { tipo: diferenciaCentimos > 0 ? 'ingreso' : 'egreso', montoCentimos: Math.abs(diferenciaCentimos) };
}

/** La explicación de una diferencia cuenta sin los espacios de los extremos. */
export const explicacionSuficiente = (explicacion: string | undefined): boolean => (explicacion ?? '').trim().length >= CARACTERES_MINIMOS_DE_EXPLICACION;

/** `2026-11-16` → `16/11`. */
export const diaYMes = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
/** `2026-11-21` → `21/11/2026`. */
export const diaCompleto = (dia: string): string => `${diaYMes(dia)}/${dia.slice(0, 4)}`;

export const textoDeDiferencia = (diferenciaCentimos: number): string =>
  `${diferenciaCentimos < 0 ? 'Faltan' : 'Sobran'} ${formatearSoles(Math.abs(diferenciaCentimos))}`;

/** Descripción del movimiento de diferencia, cortada a 500 caracteres. */
export const descripcionDeDiferencia = (desde: string, hasta: string, explicacion: string): string =>
  `Diferencia de caja · semana ${diaYMes(desde)} al ${diaYMes(hasta)}: ${explicacion.trim()}`.slice(0, 500);

/** `cerrada` manda; después, por la fecha: futura, por cerrar (ya terminó) o en curso. */
export function estadoDeSemana(semana: { desde: string; hasta: string }, hoy: string, cerrada: boolean): EstadoDeSemana {
  if (cerrada) return 'cerrada';
  if (semana.desde > hoy) return 'futura';
  return semana.hasta <= hoy ? 'por_cerrar' : 'en_curso';
}

/**
 * Cuentas cuyo saldo al empezar la semana (saldo del sistema al sábado anterior) ya no es lo que se contó al cerrar esa
 * semana: alguien cargó después un movimiento con fecha dentro de ella. Máximo 50. Las cuentas sin conteo no cuentan.
 */
export function ajustesPosterioresACierre(
  cuentas: readonly { cuentaId: string; nombre: string; saldoInicialCentimos: number }[],
  saldosDelCierreAnterior: readonly SaldoDeCierreDto[],
): AjusteAnteriorAlCierreDto[] {
  const contados = new Map(saldosDelCierreAnterior.map((s) => [s.cuentaId, s.contadoCentimos]));
  return cuentas
    .flatMap((c) => {
      const contado = contados.get(c.cuentaId);
      if (contado === undefined || contado === c.saldoInicialCentimos) return [];
      return [{ cuentaId: c.cuentaId, nombre: c.nombre, contadoDelCierreCentimos: contado, saldoInicialCentimos: c.saldoInicialCentimos, diferenciaCentimos: c.saldoInicialCentimos - contado }];
    })
    .slice(0, 50);
}
