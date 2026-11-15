import { describe, expect, it } from 'vitest';
import type { ClienteDto } from '@capaz/shared';
import {
  argumentosDeCreacion,
  argumentosDeEdicion,
  claseSugerida,
  formularioDesde,
  FORMULARIO_VACIO,
  mensajeDeRechazo,
  textoDeDocumento,
  validarCliente,
} from './logica.ts';

const CLIENTE: ClienteDto = {
  id: '5b2f1a5e-0c1d-4a8e-9a53-3f6a8c2d9e10',
  tipo: 'cliente',
  clase: 'persona',
  nombre: 'José Pérez',
  documentoTipo: 'dni',
  documentoNumero: '12345678',
  telefono: '999111222',
  correo: null,
  direccion: null,
  notas: null,
  archivadoEn: null,
  creadoEn: '2026-11-10T10:00:00.000Z',
  actualizadoEn: '2026-11-10T10:00:00.000Z',
};

describe('validarCliente', () => {
  it('exige el nombre', () => {
    expect(validarCliente(FORMULARIO_VACIO).nombre).toBe('El nombre es obligatorio.');
    expect(validarCliente({ ...FORMULARIO_VACIO, nombre: 'Ana' })).toEqual({});
  });
  it('valida DNI de 8 y RUC de 11 dígitos', () => {
    const base = { ...FORMULARIO_VACIO, nombre: 'Ana' };
    expect(validarCliente({ ...base, documentoTipo: 'dni', documentoNumero: '1234' }).documentoNumero).toMatch(/8 dígitos/);
    expect(validarCliente({ ...base, documentoTipo: 'dni', documentoNumero: '12345678' })).toEqual({});
    expect(validarCliente({ ...base, documentoTipo: 'ruc', documentoNumero: '2012345678' }).documentoNumero).toMatch(/11 dígitos/);
    expect(validarCliente({ ...base, documentoTipo: 'ruc', documentoNumero: '20123456789' })).toEqual({});
  });
  it('pide el tipo si hay número y el número si hay tipo', () => {
    const base = { ...FORMULARIO_VACIO, nombre: 'Ana' };
    expect(validarCliente({ ...base, documentoNumero: '123' }).documentoTipo).toBeDefined();
    expect(validarCliente({ ...base, documentoTipo: 'otro' }).documentoNumero).toBeDefined();
  });
  it('valida el correo solo si hay uno', () => {
    const base = { ...FORMULARIO_VACIO, nombre: 'Ana' };
    expect(validarCliente({ ...base, correo: 'x' }).correo).toBeDefined();
    expect(validarCliente({ ...base, correo: 'a@b.pe' })).toEqual({});
  });
});

describe('argumentos', () => {
  it('al crear omite lo vacío y recorta', () => {
    expect(argumentosDeCreacion({ ...FORMULARIO_VACIO, nombre: '  Ana  ', telefono: ' 999 ' })).toEqual({ tipo: 'cliente', clase: 'persona', nombre: 'Ana', telefono: '999' });
  });
  it('al crear con documento lo envía completo', () => {
    const a = argumentosDeCreacion({ ...FORMULARIO_VACIO, nombre: 'Taller', documentoTipo: 'ruc', documentoNumero: '20123456789', clase: 'empresa' });
    expect(a).toMatchObject({ documentoTipo: 'ruc', documentoNumero: '20123456789', clase: 'empresa' });
  });
  it('al editar manda solo lo que cambió y null para borrar', () => {
    expect(argumentosDeEdicion(CLIENTE, formularioDesde(CLIENTE))).toBeNull();
    const f = { ...formularioDesde(CLIENTE), nombre: 'José Pérez R.', telefono: '' };
    expect(argumentosDeEdicion(CLIENTE, f)).toEqual({ id: CLIENTE.id, nombre: 'José Pérez R.', telefono: null });
  });
  it('al quitar el documento borra tipo y número', () => {
    const f = { ...formularioDesde(CLIENTE), documentoTipo: '' as const, documentoNumero: '' };
    expect(argumentosDeEdicion(CLIENTE, f)).toEqual({ id: CLIENTE.id, documentoTipo: null, documentoNumero: null });
  });
});

describe('ayudas de texto', () => {
  it('un RUC sugiere empresa y lo demás respeta la clase actual', () => {
    expect(claseSugerida('ruc', 'persona')).toBe('empresa');
    expect(claseSugerida('dni', 'empresa')).toBe('empresa');
    expect(claseSugerida('', 'persona')).toBe('persona');
  });
  it('documento legible', () => {
    expect(textoDeDocumento(CLIENTE)).toBe('DNI 12345678');
    expect(textoDeDocumento({ documentoTipo: null, documentoNumero: null })).toBe('—');
  });
  it('mensajes de rechazo', () => {
    expect(mensajeDeRechazo('sin_permiso', 'x')).toMatch(/permiso/);
    expect(mensajeDeRechazo('argumentos_invalidos', 'Dato malo')).toBe('Dato malo');
  });
});
