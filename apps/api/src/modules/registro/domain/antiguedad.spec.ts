import { describe, expect, it } from 'vitest';
import { agruparAntiguedad, diasEntre, tramoDe, type DeudaAbierta } from './antiguedad.js';

const d = (c: string, saldoCentimos: number, venceEn: string | null, fecha = '2026-01-01', nombre = c): DeudaAbierta => ({ contactoId: c, contactoNombre: nombre, saldoCentimos, fecha, venceEn });

describe('diasEntre', () => {
  it('cuenta días calendario', () => {
    expect(diasEntre('2026-03-01', '2026-03-31')).toBe(30);
    expect(diasEntre('2026-03-10', '2026-03-01')).toBe(-9);
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1);
  });
});

describe('tramoDe', () => {
  const corte = '2026-04-30';
  it('vigente hasta el día del vencimiento inclusive', () => {
    expect(tramoDe(d('a', 1, '2026-04-30'), corte)).toBe('vigente');
    expect(tramoDe(d('a', 1, '2026-05-15'), corte)).toBe('vigente');
  });
  it('los límites de cada tramo', () => {
    expect(tramoDe(d('a', 1, '2026-04-29'), corte)).toBe('de_1_a_30');
    expect(tramoDe(d('a', 1, '2026-03-31'), corte)).toBe('de_1_a_30');
    expect(tramoDe(d('a', 1, '2026-03-30'), corte)).toBe('de_31_a_60');
    expect(tramoDe(d('a', 1, '2026-03-01'), corte)).toBe('de_31_a_60');
    expect(tramoDe(d('a', 1, '2026-02-28'), corte)).toBe('de_61_a_90');
    expect(tramoDe(d('a', 1, '2026-01-30'), corte)).toBe('de_61_a_90');
    expect(tramoDe(d('a', 1, '2026-01-29'), corte)).toBe('mas_de_90');
  });
  it('sin vencimiento cuenta desde la fecha de la deuda', () => {
    expect(tramoDe(d('a', 1, null, '2026-04-10'), corte)).toBe('de_1_a_30');
  });
});

describe('agruparAntiguedad', () => {
  it('suma por contacto y por tramo, ordena por lo más pesado y calcula totales', () => {
    const r = agruparAntiguedad(
      [d('luz', 5_000, '2026-05-10'), d('luz', 3_000, '2026-04-20'), d('sol', 20_000, '2026-01-01', '2025-12-01', 'Imprenta Sol'), d('sol', 0, '2026-01-01'), d('ana', 3_000, '2026-04-20')],
      '2026-04-30',
    );
    expect(r.filas.map((f) => [f.contactoId, f.totalCentimos, f.deudas])).toEqual([['sol', 20_000, 1], ['luz', 8_000, 2], ['ana', 3_000, 1]]);
    expect(r.filas[0]).toMatchObject({ contactoNombre: 'Imprenta Sol', masDe90Centimos: 20_000 });
    expect(r.filas[1]).toMatchObject({ vigenteCentimos: 5_000, de1a30Centimos: 3_000 });
    expect(r.totales).toEqual({ vigenteCentimos: 5_000, de1a30Centimos: 6_000, de31a60Centimos: 0, de61a90Centimos: 0, masDe90Centimos: 20_000, totalCentimos: 31_000 });
  });
  it('sin deudas no hay filas ni totales', () => {
    expect(agruparAntiguedad([], '2026-04-30')).toEqual({ filas: [], totales: { vigenteCentimos: 0, de1a30Centimos: 0, de31a60Centimos: 0, de61a90Centimos: 0, masDe90Centimos: 0, totalCentimos: 0 } });
  });
});
