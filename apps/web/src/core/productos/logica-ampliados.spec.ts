import { describe, expect, it } from 'vitest';
import { numeroOpcional } from './logica-ampliados.ts';

describe('numeroOpcional', () => {
  it('vacío es sin dato', () => {
    expect(numeroOpcional('  ', true)).toEqual({ ok: true, valor: null });
  });
  it('acepta decimales con coma o punto cuando no se pide entero', () => {
    expect(numeroOpcional('2500,5', false)).toEqual({ ok: true, valor: 2500.5 });
    expect(numeroOpcional('0', true)).toEqual({ ok: true, valor: 0 });
  });
  it('rechaza negativos, texto y decimales donde se pide entero', () => {
    for (const t of ['-1', 'abc']) expect(numeroOpcional(t, false).ok).toBe(false);
    expect(numeroOpcional('12.5', true).ok).toBe(false);
  });
});
