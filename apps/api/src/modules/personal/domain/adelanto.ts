import type { EstadoDeAdelanto } from '@capaz/shared';

// Reglas puras de los adelantos: código visible, fecha y anulación. Sin base ni framework.

/** Clave del correlativo (`core.contadores`); sin serie, por año. */
export const CLAVE_DE_ADELANTO = 'personal.adelanto';

/** `ADE-2026-0001`: cuatro cifras (un número mayor conserva todas las suyas). */
export function codigoDeAdelanto(anio: number, numero: number): string {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 9999) throw new RangeError(`Año de correlativo inválido: ${anio}.`);
  if (!Number.isInteger(numero) || numero < 1) throw new RangeError(`Número de correlativo inválido: ${numero}.`);
  return `ADE-${anio}-${String(numero).padStart(4, '0')}`;
}

export type Comprobacion = { ok: true } | { ok: false; motivo: string };

/** Un adelanto no se registra con fecha futura (días `AAAA-MM-DD`). */
export function comprobarFechaDeAdelanto(fecha: string, hoy: string): Comprobacion {
  return fecha > hoy ? { ok: false, motivo: 'La fecha del adelanto no puede ser futura.' } : { ok: true };
}

/** Solo un adelanto registrado se anula; uno ya anulado no. */
export function puedeAnularseElAdelanto(estado: EstadoDeAdelanto): Comprobacion {
  return estado === 'anulado' ? { ok: false, motivo: 'Ese adelanto ya está anulado.' } : { ok: true };
}
