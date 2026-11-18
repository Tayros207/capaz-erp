import { describe, expect, it } from 'vitest';
import { leerDecimal, textoDeDecimal } from './numeros.ts';

describe('leerDecimal', () => {
  it.each([
    ['1.000.000', 3, 1_000_000_000],
    ['1.000.000', 0, 1_000_000],
    ['0,42', 3, 420],
    ['0.42', 3, 420],
    ['1,234.56', 2, 123_456],
    ['1.234,56', 2, 123_456],
    ['12.50', 2, 1_250],
    ['12,5', 3, 12_500],
    ['1.000', 0, 1_000],
    ['1,000', 0, 1_000],
    ['0,420', 3, 420],
    ['1000', 2, 100_000],
    [' 1 234 ', 0, 1_234],
    ['.5', 2, 50],
    ['2,50000', 3, 2_500],
  ])('«%s» con %i decimales → %i', (texto, dec, esperado) => expect(leerDecimal(texto, dec)).toBe(esperado));

  it.each([['', 2], ['abc', 2], ['1.2.3', 2], ['1,23,4', 2], ['12.34.567', 2], ['1.0001', 3], ['0,001', 2], ['1,5,', 2], [',', 2], ['-5', 2], ['1.00.000', 2]])('«%s» no es un número válido', (texto, dec) => {
    expect(leerDecimal(texto, dec)).toBeNull();
  });

  it('rechaza lo que no cabe en un entero seguro', () => {
    expect(leerDecimal('99.999.999.999.999.999', 3)).toBeNull();
  });
});

describe('textoDeDecimal', () => {
  it('muestra con coma decimal, miles con punto y los decimales mínimos', () => {
    expect(textoDeDecimal(123_450, 2, 2)).toBe('1.234,50');
    expect(textoDeDecimal(14_286, 3, 2)).toBe('14,286');
    expect(textoDeDecimal(420, 3, 2)).toBe('0,42');
    expect(textoDeDecimal(1_000_000, 0)).toBe('1.000.000');
    expect(textoDeDecimal(5, 2, 2)).toBe('0,05');
  });
});
