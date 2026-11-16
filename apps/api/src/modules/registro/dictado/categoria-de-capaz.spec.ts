import { describe, expect, test } from 'vitest';
import { CATEGORIAS_POR_DEFECTO } from '../domain/catalogos.js';
import { categoriaDeCapaz } from './categoria-de-capaz.js';
import { CATEGORIAS_EGRESO, CATEGORIAS_INGRESO } from './reglas/categorias-de-rubro.js';

describe('categoriaDeCapaz (regla nueva, no portada)', () => {
  test('las 16 categorías del rubro tienen destino entre las de Capaz con el mismo tipo', () => {
    expect(CATEGORIAS_EGRESO.length + CATEGORIAS_INGRESO.length).toBe(16);
    for (const [lista, tipo] of [[CATEGORIAS_EGRESO, 'egreso'], [CATEGORIAS_INGRESO, 'ingreso']] as const) {
      for (const c of lista) {
        const destino = categoriaDeCapaz(c);
        expect(CATEGORIAS_POR_DEFECTO.some((d) => d.nombre === destino && d.tipo === tipo), `${c} -> ${destino}`).toBe(true);
      }
    }
  });

  test('«Cobros» y «Pagos» nunca son destino', () => {
    for (const c of [...CATEGORIAS_EGRESO, ...CATEGORIAS_INGRESO]) {
      expect(['Cobros', 'Pagos']).not.toContain(categoriaDeCapaz(c));
    }
  });

  test.each([
    ['materia_prima', 'Compras'],
    ['maquinaria', 'Compras'],
    ['mano_obra', 'Sueldos'],
    ['local', 'Servicios'],
    ['impuestos', 'Otros egresos'],
    ['diseno', 'Ventas'],
    ['otros_ingresos', 'Otros ingresos'],
  ] as const)('%s -> %s', (rubro, esperado) => {
    expect(categoriaDeCapaz(rubro)).toBe(esperado);
  });
});
