import { describe, expect, it } from 'vitest';
import { tarjetasDeCotizaciones, type CotizacionSinRespuesta } from './pendientes.js';

const HOY = '2026-11-18';
const c = (x: Partial<CotizacionSinRespuesta>): CotizacionSinRespuesta => ({
  id: 'k1', numero: 3, anio: 2026, version: 1, estado: 'enviada', titulo: 'Volantes', validaHasta: null, totalCentimos: 90_000, desde: '2026-11-10',
  clienteId: 'c1', clienteNombre: 'Sol', clienteTelefono: null, ...x,
});

describe('tarjetasDeCotizaciones', () => {
  it('sin respuesta desde hace 3 días o más entra; antes no', () => {
    const r = tarjetasDeCotizaciones([c({ id: 'a', desde: '2026-11-15' }), c({ id: 'b', desde: '2026-11-16' })], HOY);
    expect(r.map((t) => t.entidad.id)).toEqual(['a']);
    expect(r[0]!.detalle).toContain('Enviada hace 3 días, sin respuesta');
  });
  it('cerca de vencer entra aunque sea reciente; vencida es atrasada', () => {
    const r = tarjetasDeCotizaciones([c({ id: 'a', desde: HOY, validaHasta: '2026-11-20' }), c({ id: 'b', desde: HOY, validaHasta: '2026-11-15' }), c({ id: 'c', desde: HOY, validaHasta: '2026-11-18' }), c({ id: 'd', desde: HOY, validaHasta: '2026-12-30' })], HOY);
    expect(r.map((t) => [t.entidad.id, t.urgencia])).toEqual([['a', 'pronto'], ['b', 'atrasado'], ['c', 'hoy']]);
    expect(r[1]!.detalle).toContain('Venció hace 3 días');
  });
  it('una emitida ofrece marcarla enviada; una enviada no', () => {
    const [e, v] = tarjetasDeCotizaciones([c({ id: 'e', estado: 'emitida' }), c({ id: 'v' })], HOY);
    expect(e!.acciones[0]).toMatchObject({ herramienta: 'cotizacion_marcar_enviada', args: { id: 'e' } });
    expect(v!.acciones).toEqual([]);
    expect(e!.entidad.codigo).toBe('COT-2026-0003');
  });
});
