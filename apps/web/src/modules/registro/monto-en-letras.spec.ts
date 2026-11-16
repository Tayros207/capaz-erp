import { describe, expect, it } from 'vitest';
import { enteroEnLetras, montoEnLetras } from './monto-en-letras.ts';

describe('montoEnLetras', () => {
  it('soles exactos y céntimos', () => {
    expect(montoEnLetras(15_000)).toBe('CIENTO CINCUENTA Y 00/100 SOLES');
    expect(montoEnLetras(12_345)).toBe('CIENTO VEINTITRES Y 45/100 SOLES');
    expect(montoEnLetras(100)).toBe('UNO Y 00/100 SOL');
    expect(montoEnLetras(0)).toBe('CERO Y 00/100 SOLES');
    expect(montoEnLetras(5)).toBe('CERO Y 05/100 SOLES');
  });
  it('cientos, miles y millones', () => {
    expect(enteroEnLetras(100)).toBe('CIEN');
    expect(enteroEnLetras(101)).toBe('CIENTO UNO');
    expect(enteroEnLetras(1000)).toBe('MIL');
    expect(enteroEnLetras(1021)).toBe('MIL VEINTIUNO');
    expect(enteroEnLetras(21_000)).toBe('VEINTIUN MIL');
    expect(enteroEnLetras(31_000)).toBe('TREINTA Y UN MIL');
    expect(enteroEnLetras(2_500)).toBe('DOS MIL QUINIENTOS');
    expect(enteroEnLetras(1_000_000)).toBe('UN MILLON');
    expect(enteroEnLetras(2_000_001)).toBe('DOS MILLONES UNO');
    expect(enteroEnLetras(999_999_999)).toBe('NOVECIENTOS NOVENTA Y NUEVE MILLONES NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE');
  });
  it('rechaza decimales y negativos', () => {
    expect(() => montoEnLetras(1.5)).toThrow();
    expect(() => montoEnLetras(-1)).toThrow();
  });
});
