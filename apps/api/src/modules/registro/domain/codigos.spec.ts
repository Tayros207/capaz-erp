import { describe, expect, it } from 'vitest';
import { CLAVE_DE_MOVIMIENTO, claveDeDeuda, codigoDeDeuda, codigoDeMovimiento } from './codigos.js';

describe('códigos visibles (regla 1)', () => {
  it('el movimiento lleva seis cifras', () => {
    expect(codigoDeMovimiento(2026, 123)).toBe('MOV-2026-000123');
    expect(codigoDeMovimiento(2026, 1)).toBe('MOV-2026-000001');
    expect(codigoDeMovimiento(2027, 1234567)).toBe('MOV-2027-1234567');
  });

  it('la deuda lleva cuatro cifras y el prefijo de su tipo', () => {
    expect(codigoDeDeuda('por_cobrar', 2026, 1)).toBe('CXC-2026-0001');
    expect(codigoDeDeuda('por_pagar', 2026, 1)).toBe('CXP-2026-0001');
    expect(codigoDeDeuda('por_cobrar', 2026, 12345)).toBe('CXC-2026-12345');
  });

  it('rechaza años y números que no son correlativos', () => {
    expect(() => codigoDeMovimiento(2026, 0)).toThrow(RangeError);
    expect(() => codigoDeMovimiento(2026, 1.5)).toThrow(RangeError);
    expect(() => codigoDeMovimiento(26, 1)).toThrow(RangeError);
    expect(() => codigoDeDeuda('por_pagar', 2026, -3)).toThrow(RangeError);
  });

  it('cada documento tiene su clave de correlativo', () => {
    expect(CLAVE_DE_MOVIMIENTO).toBe('registro.movimiento');
    expect(claveDeDeuda('por_cobrar')).toBe('registro.deuda_por_cobrar');
    expect(claveDeDeuda('por_pagar')).toBe('registro.deuda_por_pagar');
  });
});
