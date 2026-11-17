import { describe, expect, it } from 'vitest';
import { calcularKardex, valorEnCentimos, type MovimientoParaKardex } from './kardex.js';

let n = 0;
const mov = (tipo: MovimientoParaKardex['tipo'], cantidadMilesimas: number, costoUnitarioMilesimas: number | null = null): MovimientoParaKardex => ({
  movimientoId: `m${++n}`,
  fecha: '2026-03-01T10:00:00.000Z',
  tipo,
  cantidadMilesimas,
  costoUnitarioMilesimas,
  motivo: null,
});

describe('valorEnCentimos', () => {
  it('10 unidades a S/ 2.50 son S/ 25.00', () => expect(valorEnCentimos(10_000, 2_500)).toBe(2_500));
  it('redondea al céntimo', () => expect(valorEnCentimos(333, 1_000)).toBe(33));
});

describe('calcularKardex', () => {
  it('sin movimientos: todo en cero', () => {
    expect(calcularKardex([])).toEqual({ items: [], saldoMilesimas: 0, costoPromedioMilesimas: 0, valorTotalCentimos: 0, costosIncompletos: false });
  });

  it('promedia ponderado: 10 a 2.00 y 10 a 3.00 dan 2.50', () => {
    const k = calcularKardex([mov('entrada', 10_000, 2_000), mov('entrada', 10_000, 3_000)]);
    expect(k.costoPromedioMilesimas).toBe(2_500);
    expect(k.saldoMilesimas).toBe(20_000);
    expect(k.valorTotalCentimos).toBe(5_000);
  });

  it('una salida sale al promedio y no lo cambia', () => {
    const k = calcularKardex([mov('entrada', 10_000, 2_000), mov('entrada', 10_000, 3_000), mov('salida', -5_000)]);
    expect(k.items[2]).toMatchObject({ salidaMilesimas: 5_000, saldoMilesimas: 15_000, costoPromedioMilesimas: 2_500, saldoValorizadoCentimos: 3_750 });
  });

  it('una entrada sin costo entra al promedio vigente y marca costos incompletos', () => {
    const k = calcularKardex([mov('entrada', 10_000, 2_000), mov('entrada', 10_000)]);
    expect(k.costoPromedioMilesimas).toBe(2_000);
    expect(k.costosIncompletos).toBe(true);
  });

  it('un ajuste al alza no cambia el costo y a la baja resta al promedio', () => {
    const k = calcularKardex([mov('entrada', 10_000, 2_000), mov('ajuste', 2_000), mov('ajuste', -4_000)]);
    expect(k.items.map((i) => i.saldoMilesimas)).toEqual([10_000, 12_000, 8_000]);
    expect(k.costoPromedioMilesimas).toBe(2_000);
    expect(k.valorTotalCentimos).toBe(1_600);
  });

  it('con saldo cero conserva el último promedio y la siguiente entrada lo recalcula', () => {
    const k = calcularKardex([mov('entrada', 5_000, 2_000), mov('salida', -5_000), mov('entrada', 5_000, 4_000)]);
    expect(k.items[1]).toMatchObject({ saldoMilesimas: 0, costoPromedioMilesimas: 2_000, saldoValorizadoCentimos: 0 });
    expect(k.costoPromedioMilesimas).toBe(4_000);
  });
});
