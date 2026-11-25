import { describe, expect, test } from 'vitest';
import type { LineaDictada } from './pedido-lineas.js';
import { extraerAdelanto, interpretarPedidoDictado } from './pedido.js';

const HOY = '2026-11-18';
const U = (descripcion: string, unidad: LineaDictada['unidad'], c: number, p: number): LineaDictada => ({ descripcion, unidad, cantidadMilesimas: c, precioUnitarioMilesimas: p, forma: 'unitario', duda: null });
const E = (descripcion: string, p: number, duda: LineaDictada['duda'] = null): LineaDictada => ({ descripcion, unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: p, forma: 'entero', duda });
const S = (descripcion: string, c: number): LineaDictada => ({ descripcion, unidad: 'unidad', cantidadMilesimas: c, precioUnitarioMilesimas: null, forma: 'unitario', duda: 'sin_precio' });
const TARJETAS = U('tarjetas', 'unidad', 500000, 365);

type Caso = [string, string | null, LineaDictada[], number | null, string | null];
const casos: Caso[] = [
  ['Pedido para Rosa, 500 tarjetas a 0.365', 'Rosa', [TARJETAS], null, null],
  ['pedido para Rosa quinientas tarjetas a 0.365 a cuenta cincuenta para el viernes', 'Rosa', [TARJETAS], 5000, '2026-11-20'],
  ['nuevo pedido para Imprenta Mateo: 2 millares de volantes A5 a 59 soles, entrega el 15 de marzo', 'Imprenta Mateo', [U('volantes A5', 'millar', 2000, 59000)], null, '2027-03-15'],
  ['pedido Rosa 500 tarjetas a 0.365 y 1 millar de volantes a 240 adelanto 100 para el viernes', 'Rosa', [TARJETAS, U('volantes', 'millar', 1000, 240000)], 10000, '2026-11-20'],
  ['orden de Juan un millar de volantes a 240 y 100 tarjetas a 60 adelanto 50', 'Juan', [U('volantes', 'millar', 1000, 240000), E('100 tarjetas', 60000, 'total_o_unitario')], 5000, null],
  ['pedido para Juan Pérez 500 volantes', 'Juan Pérez', [S('volantes', 500000)], null, null],
  ['pedido para Cristina Neira, millar de volantes, doscientos cuarenta soles', 'Cristina Neira', [E('millar de volantes', 240000)], null, null],
  ['pedido para Rosa, ciento cuarenta y cinco soles de tarjetas', 'Rosa', [E('tarjetas', 145000)], null, null],
  ['pedido para Mateo 3 docenas de llaveros a 12 y 2000 volantes a 120 el millar', 'Mateo', [U('llaveros', 'docena', 3000, 12000), U('volantes', 'millar', 2000, 120000)], null, null],
  ['pedido para la señora Cristina 2 docenas de stickers a 0.5 cada una', 'Cristina', [U('stickers', 'unidad', 24000, 500)], null, null],
  ['pedido para Juan un millar de volantes a 0.24', 'Juan', [U('volantes', 'unidad', 1000000, 240)], null, null],
  ['pedido para Rosa 2 banners a 90 y 1 banner a 90', 'Rosa', [E('2 banners', 90000, 'total_o_unitario'), U('banner', 'unidad', 1000, 90000)], null, null],
  ['anota un pedido de tarjetas', null, [], null, null],
  ['OT para Rosa, banner 90', 'Rosa', [E('banner', 90000)], null, null],
  ['pedido para Juan Pérez 1,000 volantes a S/ 0.24', 'Juan Pérez', [U('volantes', 'unidad', 1000000, 240)], null, null],
  ['Pedido para Cristina, millar de volantes 240 soles y 100 tarjetas 60 soles, adelanto 100, para mañana', 'Cristina', [E('millar de volantes', 240000), E('100 tarjetas', 60000)], 10000, '2026-11-19'],
  ['pedido para Rosa 25 llaveros a 15 la docena', 'Rosa', [E('25 llaveros', 15000, 'total_o_unitario')], null, null],
  ['sabes qué hazme un pedido para Rosa de quinientas tarjetas a 0.365 me dejó cincuenta soles para el viernes', 'Rosa', [TARJETAS], 5000, '2026-11-20'],
  ['pedido de 300, anticipo 100', null, [], 10000, null],
  ['pedido para Rosa banner 180 soles deja adelanto 90 soles', 'Rosa', [E('banner', 180000)], 9000, null],
  ['pedido para Rosa banner 180, dejó un adelanto de 90', 'Rosa', [E('banner', 180000)], 9000, null],
];

describe('interpretarPedidoDictado (hoy = miércoles 2026-11-18)', () => {
  test.each(casos)('%s', (frase, cliente, lineas, adelanto, entrega) => {
    expect(interpretarPedidoDictado(frase, HOY)).toEqual({ clienteNombre: cliente, lineas, adelantoCentimos: adelanto, entregaEl: entrega });
  });
});

describe('extraerAdelanto', () => {
  test('a cuenta en palabras', () => expect(extraerAdelanto('volantes 240, a cuenta cincuenta')).toEqual({ centimos: 5000, resto: 'volantes 240' }));
  test('sin número no toca nada', () => expect(extraerAdelanto('tarjetas 240 adelanto')).toEqual({ centimos: null, resto: 'tarjetas 240 adelanto' }));
});
