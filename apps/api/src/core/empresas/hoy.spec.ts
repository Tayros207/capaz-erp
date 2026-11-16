import { describe, expect, it } from 'vitest';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { hoyDeLaEmpresa, hoyEnZona, instanteDeDia } from './hoy.js';

const txCon = (filas: { zona_horaria: string }[]) => ({ execute: async () => ({ rows: filas }) }) as unknown as Transaccion;
// 2027-01-01 03:30 UTC: en Lima (UTC-5) todavía es 31 de diciembre; en Tokio (UTC+9) ya es 1 de enero.
const AHORA = new Date('2027-01-01T03:30:00Z');

describe('hoy de la empresa', () => {
  it('usa la zona de la configuración (Lima: día y año anteriores)', async () => {
    expect(await hoyDeLaEmpresa(txCon([{ zona_horaria: 'America/Lima' }]), AHORA)).toEqual({ zona: 'America/Lima', dia: '2026-12-31', anio: 2026 });
  });
  it('con otra zona cambia el día', async () => {
    expect(await hoyDeLaEmpresa(txCon([{ zona_horaria: 'Asia/Tokyo' }]), AHORA)).toEqual({ zona: 'Asia/Tokyo', dia: '2027-01-01', anio: 2027 });
  });
  it('sin fila, America/Lima', async () => {
    expect((await hoyDeLaEmpresa(txCon([]), AHORA)).zona).toBe('America/Lima');
  });
  it('hoyEnZona es puro', () => expect(hoyEnZona('UTC', AHORA).dia).toBe('2027-01-01'));
  it('instanteDeDia es mediodía UTC y mantiene el día en UTC-11 y UTC+11', () => {
    const i = instanteDeDia('2026-12-31');
    expect(i.toISOString()).toBe('2026-12-31T12:00:00.000Z');
    expect(hoyEnZona('Pacific/Pago_Pago', i).dia).toBe('2026-12-31');
    expect(hoyEnZona('Pacific/Noumea', i).dia).toBe('2026-12-31');
  });
});
