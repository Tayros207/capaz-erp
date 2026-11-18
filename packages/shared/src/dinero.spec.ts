import { describe, expect, it } from 'vitest';
import { aCentimos, centimosSchema, formatearSoles, importe, milesimasSchema } from './dinero.js';

describe('aCentimos', () => {
  it.each([
    ['1234.50', 123450],
    ['0.05', 5],
    ['12', 1200],
    ['12.5', 1250],
    ['-3.10', -310],
    [' 1 000.00 ', 100000],
  ])('convierte %s en %i céntimos', (texto, esperado) => {
    expect(aCentimos(texto)).toBe(esperado);
  });

  it.each(['', '1,234.50', '1.234', 'abc', '1.', '.5', '--1'])('rechaza «%s»', (texto) => {
    expect(() => aCentimos(texto)).toThrow(RangeError);
  });

  it('no pierde precisión con montos grandes', () => {
    expect(aCentimos('90071992547409.91')).toBe(9007199254740991);
    expect(() => aCentimos('90071992547409.92')).toThrow();
  });

  it('evita el error clásico de los decimales binarios', () => {
    expect(aCentimos('0.10') + aCentimos('0.20')).toBe(aCentimos('0.30'));
  });
});

describe('formatearSoles', () => {
  it.each([
    [123450, 'S/ 1,234.50'],
    [0, 'S/ 0.00'],
    [5, 'S/ 0.05'],
    [100000000, 'S/ 1,000,000.00'],
    [-310, '-S/ 3.10'],
  ])('%i → %s', (c, esperado) => {
    expect(formatearSoles(c)).toBe(esperado);
  });

  it('rechaza valores con decimales o no seguros', () => {
    expect(() => formatearSoles(10.5)).toThrow();
    expect(() => formatearSoles(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});

describe('centimosSchema', () => {
  it('solo acepta enteros seguros', () => {
    expect(centimosSchema.safeParse(100).success).toBe(true);
    expect(centimosSchema.safeParse(1.5).success).toBe(false);
    expect(centimosSchema.safeParse('100').success).toBe(false);
  });
});

describe('importe', () => {
  it.each([
    [1000, 1000, 100], // 1 unidad × 1 sol = 100 céntimos
    [2500, 12_340, 3085], // 2.5 × 12.34 = 30.85
    [1000, 5, 1], // 0.005 sol = 0.5 céntimos: mitad hacia arriba
    [1000, 4, 0], // 0.4 céntimos
    [1000, 14, 1], // 1.4 → 1
    [1000, 15, 2], // 1.5 → 2
    [0, 99_999, 0],
    [-1000, 5, 0], // -0.5 → 0 (mitad hacia arriba)
    [-1000, 15, -1], // -1.5 → -1
    [-1000, 16, -2], // -1.6 → -2
  ])('importe(%i, %i) = %i céntimos', (cantidad, precio, esperado) => {
    expect(importe(cantidad, precio)).toBe(esperado);
  });

  it('no pierde precisión con montos grandes', () => {
    // 90 000 000 000 000 unidades × 1 sol: el producto excede 2^53 pero el resultado cabe.
    expect(importe(90_000_000_000_000, 10_000)).toBe(90_000_000_000_000);
    expect(importe(9_007_199_254_740_991, 1000)).toBe(900_719_925_474_099); // 9 007 199 254 740 991 / 10 = ...099.1
  });

  it('rechaza lo que no es entero seguro', () => {
    expect(() => importe(1.5, 1000)).toThrow();
    expect(() => importe(1000, Number.NaN)).toThrow();
  });

  it('milesimasSchema exige enteros seguros', () => {
    expect(milesimasSchema.safeParse(1500).success).toBe(true);
    expect(milesimasSchema.safeParse(1.5).success).toBe(false);
  });
});

import { ponerIgv } from './dinero.js';
import { quitarIgv } from './contratos/cotizador.js';

describe('ponerIgv', () => {
  it('suma el IGV con mitad hacia arriba y es la inversa de quitarIgv en montos redondos', () => {
    expect(ponerIgv(10_000, 18)).toBe(11_800);
    expect(ponerIgv(8_475, 18)).toBe(10_001);
    expect(ponerIgv(500, 0)).toBe(500);
    expect(quitarIgv(ponerIgv(10_000, 18), 18)).toBe(10_000);
  });
  it('rechaza lo que no es entero seguro o IGV fuera de rango', () => {
    expect(() => ponerIgv(1.5, 18)).toThrow(RangeError);
    expect(() => ponerIgv(100, 101)).toThrow(RangeError);
  });
});
