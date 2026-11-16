import { describe, expect, it } from 'vitest';
import type { DeudaConAbonosDto, DeudaDto, MovimientoDto } from '@capaz/shared';
import { deudasDelEstado, enlaceDeWhatsApp, filasDeEstadoDeCuenta, inicioDelUltimoAnio, mensajeDeEstadoDeCuenta, reciboDeAbono, telefonoParaWhatsApp, totalesDeEstadoDeCuenta } from './recibos.ts';

const abono = (id: string, monto: number, extra: Partial<MovimientoDto> = {}): MovimientoDto =>
  ({ id, codigo: `MOV-${id}`, fecha: '2026-03-10', montoCentimos: monto, medioDePago: 'yape', estado: 'activo', creadoEn: `2026-03-10T10:0${id}:00.000Z`, ...extra }) as MovimientoDto;

const deuda = (extra: Partial<DeudaConAbonosDto> = {}): DeudaConAbonosDto =>
  ({ id: 'd', codigo: 'CXC-1', tipo: 'por_cobrar', contactoNombre: 'Ana', concepto: 'Polos', totalCentimos: 100_000, abonos: [abono('1', 20_000), abono('2', 30_000)], ...extra }) as DeudaConAbonosDto;

describe('reciboDeAbono', () => {
  it('calcula saldo anterior y pendiente según el orden de registro', () => {
    const r = reciboDeAbono(deuda(), '2');
    expect(r.tipo).toBe('recibo');
    if (r.tipo !== 'recibo') return;
    expect(r.recibo.saldoAnteriorCentimos).toBe(80_000);
    expect(r.recibo.saldoPendienteCentimos).toBe(50_000);
    expect(r.recibo.montoEnLetras).toBe('TRESCIENTOS Y 00/100 SOLES');
    expect(r.recibo.medio).toBe('Yape');
  });
  it('ignora abonos anulados previos', () => {
    const d = deuda({ abonos: [abono('1', 20_000, { estado: 'anulado' }), abono('2', 30_000)] });
    const r = reciboDeAbono(d, '2');
    if (r.tipo !== 'recibo') throw new Error('esperaba recibo');
    expect(r.recibo.saldoAnteriorCentimos).toBe(100_000);
  });
  it('abono anulado, inexistente o de por pagar', () => {
    expect(reciboDeAbono(deuda({ abonos: [abono('1', 1, { estado: 'anulado' })] }), '1').tipo).toBe('anulado');
    expect(reciboDeAbono(deuda(), 'x').tipo).toBe('no-encontrado');
    expect(reciboDeAbono(deuda({ tipo: 'por_pagar' }), '1').tipo).toBe('no-aplica');
  });
});

const d = (extra: Partial<DeudaDto>): DeudaDto =>
  ({ codigo: 'C', concepto: 'x', fecha: '2026-01-01', venceEn: '2026-02-01', totalCentimos: 10_000, abonadoCentimos: 4_000, saldoCentimos: 6_000, vencida: false, estado: 'parcial', ...extra }) as DeudaDto;

describe('estado de cuenta', () => {
  const abiertas = [d({ codigo: 'A', vencida: true, venceEn: '2026-02-01' }), d({ codigo: 'B', saldoCentimos: 5_000, venceEn: null })];
  const pagadas = [d({ codigo: 'P1', estado: 'pagada', saldoCentimos: 0, fecha: '2026-05-01' }), d({ codigo: 'P2', estado: 'pagada', saldoCentimos: 0, fecha: '2024-05-01' })];
  it('totales de adeudado y vencido', () => {
    const t = totalesDeEstadoDeCuenta(deudasDelEstado(abiertas, pagadas, true, '2026-11-16'));
    expect(t).toEqual({ adeudadoCentimos: 11_000, vencidoCentimos: 6_000, cantidadVencidas: 1 });
  });
  it('pagadas solo del último año y solo si se piden', () => {
    expect(deudasDelEstado(abiertas, pagadas, false, '2026-11-16').map((x) => x.codigo)).toEqual(['A', 'B']);
    expect(deudasDelEstado(abiertas, pagadas, true, '2026-11-16').map((x) => x.codigo)).toEqual(['A', 'P1', 'B']);
    expect(inicioDelUltimoAnio('2026-11-16')).toBe('2025-11-16');
  });
  it('filas con indicador de vencida', () => {
    expect(filasDeEstadoDeCuenta(abiertas)[0]?.estado).toBe('Vencida');
    expect(filasDeEstadoDeCuenta(abiertas)[1]?.vence).toBe('—');
  });
});

describe('WhatsApp', () => {
  it('prefijo 51 para celulares y solo dígitos', () => {
    expect(telefonoParaWhatsApp('987 654 321')).toBe('51987654321');
    expect(telefonoParaWhatsApp('+51 987-654-321')).toBe('51987654321');
    expect(telefonoParaWhatsApp('123')).toBeNull();
    expect(telefonoParaWhatsApp(null)).toBeNull();
  });
  it('enlace y mensaje', () => {
    const m = mensajeDeEstadoDeCuenta('Ana', 11_000, 6_000);
    expect(m).toContain('S/ 110.00');
    expect(m).toContain('S/ 60.00');
    expect(enlaceDeWhatsApp('987654321', m)).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
    expect(enlaceDeWhatsApp('', m)).toBeNull();
  });
});
