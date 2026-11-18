import { describe, expect, it } from 'vitest';
import { unitarioDeTotal } from './precio-total.ts';

describe('unitarioDeTotal', () => {
  it('reparte el total entre la cantidad: 580.00 entre 10 millares son 58.000 cada uno', () => {
    expect(unitarioDeTotal(58_000, 10_000)).toEqual({ precioUnitarioMilesimas: 58_000, importeCentimos: 58_000, exacto: true });
  });

  it('un unitario con decimales: 100.00 entre 3 unidades son 33.333 y el importe vuelve a dar 100.00', () => {
    expect(unitarioDeTotal(10_000, 3_000)).toEqual({ precioUnitarioMilesimas: 33_333, importeCentimos: 10_000, exacto: true });
  });

  it('cantidades con decimales: 50.00 entre 2.5 unidades son 20.000', () => {
    expect(unitarioDeTotal(5_000, 2_500)).toEqual({ precioUnitarioMilesimas: 20_000, importeCentimos: 5_000, exacto: true });
  });

  it('redondea el unitario a tres decimales, mitad hacia arriba', () => {
    // 1 céntimo entre 3 unidades: 0.00333… → 0.003
    expect(unitarioDeTotal(1, 3_000)?.precioUnitarioMilesimas).toBe(3);
    // 0.5 milésima exacta sube: 5 céntimos entre 10 unidades = 0.005 → 5; 1 céntimo entre 20 unidades = 0.0005 → 1
    expect(unitarioDeTotal(1, 20_000)?.precioUnitarioMilesimas).toBe(1);
  });

  it('avisa cuando tres decimales no alcanzan: 100.00 entre 7.000 unidades da 0.014 y el importe queda en 98.00', () => {
    expect(unitarioDeTotal(10_000, 7_000_000)).toEqual({ precioUnitarioMilesimas: 14, importeCentimos: 9_800, exacto: false });
  });

  it('un total de cero da unitario cero', () => {
    expect(unitarioDeTotal(0, 1_000)).toEqual({ precioUnitarioMilesimas: 0, importeCentimos: 0, exacto: true });
  });

  it('es nulo si falta el total o la cantidad, si la cantidad no es positiva o si el total es negativo', () => {
    expect(unitarioDeTotal(null, 1_000)).toBeNull();
    expect(unitarioDeTotal(1_000, null)).toBeNull();
    expect(unitarioDeTotal(1_000, 0)).toBeNull();
    expect(unitarioDeTotal(1_000, -1)).toBeNull();
    expect(unitarioDeTotal(-1, 1_000)).toBeNull();
  });
});
