import { describe, expect, it } from 'vitest';
import { tarjetaDePago, tarjetasDePagos, type DeudaPorPagar } from './pagos-pendientes.js';

const hoy = '2026-11-20';
const pago = (venceEn: string, extra: Partial<DeudaPorPagar> = {}): DeudaPorPagar => ({
  id: 'd1', anio: 2026, numero: 7, proveedorId: 'p1', proveedorNombre: 'Alquiler Local Prueba', concepto: 'Alquiler de noviembre', saldoCentimos: 150_000, venceEn, ...extra,
});

describe('tarjetasDePagos', () => {
  it('vence en 4 días: no sale', () => {
    expect(tarjetasDePagos([pago('2026-11-24')], hoy)).toEqual([]);
  });
  it('vence en 3 días: sale como «pronto»', () => {
    const [t] = tarjetasDePagos([pago('2026-11-23')], hoy);
    expect(t).toMatchObject({ urgencia: 'pronto', detalle: 'Alquiler de noviembre · vence en 3 días', montoCentimos: 150_000 });
  });
  it('sin saldo no sale', () => {
    expect(tarjetasDePagos([pago('2026-11-20', { saldoCentimos: 0 })], hoy)).toEqual([]);
  });
});

describe('tarjetaDePago', () => {
  it('hoy, mañana y vencida', () => {
    expect(tarjetaDePago(pago('2026-11-20'), hoy)).toMatchObject({ urgencia: 'hoy', detalle: 'Alquiler de noviembre · vence hoy' });
    expect(tarjetaDePago(pago('2026-11-21'), hoy)).toMatchObject({ urgencia: 'manana', detalle: 'Alquiler de noviembre · vence mañana' });
    const v = tarjetaDePago(pago('2026-11-18'), hoy);
    expect(v).toMatchObject({ urgencia: 'atrasado', detalle: 'Alquiler de noviembre · venció hace 2 días', clave: 'pagar:d1', titulo: 'Pagar a Alquiler Local Prueba', grupo: 'seguimiento' });
    expect(v.entidad).toEqual({ tipo: 'deuda', id: 'd1', codigo: 'CXP-2026-0007' });
  });
});
