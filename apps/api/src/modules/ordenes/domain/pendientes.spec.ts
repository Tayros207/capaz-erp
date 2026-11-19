import { describe, expect, it } from 'vitest';
import { tarjetasDePedidos, type PedidoEnCurso } from './pendientes.js';

const HOY = '2026-11-18';
const p = (o: Partial<PedidoEnCurso>): PedidoEnCurso => ({
  id: 'p1', serie: 'A', anio: 2026, numero: 7, estado: 'en_proceso', entregaEl: HOY, totalCentimos: 50_000, confirmadoDia: '2026-11-10',
  clienteId: 'c1', clienteNombre: 'Sol', clienteTelefono: null, ...o,
});

describe('tarjetasDePedidos', () => {
  it('entrega de hoy, de mañana y atrasada con la pregunta y la acción de cambio de estado', () => {
    const r = tarjetasDePedidos([p({ id: 'a', entregaEl: '2026-11-16' }), p({ id: 'b' }), p({ id: 'c', entregaEl: '2026-11-19' })], HOY);
    expect(r.map((t) => t.urgencia)).toEqual(['atrasado', 'hoy', 'manana']);
    expect(r[0]!.detalle).toContain('Atrasado 2 días');
    expect(r[1]!.detalle).toContain('¿ya está listo?');
    expect(r[1]!.acciones.map((a) => [a.herramienta, a.args.estado])).toEqual([['pedido_cambiar_estado', 'listo'], ['pedido_cambiar_estado', 'entregado']]);
    expect(r[1]!.entidad).toMatchObject({ tipo: 'pedido', id: 'b', codigo: 'PED-A-2026-0007' });
  });
  it('un pedido listo pregunta solo si ya se entregó', () => {
    const [t] = tarjetasDePedidos([p({ estado: 'listo' })], HOY);
    expect(t!.detalle).toContain('¿ya se entregó?');
    expect(t!.acciones).toHaveLength(1);
  });
  it('lo que entrega más adelante (o sin fecha) es «sin adelanto» desde que se confirmó', () => {
    const r = tarjetasDePedidos([p({ id: 'x', entregaEl: '2026-12-30' }), p({ id: 'y', entregaEl: null, confirmadoDia: HOY })], HOY);
    expect(r.map((t) => [t.grupo, t.urgencia])).toEqual([['adelanto', 'pronto'], ['adelanto', 'info']]);
    expect(r[0]!.detalle).toContain('hace 8 días');
    expect(r[1]!.detalle).toContain('hoy');
    expect(r[0]!.acciones).toEqual([]);
  });
});
