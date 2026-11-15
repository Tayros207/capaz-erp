import { describe, expect, it } from 'vitest';
import {
  alternarOrden,
  alternarSeleccion,
  alternarTodas,
  ariaSort,
  estadoDeSeleccion,
  loteDesde,
  ordenarFilas,
} from './logica-lista.ts';

describe('orden', () => {
  it('alterna ninguno, ascendente, descendente, ninguno', () => {
    const a = alternarOrden(null, 'nombre');
    expect(a).toEqual({ columna: 'nombre', direccion: 'asc' });
    const b = alternarOrden(a, 'nombre');
    expect(b).toEqual({ columna: 'nombre', direccion: 'desc' });
    expect(alternarOrden(b, 'nombre')).toBeNull();
    expect(alternarOrden(b, 'otra')).toEqual({ columna: 'otra', direccion: 'asc' });
  });

  it('da el valor de aria-sort', () => {
    expect(ariaSort(null, 'x')).toBe('none');
    expect(ariaSort({ columna: 'x', direccion: 'asc' }, 'x')).toBe('ascending');
    expect(ariaSort({ columna: 'x', direccion: 'desc' }, 'x')).toBe('descending');
    expect(ariaSort({ columna: 'y', direccion: 'desc' }, 'x')).toBe('none');
  });

  it('ordena texto con orden natural y números, sin mutar, vacíos al final', () => {
    const filas = [{ n: 'Item 10' }, { n: null }, { n: 'Item 2' }, { n: 'Ángel' }];
    const copia = [...filas];
    expect(ordenarFilas(filas, (f) => f.n, 'asc').map((f) => f.n)).toEqual(['Ángel', 'Item 2', 'Item 10', null]);
    expect(ordenarFilas(filas, (f) => f.n, 'desc').map((f) => f.n)).toEqual(['Item 10', 'Item 2', 'Ángel', null]);
    expect(filas).toEqual(copia);
    expect(ordenarFilas([3, 1, 2], (x) => x, 'asc')).toEqual([1, 2, 3]);
  });

  it('es estable con valores iguales', () => {
    const filas = [{ k: 1, i: 'a' }, { k: 1, i: 'b' }, { k: 0, i: 'c' }];
    expect(ordenarFilas(filas, (f) => f.k, 'asc').map((f) => f.i)).toEqual(['c', 'a', 'b']);
  });
});

describe('selección', () => {
  const ids = ['a', 'b', 'c'];
  it('calcula el estado', () => {
    expect(estadoDeSeleccion(new Set(), ids)).toBe('ninguna');
    expect(estadoDeSeleccion(new Set(['a']), ids)).toBe('algunas');
    expect(estadoDeSeleccion(new Set(ids), ids)).toBe('todas');
  });
  it('alterna una fila sin mutar', () => {
    const base = new Set(['a']);
    expect([...alternarSeleccion(base, 'b')]).toEqual(['a', 'b']);
    expect([...alternarSeleccion(base, 'a')]).toEqual([]);
    expect([...base]).toEqual(['a']);
  });
  it('marca todas o las quita, respetando lo marcado fuera de la vista', () => {
    expect(alternarTodas(new Set(['a']), ids).size).toBe(3);
    expect([...alternarTodas(new Set([...ids, 'z']), ids)]).toEqual(['z']);
  });
});

describe('lotes por cursor', () => {
  const filas = Array.from({ length: 5 }, (_, i) => i);
  it('recorre hasta el final', () => {
    const l1 = loteDesde(filas, null, 2);
    expect(l1).toEqual({ items: [0, 1], siguiente: '2' });
    const l3 = loteDesde(filas, '4', 2);
    expect(l3).toEqual({ items: [4], siguiente: null });
  });
  it('tolera un cursor inválido', () => {
    expect(loteDesde(filas, 'xx', 2).items).toEqual([0, 1]);
  });
});
