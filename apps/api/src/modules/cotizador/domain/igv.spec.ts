import { describe, expect, it } from 'vitest';
import { igvDeImporte, totalConIgv } from './igv.js';

describe('igvDeImporte (mitad hacia arriba, por línea)', () => {
  it.each([
    [34_638, 6_235, 40_873],
    [14_486, 2_607, 17_093],
    [22_034, 3_966, 26_000],
    [55_583, 10_005, 65_588],
  ])('18 %% de %i da %i y el total %i', (importe, igv, total) => {
    expect(igvDeImporte(importe, 18)).toBe(igv);
    expect(totalConIgv(importe, 18)).toBe(total);
  });

  it('con 0 % el IGV es cero y el total es el importe', () => {
    expect(igvDeImporte(34_638, 0)).toBe(0);
    expect(totalConIgv(34_638, 0)).toBe(34_638);
  });

  it('el medio exacto sube: 2,5 céntimos → 3 y 0,5 → 1', () => {
    expect(igvDeImporte(25, 10)).toBe(3);
    expect(igvDeImporte(5, 10)).toBe(1);
    expect(igvDeImporte(4, 10)).toBe(0);
  });

  it('rechaza importes que no son enteros seguros y porcentajes fuera de 0 a 100', () => {
    expect(() => igvDeImporte(1.5, 18)).toThrow(RangeError);
    expect(() => igvDeImporte(100, 101)).toThrow(RangeError);
    expect(() => igvDeImporte(100, 18.5)).toThrow(RangeError);
  });
});
