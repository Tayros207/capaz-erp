import { describe, expect, it } from 'vitest';
import { aCentimos, centimosSchema, formatearSoles } from './dinero.js';

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
