import { describe, expect, it } from 'vitest';
import { agruparCostos, mediana, normalizarDescripcion, recortarArticulos, resolverPeriodoDeCostos, variacionPorcentaje, type LineaDeCosto } from './costos.js';

const linea = (extra: Partial<LineaDeCosto> = {}): LineaDeCosto => ({
  productoId: null, descripcion: 'Papel bond A4', unidad: 'resma', costoUnitarioMilesimas: 10_000, fecha: '2026-01-10', proveedorId: 'p1', proveedorNombre: 'Distribuidora Uno', ...extra,
});

describe('mediana y variación', () => {
  it('toma el del medio y, con cantidad par, el promedio redondeado hacia arriba', () => {
    expect(mediana([30, 10, 20])).toBe(20);
    expect(mediana([10, 21])).toBe(16);
    expect(mediana([7])).toBe(7);
  });
  it('variación redondeada, negativa si bajó y nula con mediana cero', () => {
    expect(variacionPorcentaje(12_000, 10_000)).toBe(20);
    expect(variacionPorcentaje(9_000, 10_000)).toBe(-10);
    expect(variacionPorcentaje(10_333, 10_000)).toBe(3);
    expect(variacionPorcentaje(5, 0)).toBeNull();
  });
});

describe('período', () => {
  it('por defecto son los últimos 365 días hasta hoy', () => {
    expect(resolverPeriodoDeCostos({}, '2026-11-20')).toEqual({ desde: '2025-11-20', hasta: '2026-11-20' });
  });
  it('rechaza el período al revés y el de más de 2 años', () => {
    expect(resolverPeriodoDeCostos({ desde: '2026-02-01', hasta: '2026-01-01' }, '2026-11-20')).toEqual({ error: 'El período empieza antes de terminar.' });
    expect(resolverPeriodoDeCostos({ desde: '2024-01-01', hasta: '2026-01-02' }, '2026-11-20')).toEqual({ error: 'El período abarca como máximo 2 años.' });
    expect(resolverPeriodoDeCostos({ desde: '2024-01-02', hasta: '2026-01-01' }, '2026-11-20')).toMatchObject({ desde: '2024-01-02' });
  });
});

describe('agruparCostos', () => {
  it('agrupa por descripción normalizada y unidad cuando no hay producto', () => {
    const r = agruparCostos([linea({ descripcion: 'Papel  Bond A4' }), linea({ descripcion: 'papel bond a4', fecha: '2026-02-01', costoUnitarioMilesimas: 12_000 }), linea({ unidad: 'caja' })]);
    expect(r).toHaveLength(2);
    expect(normalizarDescripcion('Cartulina Ílustración')).toBe('cartulina ilustracion');
  });
  it('último por fecha, mediana, mínimo, máximo y variación', () => {
    const [a] = agruparCostos([
      linea({ costoUnitarioMilesimas: 10_000, fecha: '2026-01-01' }),
      linea({ costoUnitarioMilesimas: 14_000, fecha: '2026-03-01' }),
      linea({ costoUnitarioMilesimas: 12_000, fecha: '2026-02-01' }),
    ]);
    expect(a).toMatchObject({ compras: 3, ultimoCostoMilesimas: 14_000, ultimaFecha: '2026-03-01', medianaMilesimas: 12_000, minimoMilesimas: 10_000, maximoMilesimas: 14_000, variacionPorcentaje: 17, masBaratoProveedorId: null });
  });
  it('compara proveedores: el más barato por su último costo', () => {
    const [a] = agruparCostos([
      linea({ proveedorId: 'p1', proveedorNombre: 'Uno', costoUnitarioMilesimas: 10_000, fecha: '2026-01-01' }),
      linea({ proveedorId: 'p2', proveedorNombre: 'Dos', costoUnitarioMilesimas: 9_000, fecha: '2026-02-01' }),
      linea({ proveedorId: 'p1', proveedorNombre: 'Uno', costoUnitarioMilesimas: 8_000, fecha: '2026-03-01' }),
    ]);
    expect(a!.masBaratoProveedorId).toBe('p1');
    expect(a!.porProveedor.map((p) => [p.proveedorId, p.compras, p.ultimoCostoMilesimas, p.medianaMilesimas, p.minimoMilesimas])).toEqual([['p1', 2, 8_000, 9_000, 8_000], ['p2', 1, 9_000, 9_000, 9_000]]);
    expect(a!.ultimoProveedorId).toBe('p1');
  });
  it('un producto agrupa por su id aunque la descripción cambie', () => {
    const r = agruparCostos([linea({ productoId: 'x', descripcion: 'Tinta' }), linea({ productoId: 'x', descripcion: 'Tinta negra', fecha: '2026-02-01' })]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ productoId: 'x', descripcion: 'Tinta negra', compras: 2 });
  });
});

describe('recortarArticulos', () => {
  it('con 250 artículos se queda con los 200 de compra más reciente, en orden alfabético, y marca truncado', () => {
    // «Artículo 000» es el más antiguo y «Artículo 249» el más reciente: alfabéticamente los primeros 200 serían los más viejos.
    const lineas = Array.from({ length: 250 }, (_, i) => linea({ descripcion: `Artículo ${String(i).padStart(3, '0')}`, fecha: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10) }));
    const r = recortarArticulos(agruparCostos(lineas));
    expect(r.truncado).toBe(true);
    expect(r.articulos).toHaveLength(200);
    expect(r.articulos[0]!.descripcion).toBe('Artículo 050');
    expect(r.articulos[199]!.descripcion).toBe('Artículo 249');
    expect(r.articulos.some((a) => a.descripcion === 'Artículo 049')).toBe(false);
  });
  it('con 200 o menos no se recorta', () => {
    const r = recortarArticulos(agruparCostos(Array.from({ length: 200 }, (_, i) => linea({ descripcion: `Artículo ${i}` }))));
    expect(r).toMatchObject({ truncado: false });
    expect(r.articulos).toHaveLength(200);
  });
});
