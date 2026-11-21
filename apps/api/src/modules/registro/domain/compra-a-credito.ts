import { sumarDias } from '@capaz/shared';

// Compra a crédito (F2-5): el plazo del proveedor decide cuándo vence la deuda por pagar que nace al recibir.

/** El día en que vence la compra recibida el `dia`, o `null` si el proveedor no tiene plazo (sin ficha o 0 días): la deuda queda como hoy. */
export function vencimientoDeCompra(dia: string, plazoEnDias: number | null | undefined): string | null {
  if (plazoEnDias === null || plazoEnDias === undefined || !Number.isInteger(plazoEnDias) || plazoEnDias <= 0) return null;
  return sumarDias(dia, plazoEnDias);
}

/** `AAAA-MM-DD` a `DD/MM/AAAA` para el resumen del borrador. */
export const diaParaResumen = (dia: string): string => dia.split('-').reverse().join('/');
