import { describe, expect, test } from 'vitest';
import { milesimasDeNumero, numeroAlInicio } from './pedido-texto.js';

describe('milesimasDeNumero', () => {
  test.each([
    ['0.365', 365], ['0,365', 365], ['90,50', 90500], ['240', 240000], ['1,000', 1000000],
    ['1,250,000', 1250000000], ['12.5', 12500], ['abc', null], ['1.2345', null],
  ] as const)('%s -> %s', (e, s) => expect(milesimasDeNumero(e)).toBe(s));
});

describe('numeroAlInicio', () => {
  test.each([
    ['500 tarjetas', { milesimas: 500000, fin: 3 }],
    ['quinientas tarjetas', { milesimas: 500000, fin: 10 }],
    ['ciento cuarenta y cinco soles', { milesimas: 145000, fin: 23 }],
    ['un millar', { milesimas: 1000, fin: 2 }],
    ['mil volantes', { milesimas: 1000000, fin: 3 }],
    ['2.5 metros', { milesimas: 2500, fin: 3 }],
    ['tarjetas 500', null],
    ['A5', null],
    ['150g', null],
  ] as const)('%s', (e, s) => expect(numeroAlInicio(e)).toEqual(s));
});
