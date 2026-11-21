import { describe, expect, it } from 'vitest';
import { MAXIMO_MONTO_MINIMO_CENTIMOS, MONTO_MINIMO_POR_TRABAJO_CENTIMOS, faltaParaElMinimo, montoMinimoEfectivo } from './monto-minimo.js';

describe('faltaParaElMinimo', () => {
  it('el mínimo por defecto es S/ 40.00', () => {
    expect(MONTO_MINIMO_POR_TRABAJO_CENTIMOS).toBe(4000);
  });
  it('sin total (cero o negativo) no falta nada', () => {
    expect(faltaParaElMinimo(0)).toBe(0);
    expect(faltaParaElMinimo(-500)).toBe(0);
  });
  it('un total chico dice cuánto falta', () => {
    expect(faltaParaElMinimo(2500)).toBe(1500);
    expect(faltaParaElMinimo(1)).toBe(3999);
  });
  it('si ya llega al mínimo o lo supera, no falta nada', () => {
    expect(faltaParaElMinimo(4000)).toBe(0);
    expect(faltaParaElMinimo(10_000)).toBe(0);
  });
  it('acepta otro mínimo', () => {
    expect(faltaParaElMinimo(2000, 5000)).toBe(3000);
  });
});

describe('montoMinimoEfectivo', () => {
  it('nulo o ausente usa el de fábrica; cero lo apaga; otro valor se respeta', () => {
    expect(montoMinimoEfectivo(null)).toBe(4000);
    expect(montoMinimoEfectivo(undefined)).toBe(4000);
    expect(montoMinimoEfectivo(0)).toBe(0);
    expect(montoMinimoEfectivo(3000)).toBe(3000);
  });
  it('el tope es S/ 100,000.00', () => {
    expect(MAXIMO_MONTO_MINIMO_CENTIMOS).toBe(10_000_000);
  });
  it('con el mínimo apagado nunca falta nada', () => {
    expect(faltaParaElMinimo(2500, montoMinimoEfectivo(0))).toBe(0);
  });
});
