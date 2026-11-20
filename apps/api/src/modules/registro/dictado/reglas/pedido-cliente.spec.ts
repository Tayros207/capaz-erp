import { describe, expect, test } from 'vitest';
import { esPedidoDictado, extraerClienteDePedido } from './pedido-cliente.js';

describe('esPedidoDictado', () => {
  test.each([
    'Pedido para Rosa, 500 tarjetas a 0.365',
    'nuevo pedido para Imprenta Mateo: 2 millares de volantes A5 a 59 soles, entrega el 15 de marzo',
    'anota un pedido de tarjetas',
    'nota de pedido para Rosa, banner 90',
    'registra un pedido de Rosa de 500 tarjetas 180 soles',
    'Pedido: Rosa, 500 tarjetas a 0.365',
    'OT para Rosa, banner 90',
    'orden para Juan tarjetas 240 y me pagó 100',
  ])('verdadero: %s', (t) => expect(esPedidoDictado(t)).toBe(true));

  test('verdadero con modo ingreso', () => expect(esPedidoDictado('pedido para Rosa 500 tarjetas a 0.365', 'ingreso')).toBe(true));

  test.each([
    'Egreso 120, pedido de tintas',
    'Hazle una proforma a Juan por 500 tarjetas a 180 soles',
    'pasa la proforma de Juan a orden',
    'anota una orden de compra de papel 300',
    'Contrato 240, adelanto 100, cliente Cristina',
    'Ingreso 500 soles, cliente Juan Pérez, flyers',
    'el cliente me pagó el pedido de ayer 200',
    'Juan abona 100 soles de su deuda',
    'Trabajo 240 soles, cliente Cristina, tarjetas',
    'cobré 200 de la orden de Juan',
    'Ingreso 500 de la orden de Rosa',
  ])('falso: %s', (t) => expect(esPedidoDictado(t)).toBe(false));

  test('falso en modo egreso', () => expect(esPedidoDictado('pedido para Rosa 500 tarjetas a 0.365', 'egreso')).toBe(false));
});

describe('extraerClienteDePedido', () => {
  test.each([
    ['Pedido para Rosa, 500 tarjetas a 0.365', 'Rosa'],
    ['nuevo pedido para Imprenta Mateo: 2 millares de volantes A5 a 59 soles', 'Imprenta Mateo'],
    ['pedido Rosa 500 tarjetas a 0.365', 'Rosa'],
    ['pedido para la señora Cristina 2 docenas de stickers a 0.5 cada una', 'Cristina'],
    ['pedido para cristina neira millar de volantes 240', 'Cristina Neira'],
    ['Orden para María Pérez, volantes 100', 'María Pérez'],
    ['Orden de 500 soles', null],
    ['anota un pedido de tarjetas', null],
  ])('%s', (t, s) => expect(extraerClienteDePedido(t)).toBe(s));
});
