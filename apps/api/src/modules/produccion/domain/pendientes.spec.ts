import { describe, expect, it } from 'vitest';
import { anotacionesDeOrdenes, tarjetasDeOrdenes, type OrdenEnCurso } from './pendientes.js';

const HOY = '2026-11-18';
const o = (x: Partial<OrdenEnCurso>): OrdenEnCurso => ({
  id: 'o1', anio: 2026, numero: 5, estado: 'en_maquina', entregaEl: HOY, totalCentimos: 30_000, adelantoCentimos: 10_000,
  clienteId: 'c1', clienteNombre: 'Sol', clienteTelefono: null, ...x,
});

describe('tarjetasDeOrdenes', () => {
  it('atrasadas (regla estaAtrasada), hoy y mañana; lo posterior y lo sin fecha no entra', () => {
    const r = tarjetasDeOrdenes([o({ id: 'a', entregaEl: '2026-11-10' }), o({ id: 'b' }), o({ id: 'c', entregaEl: '2026-11-19' }), o({ id: 'd', entregaEl: '2026-11-25' }), o({ id: 'e', entregaEl: null })], HOY);
    expect(r.map((t) => [t.entidad.id, t.urgencia])).toEqual([['a', 'atrasado'], ['b', 'hoy'], ['c', 'manana']]);
    expect(r[0]!.detalle).toContain('Atrasada 8 días');
  });
  it('acciones con produccion_orden_estado; el saldo no va en el texto (va como anotación)', () => {
    const [t] = tarjetasDeOrdenes([o({})], HOY);
    expect(t!.acciones.map((a) => [a.herramienta, a.args.estado])).toEqual([['produccion_orden_estado', 'listo'], ['produccion_orden_estado', 'entregado']]);
    expect(t!.detalle).toBe('Vence hoy · En máquina: ¿ya está listo?');
    expect(t!.entidad).toMatchObject({ tipo: 'orden_trabajo', codigo: 'OT-2026-0005' });
  });
  it('una orden lista pregunta solo si ya se entregó', () => {
    const [t] = tarjetasDeOrdenes([o({ estado: 'listo' })], HOY);
    expect(t!.detalle).toBe('Vence hoy · Listo: ¿ya se entregó?');
    expect(t!.acciones).toHaveLength(1);
  });
});

describe('anotacionesDeOrdenes', () => {
  it('«Debe S/ X» con saldo, «Pagado» sin saldo, solo de las órdenes que entran al panel', () => {
    const r = anotacionesDeOrdenes([o({ id: 'a' }), o({ id: 'b', adelantoCentimos: 30_000 }), o({ id: 'c', adelantoCentimos: 0 }), o({ id: 'lejos', entregaEl: '2026-12-30' })], HOY);
    expect(r.map((a) => [a.entidad.id, a.texto, a.pagado, a.conAdelanto])).toEqual([
      ['a', 'Debe S/ 200.00', false, true],
      ['b', 'Pagado', true, true],
      ['c', 'Debe S/ 300.00', false, false],
    ]);
    expect(r[0]!.entidad.tipo).toBe('orden_trabajo');
  });
});
