import { describe, expect, it } from 'vitest';
import { formatoDeDuracion, formatoDeTokens, formatoUsd, precioPorMillon, textoDeUso } from './logica-uso.ts';

describe('formatoUsd', () => {
  it('escribe los centavos con dos decimales y lo menor con cuatro', () => {
    expect(formatoUsd(5_000_000)).toBe('US$ 5.00');
    expect(formatoUsd(50_000)).toBe('US$ 0.05');
    expect(formatoUsd(10_000)).toBe('US$ 0.01');
    expect(formatoUsd(321)).toBe('US$ 0.0003');
    expect(formatoUsd(0)).toBe('US$ 0.0000');
  });
});

describe('precioPorMillon', () => {
  it('muestra el precio por millón de tokens, o nada si no se pudo consultar', () => {
    expect(precioPorMillon(270_000)).toBe('US$ 0.27 por millón');
    expect(precioPorMillon(null)).toBeNull();
  });
});

describe('formatoDeTokens y de duración', () => {
  it('abrevia miles y millones', () => {
    expect(formatoDeTokens(999)).toBe('999');
    expect(formatoDeTokens(1_200)).toBe('1.2 K');
    expect(formatoDeTokens(2_500_000)).toBe('2.5 M');
  });
  it('escribe milisegundos, segundos y minutos', () => {
    expect(formatoDeDuracion(250)).toBe('250 ms');
    expect(formatoDeDuracion(1_500)).toBe('1.5 s');
    expect(formatoDeDuracion(90_000)).toBe('1 min 30 s');
  });
});

describe('textoDeUso', () => {
  it('resume el turno en una línea', () => {
    expect(textoDeUso({ tokensEntrada: 1_200, tokensSalida: 20, tokensCache: 1_000, costoMicrousd: 321, rondas: 1, duracionMs: 1_500 })).toBe('1.2 K entrada · 20 salida · 1.5 s · US$ 0.0003');
  });
  it('sin costo no pone el costo', () => {
    expect(textoDeUso({ tokensEntrada: 10, tokensSalida: 5, tokensCache: 0, costoMicrousd: 0, rondas: 1, duracionMs: 400 })).toBe('10 entrada · 5 salida · 400 ms');
  });
});
