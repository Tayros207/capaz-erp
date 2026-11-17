import { describe, expect, it } from 'vitest';
import { precioDeCatalogoSinIgv } from './catalogo.js';

describe('precioDeCatalogoSinIgv', () => {
  it('quita el IGV: 1.180 → 1.000', () => expect(precioDeCatalogoSinIgv(1180, true, 18)).toBe(1000));
  it('redondea la mitad hacia arriba: 100 → 85 (84,75)', () => expect(precioDeCatalogoSinIgv(100, true, 18)).toBe(85));
  it('un producto no afecto queda igual', () => expect(precioDeCatalogoSinIgv(1180, false, 18)).toBe(1180));
  it('con IGV 0 queda igual', () => expect(precioDeCatalogoSinIgv(1180, true, 0)).toBe(1180));
  it('el cero sigue en cero', () => expect(precioDeCatalogoSinIgv(0, true, 18)).toBe(0));
  it('rechaza lo que no es entero o es negativo', () => {
    expect(() => precioDeCatalogoSinIgv(1.5, true, 18)).toThrow(RangeError);
    expect(() => precioDeCatalogoSinIgv(-1, true, 18)).toThrow(RangeError);
    expect(() => precioDeCatalogoSinIgv(10, true, 101)).toThrow(RangeError);
  });
});
