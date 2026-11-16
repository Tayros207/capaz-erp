// Códigos visibles de los documentos del módulo y claves de sus correlativos (regla 1 de la ficha).
// En la base se guardan `numero` y `anio`; el código se arma aquí.

export type TipoDeDeuda = 'por_cobrar' | 'por_pagar';

export const CLAVE_DE_MOVIMIENTO = 'registro.movimiento';
export const claveDeDeuda = (tipo: TipoDeDeuda): string => (tipo === 'por_cobrar' ? 'registro.deuda_por_cobrar' : 'registro.deuda_por_pagar');

function exigirCorrelativo(anio: number, numero: number): void {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 9999) throw new RangeError(`Año de correlativo inválido: ${anio}.`);
  if (!Number.isInteger(numero) || numero < 1) throw new RangeError(`Número de correlativo inválido: ${numero}.`);
}

/** `MOV-2026-000123`: seis cifras (un número mayor conserva todas sus cifras). */
export function codigoDeMovimiento(anio: number, numero: number): string {
  exigirCorrelativo(anio, numero);
  return `MOV-${anio}-${String(numero).padStart(6, '0')}`;
}

/** `CXC-2026-0001` (por cobrar) o `CXP-2026-0001` (por pagar): cuatro cifras. */
export function codigoDeDeuda(tipo: TipoDeDeuda, anio: number, numero: number): string {
  exigirCorrelativo(anio, numero);
  return `${tipo === 'por_cobrar' ? 'CXC' : 'CXP'}-${anio}-${String(numero).padStart(4, '0')}`;
}
