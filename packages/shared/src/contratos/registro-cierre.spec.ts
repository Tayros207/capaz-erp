import { describe, expect, it } from 'vitest';
import { cerrarSemanaSchema, esLunes, semanaDe } from './registro-cierre.js';

describe('semanaDe', () => {
  it('un lunes devuelve su propia semana', () => {
    expect(semanaDe('2026-11-16')).toEqual({ desde: '2026-11-16', hasta: '2026-11-21' });
  });
  it('un sábado devuelve la semana que termina ese día', () => {
    expect(semanaDe('2026-11-21')).toEqual({ desde: '2026-11-16', hasta: '2026-11-21' });
  });
  it('un domingo devuelve la semana que terminó el día anterior', () => {
    expect(semanaDe('2026-11-22')).toEqual({ desde: '2026-11-16', hasta: '2026-11-21' });
  });
  it('cruza el cambio de año', () => {
    expect(semanaDe('2027-01-01')).toEqual({ desde: '2026-12-28', hasta: '2027-01-02' });
  });
});

describe('esLunes', () => {
  it('reconoce lunes y rechaza otros días o fechas inexistentes', () => {
    expect(esLunes('2026-11-16')).toBe(true);
    expect(esLunes('2026-11-17')).toBe(false);
    expect(esLunes('2026-13-40')).toBe(false);
  });
});

describe('cerrarSemanaSchema', () => {
  const cuentaId = '0192f0c4-7b1e-7000-8000-000000000001';
  it('acepta un lunes con un conteo', () => {
    expect(cerrarSemanaSchema.safeParse({ desde: '2026-11-16', conteos: [{ cuentaId, contadoCentimos: 1000 }] }).success).toBe(true);
  });
  it('rechaza un día que no es lunes con el mensaje esperado', () => {
    const r = cerrarSemanaSchema.safeParse({ desde: '2026-11-17', conteos: [{ cuentaId, contadoCentimos: 0 }] });
    expect(r.success ? '' : r.error.issues[0]?.message).toBe('La semana se indica con su lunes (AAAA-MM-DD).');
  });
  it('rechaza sin conteos y con montos no enteros', () => {
    expect(cerrarSemanaSchema.safeParse({ desde: '2026-11-16', conteos: [] }).success).toBe(false);
    expect(cerrarSemanaSchema.safeParse({ desde: '2026-11-16', conteos: [{ cuentaId, contadoCentimos: 10.5 }] }).success).toBe(false);
  });
});
