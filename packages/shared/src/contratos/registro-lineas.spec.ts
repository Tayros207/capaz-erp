import { describe, expect, it } from 'vitest';
import { calcularLineasDeMovimiento, lineaDeMovimientoEntradaSchema, lineasDeMovimientoEntradaSchema, MAXIMO_DE_LINEAS_DE_MOVIMIENTO } from './registro-lineas.js';

describe('líneas de un movimiento', () => {
  it('calcula el subtotal de cada línea y la suma', () => {
    const r = calcularLineasDeMovimiento([
      { descripcion: 'Etiquetas', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 65_000 },
      { descripcion: ' Troquelado ', unidad: 'unidad', cantidadMilesimas: 500, precioUnitarioMilesimas: 365 },
    ]);
    expect(r.lineas.map((l) => l.subtotalCentimos)).toEqual([13_000, 18]);
    expect(r.totalCentimos).toBe(13_018);
    expect(r.lineas[1]?.descripcion).toBe('Troquelado');
    expect(r.lineas[0]?.productoId).toBeNull();
  });

  it('sin líneas la suma es cero', () => {
    expect(calcularLineasDeMovimiento([])).toEqual({ lineas: [], totalCentimos: 0 });
  });

  it('la unidad por defecto es «unidad» y la entrada pide descripción y cantidad', () => {
    const ok = lineaDeMovimientoEntradaSchema.parse({ descripcion: 'Bolsas', cantidadMilesimas: 1000, precioUnitarioMilesimas: 0 });
    expect(ok.unidad).toBe('unidad');
    expect(lineaDeMovimientoEntradaSchema.safeParse({ descripcion: '  ', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1 }).success).toBe(false);
    expect(lineaDeMovimientoEntradaSchema.safeParse({ descripcion: 'x', cantidadMilesimas: 0, precioUnitarioMilesimas: 1 }).success).toBe(false);
    expect(lineaDeMovimientoEntradaSchema.safeParse({ descripcion: 'x', cantidadMilesimas: 1, precioUnitarioMilesimas: -1 }).success).toBe(false);
  });

  it('admite hasta el máximo de líneas', () => {
    const una = { descripcion: 'x', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1000 };
    expect(lineasDeMovimientoEntradaSchema.safeParse(Array.from({ length: MAXIMO_DE_LINEAS_DE_MOVIMIENTO }, () => una)).success).toBe(true);
    expect(lineasDeMovimientoEntradaSchema.safeParse(Array.from({ length: MAXIMO_DE_LINEAS_DE_MOVIMIENTO + 1 }, () => una)).success).toBe(false);
  });
});
