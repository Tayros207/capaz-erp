import { describe, expect, it } from 'vitest';
import { claveDeUnidad, normalizarUnidad, validarUnidades } from './unidades.js';

describe('unidades de la empresa', () => {
  it('normaliza espacios y compara sin mayúsculas ni tildes', () => {
    expect(normalizarUnidad('  caja   de  12 ')).toBe('caja de 12');
    expect(claveDeUnidad('Millár')).toBe(claveDeUnidad(' millar '));
  });
  it('acepta una lista válida y la devuelve normalizada y en orden', () => {
    expect(validarUnidades([' Caja ', 'rollo'])).toEqual({ ok: true, unidades: ['Caja', 'rollo'] });
  });
  it('rechaza vacías, repetidas tras normalizar, largas y fuera de rango', () => {
    expect(validarUnidades([])).toMatchObject({ ok: false });
    expect(validarUnidades(['a', '   '])).toMatchObject({ ok: false, mensaje: 'Una unidad no puede estar vacía.' });
    expect(validarUnidades(['Millar', ' millár '])).toMatchObject({ ok: false });
    expect(validarUnidades(['x'.repeat(21)])).toMatchObject({ ok: false });
    expect(validarUnidades(Array.from({ length: 41 }, (_, i) => `u${i}`))).toMatchObject({ ok: false });
    expect(validarUnidades(Array.from({ length: 40 }, (_, i) => `u${i}`))).toMatchObject({ ok: true });
  });
});
