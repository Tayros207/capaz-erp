import { describe, expect, it } from 'vitest';
import { aplicarOpcion, centimosDe, comoArgs, conCampo, sinCambios, sugerenciaDe } from './logica-tarjeta.ts';

describe('sinCambios', () => {
  it('iguales aunque cambie el orden de las claves', () => {
    expect(sinCambios({ a: 1, b: 'x' }, { b: 'x', a: 1 })).toBe(true);
  });
  it('null, vacío y ausente son lo mismo', () => {
    expect(sinCambios({ a: 1 }, { a: 1, contactoId: null, descripcion: '' })).toBe(true);
  });
  it('detecta un cambio de valor, un campo agregado o quitado', () => {
    expect(sinCambios({ montoCentimos: 50000 }, { montoCentimos: 55000 })).toBe(false);
    expect(sinCambios({ a: 1 }, { a: 1, contactoId: 'x' })).toBe(false);
    expect(sinCambios({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });
  it('compara objetos anidados', () => {
    expect(sinCambios({ a: { y: 1, x: 2 } }, { a: { x: 2, y: 1 } })).toBe(true);
  });
});

describe('conCampo', () => {
  it('pone y quita sin mutar', () => {
    const base = { a: 1 };
    expect(conCampo(base, 'b', 'z')).toEqual({ a: 1, b: 'z' });
    expect(conCampo({ a: 1, b: 2 }, 'b', null)).toEqual({ a: 1 });
    expect(base).toEqual({ a: 1 });
  });
});

describe('aplicarOpcion', () => {
  const sug = { campo: 'contactoId', texto: 'Juan', opciones: [{ id: 'c1', nombre: 'Juan Pérez' }, { id: 'c2', nombre: 'Juan Díaz' }] };
  it('aplica una opción de la sugerencia', () => expect(aplicarOpcion({ montoCentimos: 1 }, sug, 'c2')).toEqual({ montoCentimos: 1, contactoId: 'c2' }));
  it('ignora una opción que no es de la sugerencia', () => expect(aplicarOpcion({ a: 1 }, sug, 'zz')).toEqual({ a: 1 }));
  it('busca la sugerencia por campo', () => {
    expect(sugerenciaDe([sug], 'contactoId')).toBe(sug);
    expect(sugerenciaDe([sug], 'id')).toBeUndefined();
  });
});

describe('ayudas', () => {
  it('args y céntimos', () => {
    expect(comoArgs(null)).toEqual({});
    expect(comoArgs([1])).toEqual({});
    expect(centimosDe(500)).toBe(500);
    expect(centimosDe('5')).toBeNull();
    expect(centimosDe(1.5)).toBeNull();
  });
});
