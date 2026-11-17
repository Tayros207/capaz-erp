import { describe, expect, it } from 'vitest';
import { combinarTipos, completarDatos, totalDeFilas } from './fusion.js';

const vacio = { documentoTipo: null, documentoNumero: null, telefono: null, correo: null, direccion: null };

describe('combinarTipos', () => {
  it('iguales se conservan y distintos pasan a «ambos»', () => {
    expect(combinarTipos('cliente', 'cliente')).toBe('cliente');
    expect(combinarTipos('cliente', 'proveedor')).toBe('ambos');
    expect(combinarTipos('ambos', 'proveedor')).toBe('ambos');
    expect(combinarTipos('proveedor', 'ambos')).toBe('ambos');
  });
});

describe('completarDatos', () => {
  it('completa lo que falta y nunca pisa lo que ya hay', () => {
    const r = completarDatos({ ...vacio, telefono: '999' }, { documentoTipo: 'dni', documentoNumero: '45871236', telefono: '111', correo: 'a@b.pe', direccion: 'Av. Sol 1' });
    expect(r).toEqual({ documentoTipo: 'dni', documentoNumero: '45871236', correo: 'a@b.pe', direccion: 'Av. Sol 1' });
  });
  it('un documento sin tipo no se copia y si el destino ya tiene documento no se toca', () => {
    expect(completarDatos(vacio, { ...vacio, documentoNumero: '123' })).toEqual({});
    expect(completarDatos({ ...vacio, documentoTipo: 'ruc', documentoNumero: '20123456789' }, { ...vacio, documentoTipo: 'dni', documentoNumero: '45871236' })).toEqual({});
  });
  it('sin diferencias no cambia nada', () => expect(completarDatos(vacio, vacio)).toEqual({}));
});

describe('totalDeFilas', () => {
  it('suma las filas', () => expect(totalDeFilas([{ filas: 2 }, { filas: 3 }])).toBe(5));
  it('sin referencias es cero', () => expect(totalDeFilas([])).toBe(0));
});
