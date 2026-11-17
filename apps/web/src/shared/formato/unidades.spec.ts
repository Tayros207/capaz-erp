import { describe, expect, it } from 'vitest';
import { esUnidadConocida, GRUPOS_DE_UNIDADES, unidadConocida } from './unidades.ts';

describe('unidadConocida', () => {
  it('encuentra la unidad sin mirar mayúsculas (el catálogo guarda «und»)', () => {
    expect(unidadConocida('und')).toBe('UND');
    expect(unidadConocida(' KG ')).toBe('kg');
    expect(unidadConocida('bobina')).toBeUndefined();
  });
});

describe('esUnidadConocida', () => {
  it('reconoce las unidades de la lista', () => {
    expect(esUnidadConocida('UND')).toBe(true);
    expect(esUnidadConocida('kg')).toBe(true);
    expect(esUnidadConocida('m²')).toBe(true);
  });
  it('rechaza lo que no está', () => {
    expect(esUnidadConocida('bobina')).toBe(false);
    expect(esUnidadConocida('')).toBe(false);
    expect(esUnidadConocida('  ')).toBe(false);
  });
  it('no repite valores entre grupos', () => {
    const todos = GRUPOS_DE_UNIDADES.flatMap((g) => g.unidades.map((u) => u.valor));
    expect(new Set(todos).size).toBe(todos.length);
  });
});
