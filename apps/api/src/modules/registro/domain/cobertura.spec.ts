import { describe, expect, it } from 'vitest';
import { calcularCobertura, rangoDelMes } from './cobertura.js';

const base = { compromisosPagadosCentimos: 0, compromisos: 0 };

describe('calcularCobertura', () => {
  it('sin compromisos no hay porcentaje ni falta', () => {
    expect(calcularCobertura({ ...base, ingresosCentimos: 50_000, compromisosCentimos: 0 })).toMatchObject({ porcentaje: null, faltaCentimos: 0 });
  });
  it('54 %: lo que falta es la diferencia', () => {
    expect(calcularCobertura({ ...base, compromisos: 3, ingresosCentimos: 540_000, compromisosCentimos: 1_000_000 })).toMatchObject({ porcentaje: 54, faltaCentimos: 460_000 });
  });
  it('ingresos que superan lo comprometido: falta 0 y pasa de 100 %', () => {
    expect(calcularCobertura({ ...base, compromisos: 1, ingresosCentimos: 1_500_000, compromisosCentimos: 1_000_000 })).toMatchObject({ porcentaje: 150, faltaCentimos: 0 });
  });
  it('redondea el porcentaje', () => {
    expect(calcularCobertura({ ...base, compromisos: 1, ingresosCentimos: 1, compromisosCentimos: 3 }).porcentaje).toBe(33);
  });
});

describe('rangoDelMes', () => {
  it('da el primer y el último día, también en febrero bisiesto', () => {
    expect(rangoDelMes('2026-11')).toEqual({ mes: '2026-11', desde: '2026-11-01', hasta: '2026-11-30' });
    expect(rangoDelMes('2028-02').hasta).toBe('2028-02-29');
    expect(rangoDelMes('2026-12').hasta).toBe('2026-12-31');
  });
});
