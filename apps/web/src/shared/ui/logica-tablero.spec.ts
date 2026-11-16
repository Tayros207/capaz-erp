import { describe, expect, it } from 'vitest';
import { columnaVisible } from './logica-tablero.ts';

const cols = [
  { id: 'a', filas: [] },
  { id: 'b', filas: [1] },
  { id: 'c', filas: [2, 3] },
];

describe('columnaVisible', () => {
  it('respeta la elegida si existe', () => expect(columnaVisible(cols, 'c')).toBe('c'));
  it('sin elegida, la primera con filas', () => expect(columnaVisible(cols, null)).toBe('b'));
  it('elegida inexistente cae a la primera con filas', () => expect(columnaVisible(cols, 'z')).toBe('b'));
  it('todas vacías: la primera', () => expect(columnaVisible([{ id: 'x', filas: [] }, { id: 'y', filas: [] }], null)).toBe('x'));
  it('sin columnas: cadena vacía', () => expect(columnaVisible([], null)).toBe(''));
});
