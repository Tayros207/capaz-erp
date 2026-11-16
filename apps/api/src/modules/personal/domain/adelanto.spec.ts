import { describe, expect, it } from 'vitest';
import { codigoDeAdelanto, comprobarFechaDeAdelanto, puedeAnularseElAdelanto } from './adelanto.js';
import { codificarCursorPorFecha, codificarCursorPorNombre, decodificarCursorPorFecha, decodificarCursorPorNombre } from './cursor.js';

describe('codigoDeAdelanto', () => {
  it('lleva año y cuatro cifras, y conserva las de un número mayor', () => {
    expect(codigoDeAdelanto(2026, 1)).toBe('ADE-2026-0001');
    expect(codigoDeAdelanto(2026, 12345)).toBe('ADE-2026-12345');
  });
  it('rechaza año o número inválidos', () => {
    expect(() => codigoDeAdelanto(26, 1)).toThrow(RangeError);
    expect(() => codigoDeAdelanto(2026, 0)).toThrow(RangeError);
  });
});

describe('reglas del adelanto', () => {
  it('no admite fecha futura', () => {
    expect(comprobarFechaDeAdelanto('2026-03-10', '2026-03-10')).toEqual({ ok: true });
    expect(comprobarFechaDeAdelanto('2026-03-11', '2026-03-10')).toMatchObject({ ok: false });
  });
  it('solo se anula uno registrado', () => {
    expect(puedeAnularseElAdelanto('registrado')).toEqual({ ok: true });
    expect(puedeAnularseElAdelanto('anulado')).toMatchObject({ ok: false });
  });
});

describe('cursores', () => {
  const id = '0192f0c4-7b1e-7000-8000-000000000010';
  it('ida y vuelta; un nombre con barra se conserva', () => {
    expect(decodificarCursorPorNombre(codificarCursorPorNombre({ nombre: 'ana|luz', id }))).toEqual({ nombre: 'ana|luz', id });
    expect(decodificarCursorPorFecha(codificarCursorPorFecha({ fecha: '2026-03-10', id }))).toEqual({ fecha: '2026-03-10', id });
  });
  it('un cursor basura es inválido', () => {
    expect(decodificarCursorPorNombre('zzz')).toBeNull();
    expect(decodificarCursorPorFecha(codificarCursorPorFecha({ fecha: 'hola', id }))).toBeNull();
  });
});
