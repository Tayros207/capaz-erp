import { describe, expect, it } from 'vitest';
import type { FotoDeVersionDto } from '@capaz/shared';
import { comprobarSoloPrecioEIgv, diferenciasDeLineas, resolverLineas, type LineaActual } from './correccion.js';
import { fichaCorregida, fichaTocada, fotoConFicha } from './ficha.js';

const actual = (id: string, extra: Partial<LineaActual> = {}): LineaActual => ({ id, posicion: 0, productoId: null, descripcion: 'Volantes', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 59_000, afectoIgv: true, importeCentimos: 11_800, ...extra });
const nueva = (id: string | undefined, extra: Record<string, unknown> = {}) => ({ id, descripcion: 'Volantes', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 59_000, afectoIgv: true, ...extra });
const resultante = (l: LineaActual, extra: Record<string, unknown> = {}) => ({ ...l, ...extra });

describe('fichaCorregida', () => {
  it('D1 ausente conserva; vacío y null borran; en línea nueva queda lo escrito', () => {
    expect(fichaCorregida({}, { material: 'a', medida: 'b' })).toEqual({ material: 'a', medida: 'b', colores: null, acabado: null });
    expect(fichaCorregida({ material: '' }, { material: 'a' }).material).toBeNull();
    expect(fichaCorregida({ material: 'c' }, undefined).material).toBe('c');
    expect(fichaCorregida({ medida: null }, { medida: 'A5' }).medida).toBeNull();
  });
});

describe('fichaTocada', () => {
  it('D2 lo ausente y lo igual no cuentan', () => {
    expect(fichaTocada({ material: 'a' }, {})).toBe(false);
    expect(fichaTocada({ material: 'a' }, { material: ' a ' })).toBe(false);
    expect(fichaTocada({ material: 'a' }, { material: 'b' })).toBe(true);
    expect(fichaTocada({ material: 'a' }, { material: null })).toBe(true);
  });
});

describe('ficha en la huella y en el modo «solo precio»', () => {
  it('D3 un cambio de ficha es una línea cambiada', () => {
    const d = diferenciasDeLineas([actual('a', { material: 'x' })], [resultante(actual('a', { material: 'y' }))]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ cambio: 'cambiada', antes: { material: 'x' }, despues: { material: 'y' } });
  });
  it('D4 undefined equivale a null: sin cambio espurio', () => {
    expect(diferenciasDeLineas([actual('a')], [resultante(actual('a'), { material: null })])).toEqual([]);
  });
  it('D5 en un pedido entregado la ficha no se toca', () => {
    const r = (n: unknown) => resolverLineas([actual('a', { material: 'x' })], [n as never]);
    const mala = r(nueva('a', { material: 'y' }));
    if (!mala.ok) throw new Error(mala.motivo);
    expect(comprobarSoloPrecioEIgv(mala.lineas).ok).toBe(false);
    for (const n of [nueva('a', { material: 'x' }), nueva('a')]) {
      const buena = r(n);
      if (!buena.ok) throw new Error(buena.motivo);
      expect(comprobarSoloPrecioEIgv(buena.lineas).ok).toBe(true);
    }
  });
});

describe('fotoConFicha', () => {
  it('D6 completa con null las fotos viejas y respeta las nuevas', () => {
    const l = { id: 'a', posicion: 0, productoId: null, descripcion: 'x', unidad: 'u', cantidadMilesimas: 1, precioUnitarioMilesimas: 1, afectoIgv: true, importeCentimos: 1 };
    const foto = { estado: 'confirmado', lineas: [l, { ...l, id: 'b', material: 'couché' }] } as unknown as FotoDeVersionDto;
    const r = fotoConFicha(foto);
    expect(r.lineas[0]).toEqual({ ...l, material: null, medida: null, colores: null, acabado: null });
    expect(r.lineas[1]).toMatchObject({ id: 'b', material: 'couché', medida: null });
    expect(r.estado).toBe('confirmado');
    expect(foto.lineas[0]).not.toHaveProperty('material');
  });
});
