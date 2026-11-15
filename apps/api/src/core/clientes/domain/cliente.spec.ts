import { describe, expect, it } from 'vitest';
import { prepararCliente } from './cliente.js';
import { validarDocumento } from './documento.js';
import { normalizarNombre, normalizarTelefono } from './normalizacion.js';

describe('normalizarNombre', () => {
  it('quita tildes y mayúsculas y junta espacios', () => {
    expect(normalizarNombre('  José   PÉREZ  Ñandú ')).toBe('jose perez nandu');
  });
  it('es idempotente', () => {
    expect(normalizarNombre(normalizarNombre('Á  b'))).toBe('a b');
  });
});

describe('normalizarTelefono', () => {
  it('deja dígitos y conserva el + inicial', () => {
    expect(normalizarTelefono('(01) 555-1234')).toBe('015551234');
    expect(normalizarTelefono('+51 999 888 777')).toBe('+51999888777');
  });
  it('vacío es null; inválido es undefined', () => {
    expect(normalizarTelefono('  ')).toBeNull();
    expect(normalizarTelefono(null)).toBeNull();
    expect(normalizarTelefono('123')).toBeUndefined();
    expect(normalizarTelefono('abc 123456')).toBeUndefined();
  });
});

describe('validarDocumento', () => {
  it('DNI 8 dígitos y RUC 11', () => {
    expect(validarDocumento('dni', '12345678')).toEqual({ ok: true, numero: '12345678' });
    expect(validarDocumento('dni', '1234567').ok).toBe(false);
    expect(validarDocumento('ruc', '20123456789')).toEqual({ ok: true, numero: '20123456789' });
    expect(validarDocumento('ruc', '2012345678').ok).toBe(false);
    expect(validarDocumento('ruc', '2012345678A').ok).toBe(false);
  });
  it('CE y pasaporte en mayúsculas', () => {
    expect(validarDocumento('ce', ' ab1234567 ')).toEqual({ ok: true, numero: 'AB1234567' });
    expect(validarDocumento('pasaporte', 'x1')).toMatchObject({ ok: false });
  });
});

describe('prepararCliente', () => {
  const base = { clase: 'persona' as const, nombre: '  José   Pérez ' };
  it('normaliza todo', () => {
    const r = prepararCliente({ ...base, documentoTipo: 'dni', documentoNumero: '12345678', telefono: '999 888 777', correo: ' JOSE@Mail.com ' });
    expect(r).toMatchObject({ ok: true, datos: { nombre: 'José Pérez', nombreNormalizado: 'jose perez', tipo: 'cliente', telefono: '999888777', correo: 'jose@mail.com' } });
  });
  it('rechaza nombre vacío, documento sin tipo, tipo sin número, DNI corto, correo y teléfono malos', () => {
    expect(prepararCliente({ ...base, nombre: '  ' })).toMatchObject({ ok: false, campo: 'nombre' });
    expect(prepararCliente({ ...base, documentoNumero: '12345678' })).toMatchObject({ ok: false, campo: 'documentoTipo' });
    expect(prepararCliente({ ...base, documentoTipo: 'dni' })).toMatchObject({ ok: false, campo: 'documentoNumero' });
    expect(prepararCliente({ ...base, documentoTipo: 'dni', documentoNumero: '123' })).toMatchObject({ ok: false, campo: 'documentoNumero' });
    expect(prepararCliente({ ...base, correo: 'no-es-correo' })).toMatchObject({ ok: false, campo: 'correo' });
    expect(prepararCliente({ ...base, telefono: '12' })).toMatchObject({ ok: false, campo: 'telefono' });
  });
  it('sin documento queda en null', () => {
    expect(prepararCliente(base)).toMatchObject({ ok: true, datos: { documentoTipo: null, documentoNumero: null } });
  });
});
