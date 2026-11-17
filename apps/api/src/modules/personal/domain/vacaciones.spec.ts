import { describe, expect, it } from 'vitest';
import { comprobarContrato, diasInclusive, mesesCompletos, saldoDeVacaciones, seSolapan } from './vacaciones.js';

describe('diasInclusive', () => {
  it('cuenta ambos extremos', () => {
    expect(diasInclusive('2026-02-01', '2026-02-07')).toBe(7);
    expect(diasInclusive('2026-03-10', '2026-03-10')).toBe(1);
    expect(diasInclusive('2026-02-27', '2026-03-02')).toBe(4);
  });
});

describe('mesesCompletos', () => {
  it('cumple el mes al llegar al mismo número de día', () => {
    expect(mesesCompletos('2025-01-15', '2026-01-14')).toBe(11);
    expect(mesesCompletos('2025-01-15', '2026-01-15')).toBe(12);
  });
  it('si el día no existe en el mes, se cumple a fin de mes', () => {
    expect(mesesCompletos('2026-01-31', '2026-02-28')).toBe(1);
    expect(mesesCompletos('2026-01-31', '2026-02-27')).toBe(0);
  });
  it('nunca es negativo', () => expect(mesesCompletos('2026-05-01', '2026-01-01')).toBe(0));
});

describe('saldoDeVacaciones', () => {
  it('un año completo devenga 30 días y lo aprobado descuenta', () => {
    expect(saldoDeVacaciones({ fechaIngreso: '2025-03-01', corte: '2026-03-01', aprobadasDias: 7, solicitadasDias: 5 })).toEqual({ devengadosDias: 30, gozadosDias: 7, porAprobarDias: 5, saldoDias: 23 });
  });
  it('los meses sueltos devengan 2,5 y se redondea hacia abajo', () => {
    expect(saldoDeVacaciones({ fechaIngreso: '2026-01-01', corte: '2026-04-15', aprobadasDias: 0, solicitadasDias: 0 }).devengadosDias).toBe(7);
  });
  it('sin fecha de ingreso no hay devengado y el saldo puede ser negativo', () => {
    expect(saldoDeVacaciones({ fechaIngreso: null, corte: '2026-04-15', aprobadasDias: 3, solicitadasDias: 0 })).toMatchObject({ devengadosDias: 0, saldoDias: -3 });
  });
});

describe('seSolapan', () => {
  const r = (desde: string, hasta: string) => ({ desde, hasta });
  it('detecta cruces y extremos compartidos', () => {
    expect(seSolapan(r('2026-02-01', '2026-02-10'), r('2026-02-10', '2026-02-12'))).toBe(true);
    expect(seSolapan(r('2026-02-01', '2026-02-10'), r('2026-02-11', '2026-02-12'))).toBe(false);
    expect(seSolapan(r('2026-02-05', '2026-02-06'), r('2026-02-01', '2026-02-10'))).toBe(true);
  });
});

describe('comprobarContrato', () => {
  it('plazo fijo y prácticas exigen fin; el fin no puede ser anterior', () => {
    expect(comprobarContrato({ tipo: 'plazo_fijo', inicio: '2026-01-01', fin: null }).ok).toBe(false);
    expect(comprobarContrato({ tipo: 'practicas', inicio: '2026-01-01', fin: null }).ok).toBe(false);
    expect(comprobarContrato({ tipo: 'indeterminado', inicio: '2026-01-01', fin: null }).ok).toBe(true);
    expect(comprobarContrato({ tipo: 'locacion', inicio: '2026-01-10', fin: '2026-01-01' }).ok).toBe(false);
    expect(comprobarContrato({ tipo: 'plazo_fijo', inicio: '2026-01-01', fin: '2026-06-30' }).ok).toBe(true);
  });
});
