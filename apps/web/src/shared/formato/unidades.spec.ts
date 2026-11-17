import { describe, expect, it } from 'vitest';
import { esUnidadConocida, GRUPOS_DE_UNIDADES } from './unidades.ts';

describe('esUnidadConocida', () => {
  it('reconoce las unidades de la lista', () => {
    expect(esUnidadConocida('UND')).toBe(true);
    expect(esUnidadConocida('kg')).toBe(true);
    expect(esUnidadConocida('m²')).toBe(true);
  });
  it('rechaza lo que no está y distingue mayúsculas', () => {
    expect(esUnidadConocida('bobina')).toBe(false);
    expect(esUnidadConocida('')).toBe(false);
    expect(esUnidadConocida('und')).toBe(false);
  });
  it('no repite valores entre grupos', () => {
    const todos = GRUPOS_DE_UNIDADES.flatMap((g) => g.unidades.map((u) => u.valor));
    expect(new Set(todos).size).toBe(todos.length);
  });
});
