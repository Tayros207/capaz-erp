import { describe, expect, it } from 'vitest';
import { quitarIgv } from '@capaz/shared';
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

describe('quitarIgv (compartida)', () => {
  it('11800 → 10000; 10000 → 8475 (8474,58); mitad hacia arriba: 100 → 85', () => {
    expect(quitarIgv(11_800, 18)).toBe(10_000);
    expect(quitarIgv(10_000, 18)).toBe(8_475);
    expect(quitarIgv(100, 18)).toBe(85);
  });
  it('con IGV 0 queda igual y rechaza lo inválido', () => {
    expect(quitarIgv(500, 0)).toBe(500);
    expect(() => quitarIgv(1.5, 18)).toThrow(RangeError);
  });
});
