import { describe, expect, it } from 'vitest';
import { agregarUnidad, moverUnidad, quitarUnidad } from './logica-unidades.ts';

describe('unidades de la empresa (edición)', () => {
  it('agrega normalizando y rechaza vacías, largas, repetidas (sin mayúsculas ni tildes) y pasar de 40', () => {
    expect(agregarUnidad(['unidad'], '  caja  grande ')).toEqual({ lista: ['unidad', 'caja grande'] });
    expect(agregarUnidad(['unidad'], '   ')).toEqual({ error: 'Escribe la unidad.' });
    expect(agregarUnidad(['unidad'], 'x'.repeat(21))).toHaveProperty('error');
    expect(agregarUnidad(['Millar'], ' millár ')).toEqual({ error: 'Esa unidad ya está en la lista.' });
    expect(agregarUnidad(Array.from({ length: 40 }, (_, i) => `u${i}`), 'nueva')).toHaveProperty('error');
  });
  it('quita sin dejar la lista vacía', () => {
    expect(quitarUnidad(['a', 'b'], 0)).toEqual(['b']);
    expect(quitarUnidad(['a'], 0)).toEqual(['a']);
  });
  it('reordena y en los bordes no cambia nada', () => {
    expect(moverUnidad(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moverUnidad(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moverUnidad(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
