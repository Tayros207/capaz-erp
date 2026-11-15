import { describe, expect, it } from 'vitest';
import { normalizarCodigoDeSucursal, prepararSucursal, puedeArchivarse } from './sucursal.js';

describe('código de sucursal', () => {
  it('2 a 6 letras o cifras, en mayúsculas', () => {
    expect(normalizarCodigoDeSucursal(' pri ')).toBe('PRI');
    expect(normalizarCodigoDeSucursal('a')).toBeNull();
    expect(normalizarCodigoDeSucursal('abcdefg')).toBeNull();
    expect(normalizarCodigoDeSucursal('a-b')).toBeNull();
  });
  it('prepararSucursal valida código y nombre', () => {
    expect(prepararSucursal({ codigo: 'lim1', nombre: ' Lima  Centro ' })).toMatchObject({ ok: true, datos: { codigo: 'LIM1', nombre: 'Lima Centro' } });
    expect(prepararSucursal({ codigo: 'x', nombre: 'a' })).toMatchObject({ ok: false, campo: 'codigo' });
    expect(prepararSucursal({ codigo: 'LIM', nombre: ' ' })).toMatchObject({ ok: false, campo: 'nombre' });
  });
  it('la principal no se archiva', () => {
    expect(puedeArchivarse({ esPrincipal: true })).toBe(false);
    expect(puedeArchivarse({ esPrincipal: false })).toBe(true);
  });
});
