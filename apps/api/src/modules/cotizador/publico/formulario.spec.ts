import { describe, expect, it } from 'vitest';
import { LARGO_MAXIMO_DE_NOTA, limpiarNota } from './formulario.js';

describe('limpiarNota', () => {
  it('quita controles, recorta y deja vacío como null', () => {
    expect(limpiarNota('  Muy\u0000 caro\u0007  ')).toBe('Muy caro');
    expect(limpiarNota('a\r\nb')).toBe('a\nb');
    expect(limpiarNota('   ')).toBeNull();
    expect(limpiarNota(null)).toBeNull();
  });
  it('corta en el largo máximo', () => {
    expect(limpiarNota('x'.repeat(500))).toHaveLength(LARGO_MAXIMO_DE_NOTA);
  });
});
