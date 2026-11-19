import { describe, expect, it } from 'vitest';
import { tarjetasDeActividades, type ActividadPendiente } from './pendientes.js';

const a = (x: Partial<ActividadPendiente>): ActividadPendiente => ({
  id: 'a1', tipo: 'llamada', asunto: 'Confirmar medidas', venceEl: '2026-11-16', oportunidadId: 'o1', oportunidadNumero: 4, oportunidadAnio: 2026,
  oportunidadTitulo: 'Banner', clienteId: 'c1', clienteNombre: 'Sol', clienteTelefono: '987654321', ...x,
});

describe('tarjetasDeActividades', () => {
  it('vencida, de hoy y de mañana, con acción para completarla y enlace a la oportunidad', () => {
    const r = tarjetasDeActividades([a({}), a({ id: 'a2', venceEl: '2026-11-18' }), a({ id: 'a3', venceEl: '2026-11-19' })], '2026-11-18');
    expect(r.map((t) => t.urgencia)).toEqual(['atrasado', 'hoy', 'manana']);
    expect(r[0]!.titulo).toBe('Llamar: Confirmar medidas');
    expect(r[0]!.detalle).toContain('Vencida hace 2 días');
    expect(r[0]!.acciones[0]).toMatchObject({ herramienta: 'actividad_completar', args: { id: 'a1' } });
    expect(r[0]!.entidad).toMatchObject({ tipo: 'oportunidad', id: 'o1', codigo: 'OPO-2026-0004' });
  });
});
