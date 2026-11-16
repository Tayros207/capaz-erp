import { describe, expect, it } from 'vitest';
import { codificarCursorPorInstante, codificarCursorPorNombre, decodificarCursorPorInstante, decodificarCursorPorNombre } from './cursor.js';
import { agruparLineas, lineasParaRecibir, resumenDeRecepcion } from './recepcion.js';

const A = '0192f0c4-7b1e-7000-8000-00000000000a';
const B = '0192f0c4-7b1e-7000-8000-00000000000b';

describe('agruparLineas: un movimiento por artículo y origen', () => {
  it('suma las cantidades del mismo artículo y conserva el orden de aparición', () => {
    expect(
      agruparLineas([
        { articuloId: A, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 500 },
        { articuloId: B, cantidadMilesimas: 2_000 },
        { articuloId: A, cantidadMilesimas: 500, costoUnitarioMilesimas: 600 },
      ]),
    ).toEqual([
      { articuloId: A, cantidadMilesimas: 1_500, costoUnitarioMilesimas: 600 },
      { articuloId: B, cantidadMilesimas: 2_000 },
    ]);
  });

  it('una línea sin costo no borra el costo informativo de otra del mismo artículo', () => {
    expect(agruparLineas([{ articuloId: A, cantidadMilesimas: 1, costoUnitarioMilesimas: 9 }, { articuloId: A, cantidadMilesimas: 2 }])).toEqual([
      { articuloId: A, cantidadMilesimas: 3, costoUnitarioMilesimas: 9 },
    ]);
  });
});

describe('lineasParaRecibir (consumidor de compra.recibida)', () => {
  const articulos = new Map([['prod-1', A], ['prod-2', B]]);
  it('solo entran productos con artículo activo; los gastos sin producto y los productos sin artículo, no', () => {
    expect(
      lineasParaRecibir(
        [
          { productoId: 'prod-1', cantidadMilesimas: 3_000, costoUnitarioMilesimas: 1_200 },
          { productoId: null, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 50_000 },
          { productoId: 'prod-sin-articulo', cantidadMilesimas: 1_000, costoUnitarioMilesimas: 10 },
          { productoId: 'prod-2', cantidadMilesimas: 0, costoUnitarioMilesimas: 10 },
          { productoId: 'prod-1', cantidadMilesimas: 1_000, costoUnitarioMilesimas: 1_300 },
        ],
        articulos,
      ),
    ).toEqual([{ articuloId: A, cantidadMilesimas: 4_000, costoUnitarioMilesimas: 1_300 }]);
  });

  it('sin líneas útiles no hay nada que recibir', () => {
    expect(lineasParaRecibir([{ productoId: null, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 1 }], articulos)).toEqual([]);
  });

  it('el resumen de la bandeja dice cuántos artículos y de qué compra', () => {
    expect(resumenDeRecepcion(1, 'OC-PRI-2026-0001')).toBe('Entrada al inventario de 1 artículo por la compra OC-PRI-2026-0001');
    expect(resumenDeRecepcion(3, 'OC-PRI-2026-0002')).toBe('Entrada al inventario de 3 artículos por la compra OC-PRI-2026-0002');
  });
});

describe('cursores', () => {
  it('ida y vuelta, y basura → null', () => {
    expect(decodificarCursorPorNombre(codificarCursorPorNombre({ nombre: 'papel|bond', id: A }))).toEqual({ nombre: 'papel|bond', id: A });
    const instante = '2026-11-15 22:13:50.123456+00';
    expect(decodificarCursorPorInstante(codificarCursorPorInstante({ instante, id: B }))).toEqual({ instante, id: B });
    for (const malo of ['no-es-un-cursor', '', Buffer.from('["x","no-uuid"]').toString('base64url'), Buffer.from('[1,2]').toString('base64url')]) {
      expect(decodificarCursorPorNombre(malo), malo).toBeNull();
    }
    expect(decodificarCursorPorInstante(codificarCursorPorNombre({ nombre: 'no es fecha', id: A }))).toBeNull();
  });
});
