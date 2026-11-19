import { describe, expect, it } from 'vitest';
import { tarjetasDeOrdenes, type OrdenEnCurso } from './pendientes.js';

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
  it('acciones con produccion_orden_estado y saldo a la vista', () => {
    const [t] = tarjetasDeOrdenes([o({})], HOY);
    expect(t!.acciones.map((a) => [a.herramienta, a.args.estado])).toEqual([['produccion_orden_estado', 'listo'], ['produccion_orden_estado', 'entregado']]);
    expect(t!.detalle).toContain('Debe S/ 200.00');
    expect(t!.entidad).toMatchObject({ tipo: 'orden_trabajo', codigo: 'OT-2026-0005' });
  });
  it('una orden lista y pagada pregunta «Pagado: ¿ya se entregó?»', () => {
    const [t] = tarjetasDeOrdenes([o({ estado: 'listo', adelantoCentimos: 30_000 })], HOY);
    expect(t!.detalle).toContain('Pagado: ¿ya se entregó?');
    expect(t!.acciones).toHaveLength(1);
  });
});
