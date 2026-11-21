import { describe, expect, it } from 'vitest';
import type { CostoPorArticuloDto } from '@capaz/shared';
import { argumentosDeCostos, errorDePeriodo, hayFiltrosDeCostos, ordenarPorVariacion, proveedorMasBarato, SIN_FILTROS_DE_COSTOS, textoDeCompras, variacionDeCosto } from './logica-costos.ts';

const articulo = (extra: Partial<CostoPorArticuloDto> = {}): CostoPorArticuloDto => ({
  clave: 'k', productoId: null, descripcion: 'Papel de prueba', unidad: 'millar', compras: 2, ultimoCostoMilesimas: 23_600, ultimaFecha: '2026-03-01',
  ultimoProveedorId: 'p1', ultimoProveedorNombre: 'Proveedor Uno', medianaMilesimas: 22_000, minimoMilesimas: 21_000, maximoMilesimas: 24_000,
  variacionPorcentaje: 7, masBaratoProveedorId: null, porProveedor: [], ...extra,
});

describe('período', () => {
  it('vacío o completo y corto vale; al revés o de más de 2 años, no', () => {
    expect(errorDePeriodo({ desde: '', hasta: '' })).toBeUndefined();
    expect(errorDePeriodo({ desde: '2026-01-01', hasta: '' })).toBeUndefined();
    expect(errorDePeriodo({ desde: '2025-01-01', hasta: '2026-01-01' })).toBeUndefined();
    expect(errorDePeriodo({ desde: '2026-02-01', hasta: '2026-01-01' })).toBe('El período empieza antes de terminar.');
    expect(errorDePeriodo({ desde: '2023-01-01', hasta: '2026-01-01' })).toBe('El período abarca como máximo 2 años.');
    expect(errorDePeriodo({ desde: '2024-01-01', hasta: '2025-12-31' })).toBeUndefined(); // 730 días
    expect(errorDePeriodo({ desde: '2024-01-01', hasta: '2026-01-01' })).toBe('El período abarca como máximo 2 años.'); // 731 días
  });
  it('los argumentos omiten lo vacío y recortan la búsqueda', () => {
    expect(argumentosDeCostos(SIN_FILTROS_DE_COSTOS)).toEqual({});
    expect(argumentosDeCostos({ buscar: ' papel ', desde: '2026-01-01', hasta: '' })).toEqual({ buscar: 'papel', desde: '2026-01-01' });
    expect(hayFiltrosDeCostos(SIN_FILTROS_DE_COSTOS)).toBe(false);
    expect(hayFiltrosDeCostos({ ...SIN_FILTROS_DE_COSTOS, buscar: 'a' })).toBe(true);
  });
});

describe('variación', () => {
  it('siempre dice con palabras si subió o bajó', () => {
    expect(variacionDeCosto(null)).toEqual({ texto: 'Sin referencia', tono: 'neutro' });
    expect(variacionDeCosto(0)).toEqual({ texto: 'Sin cambio', tono: 'neutro' });
    expect(variacionDeCosto(5)).toEqual({ texto: 'Subió 5 %', tono: 'aviso' });
    expect(variacionDeCosto(12)).toEqual({ texto: 'Subió 12 %', tono: 'peligro' });
    expect(variacionDeCosto(-8)).toEqual({ texto: 'Bajó 8 %', tono: 'exito' });
  });
});

describe('proveedores y orden', () => {
  it('el más barato solo si hay con quién comparar', () => {
    expect(proveedorMasBarato(articulo())).toBeNull();
    const pp = { proveedorId: 'p2', proveedorNombre: 'Proveedor Dos', compras: 1, ultimoCostoMilesimas: 1, ultimaFecha: '2026-01-01', medianaMilesimas: 1, minimoMilesimas: 1 };
    expect(proveedorMasBarato(articulo({ masBaratoProveedorId: 'p2', porProveedor: [pp] }))).toBe('Proveedor Dos');
  });
  it('ordena de la mayor subida a la mayor baja y deja sin referencia al final', () => {
    const r = ordenarPorVariacion([articulo({ descripcion: 'B', variacionPorcentaje: null }), articulo({ descripcion: 'A', variacionPorcentaje: -3 }), articulo({ descripcion: 'C', variacionPorcentaje: 20 })]);
    expect(r.map((a) => a.descripcion)).toEqual(['C', 'A', 'B']);
  });
  it('cuenta compras en singular y plural', () => {
    expect(textoDeCompras(1)).toBe('1 compra');
    expect(textoDeCompras(4)).toBe('4 compras');
  });
});
