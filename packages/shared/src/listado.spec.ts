import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { listadoSchema, paginaSchema } from './listado.js';

describe('paginaSchema', () => {
  it('pone límite 25 por defecto y acepta cursor opcional', () => {
    expect(paginaSchema.parse({})).toEqual({ limite: 25 });
    expect(paginaSchema.parse({ limite: 100, cursor: 'abc' })).toEqual({ limite: 100, cursor: 'abc' });
  });
  it.each([{ limite: 0 }, { limite: 101 }, { limite: 1.5 }, { cursor: 'x'.repeat(201) }, { otro: 1 }])('rechaza %j', (v) => {
    expect(paginaSchema.safeParse(v).success).toBe(false);
  });
  it('se extiende con filtros', () => {
    const s = paginaSchema.extend({ buscar: z.string().optional() });
    expect(s.parse({ buscar: 'ana' })).toEqual({ limite: 25, buscar: 'ana' });
  });
});

describe('listadoSchema', () => {
  it('envuelve items y siguiente', () => {
    const s = listadoSchema(z.strictObject({ id: z.string() }));
    expect(s.parse({ items: [{ id: 'a' }], siguiente: null })).toEqual({ items: [{ id: 'a' }], siguiente: null });
    expect(s.safeParse({ items: [{ id: 'a' }] }).success).toBe(false);
  });
});
