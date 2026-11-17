import { describe, expect, it } from 'vitest';
import { margenBajoElMinimo, margenDe } from './margen.js';

describe('margenDe', () => {
  it('(subtotal − costo) / subtotal × 100 con 2 decimales', () => {
    expect(margenDe(34_638, 22_515)).toBe('35.00'); // 346.38 con costo 225.15
    expect(margenDe(10_000, 7_000)).toBe('30.00');
    expect(margenDe(10_000, 10_000)).toBe('0.00');
    expect(margenDe(10_000, 12_500)).toBe('-25.00');
  });

  it('sin costo o con subtotal en cero no hay margen', () => {
    expect(margenDe(10_000, null)).toBeNull();
    expect(margenDe(0, 100)).toBeNull();
  });

  it('un costo enorme recorta al tope de la columna', () => {
    expect(margenDe(1, 1_000_000_000)).toBe('-9999.00');
  });

  it('compara con el umbral mínimo', () => {
    expect(margenBajoElMinimo('14.99', '15.000')).toBe(true);
    expect(margenBajoElMinimo('15.00', '15.000')).toBe(false);
    expect(margenBajoElMinimo('-5.00', '15.000')).toBe(true);
  });
});
