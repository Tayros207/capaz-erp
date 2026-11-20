import { describe, expect, test } from 'vitest';
import { fechaCorta, propuestaDePedido } from './propuesta-de-pedido.js';
import { interpretarPedidoDictado } from './reglas/pedido.js';
import type { PedidoDictado } from './reglas/pedido.js';
import type { ResolucionDeContacto } from './resolver.js';

const HOY = '2026-11-18';
const SIN: ResolucionDeContacto = { contacto: null, sugerencia: null };
const de = (frase: string): PedidoDictado => interpretarPedidoDictado(frase, HOY);
const T1_4 = 'pedido Rosa 500 tarjetas a 0.365 y 1 millar de volantes a 240 adelanto 100 para el viernes';

describe('propuestaDePedido', () => {
  test('PD1 · cliente resuelto, dos líneas, adelanto y entrega', () => {
    const p = { ...de(T1_4), entregaEl: '2026-11-20' };
    const { propuestas, faltan } = propuestaDePedido(p, { contacto: { id: 'c-rosa', nombre: 'Rosa Díaz' }, sugerencia: null });
    expect(propuestas).toHaveLength(1);
    const x = propuestas[0]!;
    expect(x.herramienta).toBe('pedido_crear');
    expect(x).not.toHaveProperty('sugerencias');
    expect(x.args).toEqual({
      clienteId: 'c-rosa', entregaEl: '2026-11-20', notas: 'Adelanto dictado: S/ 100.00. Cóbralo al confirmar el pedido.',
      lineas: [
        { descripcion: 'tarjetas', unidad: 'unidad', cantidadMilesimas: 500000, precioUnitarioMilesimas: 365 },
        { descripcion: 'volantes', unidad: 'millar', cantidadMilesimas: 1000, precioUnitarioMilesimas: 240000 },
      ],
    });
    expect(Object.keys(x.args)).toEqual(['clienteId', 'entregaEl', 'notas', 'lineas']);
    expect(x.resumen).toBe('Pedido para Rosa Díaz · 2 líneas · S/ 422.50 · adelanto S/ 100.00 · entrega 20/11/2026');
    expect(faltan).toEqual(['el adelanto de S/ 100.00 se cobra al confirmar el pedido']);
  });

  test('PD2 · falta precio', () => {
    const { propuestas, faltan } = propuestaDePedido(de('pedido para Juan Pérez 500 volantes'), { contacto: { id: 'c-juan', nombre: 'Juan Pérez' }, sugerencia: null });
    expect(propuestas[0]!.args).toEqual({ clienteId: 'c-juan', entregaEl: null, notas: null, lineas: [{ descripcion: 'volantes', unidad: 'unidad', cantidadMilesimas: 500000 }] });
    expect(propuestas[0]!.resumen).toBe('Pedido para Juan Pérez · 1 línea · falta precio');
    expect(faltan).toEqual(['el precio de «volantes»']);
  });

  test('PD3 · cliente ambiguo', () => {
    const sugerencia = { campo: 'contactoId', texto: 'Rosa', opciones: [{ id: 'r1', nombre: 'Rosa Díaz' }, { id: 'r2', nombre: 'Rosa Diez' }] };
    const { propuestas, faltan } = propuestaDePedido(de('Pedido para Rosa, 500 tarjetas a 0.365'), { contacto: null, sugerencia });
    expect(propuestas[0]!.args.clienteId).toBeNull();
    expect(propuestas[0]!.sugerencias).toEqual([{ ...sugerencia, campo: 'clienteId' }]);
    expect(propuestas[0]!.resumen).toBe('Pedido para Rosa · 1 línea · S/ 182.50');
    expect(faltan).toEqual(['elige el cliente «Rosa» entre los parecidos']);
  });

  test('PD4 · cliente nuevo', () => {
    const p = { ...de('Pedido para Rosa, 500 tarjetas a 0.365'), clienteNombre: 'Wilfredo' };
    const { propuestas, faltan } = propuestaDePedido(p, { contacto: null, sugerencia: { campo: 'contactoId', texto: 'Wilfredo', opciones: [] } });
    expect(propuestas[0]).not.toHaveProperty('sugerencias');
    expect(faltan).toEqual(['cliente nuevo: «Wilfredo» (créalo desde la tarjeta)']);
    expect(propuestas[0]!.resumen).toBe('Pedido para Wilfredo · 1 línea · S/ 182.50');
  });

  test('PD5 · sin nombre', () => {
    const p = { ...de('Pedido para Rosa, 500 tarjetas a 0.365'), clienteNombre: null };
    const { propuestas, faltan } = propuestaDePedido(p, SIN);
    expect(faltan).toEqual(['a quién es el pedido']);
    expect(propuestas[0]!.resumen).toBe('Pedido para cliente por elegir · 1 línea · S/ 182.50');
  });

  test('PD6 · «N cosas a P» tomado como total', () => {
    const { propuestas, faltan } = propuestaDePedido(de('orden de Juan un millar de volantes a 240 y 100 tarjetas a 60 adelanto 50'), { contacto: { id: 'c-juan', nombre: 'Juan Pérez' }, sugerencia: null });
    expect(faltan).toEqual(['«100 tarjetas»: tomé S/ 60.00 como total; si era el precio de cada uno, corrígelo', 'el adelanto de S/ 50.00 se cobra al confirmar el pedido']);
    expect(propuestas[0]!.resumen).toBe('Pedido para Juan Pérez · 2 líneas · S/ 300.00 · adelanto S/ 50.00');
  });

  test('PD7 · adelanto mayor que el total', () => {
    const p: PedidoDictado = { clienteNombre: 'Rosa', adelantoCentimos: 10000, entregaEl: null, lineas: [{ descripcion: 'banner', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 90000, forma: 'entero', duda: null }] };
    expect(propuestaDePedido(p, SIN).faltan.at(-1)).toBe('el adelanto (S/ 100.00) supera el total (S/ 90.00)');
  });

  test('PD8 · sin líneas', () => {
    expect(propuestaDePedido(de('anota un pedido de tarjetas'), SIN)).toEqual({ propuestas: [], faltan: [] });
  });

  test('fechaCorta', () => expect(fechaCorta('2026-11-20')).toBe('20/11/2026'));
});
