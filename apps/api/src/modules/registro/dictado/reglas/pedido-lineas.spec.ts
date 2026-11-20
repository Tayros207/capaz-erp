import { describe, expect, test } from 'vitest';
import { partirEnTrozos, trozoALinea, type LineaDictada } from './pedido-lineas.js';

const U = (descripcion: string, unidad: LineaDictada['unidad'], c: number, p: number): LineaDictada => ({ descripcion, unidad, cantidadMilesimas: c, precioUnitarioMilesimas: p, forma: 'unitario', duda: null });
const E = (descripcion: string, p: number, duda: LineaDictada['duda'] = null): LineaDictada => ({ descripcion, unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: p, forma: 'entero', duda });
const S = (descripcion: string, c: number): LineaDictada => ({ descripcion, unidad: 'unidad', cantidadMilesimas: c, precioUnitarioMilesimas: null, forma: 'unitario', duda: 'sin_precio' });

describe('trozoALinea', () => {
  test.each<[string, LineaDictada | null]>([
    ['500 tarjetas a 0.365', U('tarjetas', 'unidad', 500000, 365)],
    ['quinientas tarjetas a 0.365', U('tarjetas', 'unidad', 500000, 365)],
    ['de 500 tarjetas a 0.365', U('tarjetas', 'unidad', 500000, 365)],
    ['500 tarjetas a 0.36 cada una', U('tarjetas', 'unidad', 500000, 360)],
    ['2 millares de volantes A5 a 59 soles', U('volantes A5', 'millar', 2000, 59000)],
    ['un millar de volantes a 240', U('volantes', 'millar', 1000, 240000)],
    ['un millar de volantes a 0.24', U('volantes', 'unidad', 1000000, 240)],
    ['3 docenas de llaveros a 12', U('llaveros', 'docena', 3000, 12000)],
    ['2 docenas de stickers a 0.5 cada una', U('stickers', 'unidad', 24000, 500)],
    ['2000 volantes a 120 el millar', U('volantes', 'millar', 2000, 120000)],
    ['1 banner a 90', U('banner', 'unidad', 1000, 90000)],
    ['100 tarjetas a 60', E('100 tarjetas', 60000, 'total_o_unitario')],
    ['25 llaveros a 15 la docena', E('25 llaveros', 15000, 'total_o_unitario')],
    ['500 volantes', S('volantes', 500000)],
    ['quinientas tarjetas', S('tarjetas', 500000)],
    ['500 volantes A5', S('volantes A5', 500000)],
    ['millar de volantes, 240 soles', E('millar de volantes', 240000)],
    ['millar de volantes doscientos cuarenta soles', E('millar de volantes', 240000)],
    ['240 soles de un millar de tarjetas', E('millar de tarjetas', 240000)],
    ['volantes couche 150g 240 soles', E('volantes couche 150g', 240000)],
    ['volantes A5', null],
    ['urgente', null],
    ['', null],
  ])('%j', (entrada, salida) => expect(trozoALinea(entrada)).toEqual(salida));
});

describe('partirEnTrozos', () => {
  test.each([
    ['millar de volantes 240 soles y 100 tarjetas 60 soles', ['millar de volantes 240 soles', '100 tarjetas 60 soles']],
    ['ciento cuarenta y cinco soles de tarjetas', ['ciento cuarenta y cinco soles de tarjetas']],
    ['volantes a cuarenta y tarjetas a 0.2', ['volantes a cuarenta', 'tarjetas a 0.2']],
    ['tarjetas e imanes 50', ['tarjetas', 'imanes 50']],
    ['treinta y dos stickers a 0.5 y 10 afiches a 3', ['treinta y dos stickers a 0.5', '10 afiches a 3']],
  ])('%s', (e, s) => expect(partirEnTrozos(e)).toEqual(s));
});
