import { describe, expect, it } from 'vitest';
import type { SucursalDto } from '@capaz/shared';
import {
  argumentosDeCreacion,
  argumentosDeEdicion,
  filtrarSucursales,
  formularioDesde,
  FORMULARIO_VACIO,
  puedeArchivar,
  puedeMarcarPrincipal,
  validarSucursal,
} from './logica.ts';

const base = { direccion: null, telefono: null, creadoEn: '2026-11-10T10:00:00.000Z', actualizadoEn: '2026-11-10T10:00:00.000Z' };
const PRI: SucursalDto = { ...base, id: 'a', codigo: 'PRI', nombre: 'Principal', esPrincipal: true, archivadoEn: null };
const NORTE: SucursalDto = { ...base, id: 'b', codigo: 'NOR', nombre: 'Norte', esPrincipal: false, archivadoEn: null };
const VIEJA: SucursalDto = { ...base, id: 'c', codigo: 'AAA', nombre: 'Vieja', esPrincipal: false, archivadoEn: '2026-11-11T10:00:00.000Z' };

describe('formulario de sucursal', () => {
  it('al crear exige código y nombre', () => {
    expect(validarSucursal(FORMULARIO_VACIO, true)).toEqual({ codigo: 'El código es obligatorio.', nombre: 'El nombre es obligatorio.' });
    expect(validarSucursal({ ...FORMULARIO_VACIO, nombre: 'X' }, false)).toEqual({});
    expect(validarSucursal({ ...FORMULARIO_VACIO, codigo: 'ABCDEFGHIJK', nombre: 'X' }, true).codigo).toMatch(/10/);
  });
  it('el código se envía en mayúsculas y lo vacío se omite', () => {
    expect(argumentosDeCreacion({ ...FORMULARIO_VACIO, codigo: ' sur ', nombre: ' Sur ' })).toEqual({ codigo: 'SUR', nombre: 'Sur' });
  });
  it('al editar manda solo lo que cambió', () => {
    expect(argumentosDeEdicion(NORTE, formularioDesde(NORTE))).toBeNull();
    expect(argumentosDeEdicion(NORTE, { ...formularioDesde(NORTE), telefono: '999' })).toEqual({ id: 'b', telefono: '999' });
  });
});

describe('lista de sucursales', () => {
  it('la principal va primero y las archivadas se ocultan o van al final', () => {
    expect(filtrarSucursales([VIEJA, NORTE, PRI], false).map((s) => s.codigo)).toEqual(['PRI', 'NOR']);
    expect(filtrarSucursales([VIEJA, NORTE, PRI], true).map((s) => s.codigo)).toEqual(['PRI', 'NOR', 'AAA']);
  });
  it('reglas de acciones', () => {
    expect(puedeMarcarPrincipal(NORTE)).toBe(true);
    expect(puedeMarcarPrincipal(PRI)).toBe(false);
    expect(puedeMarcarPrincipal(VIEJA)).toBe(false);
    expect(puedeArchivar(PRI)).toBe(false);
    expect(puedeArchivar(NORTE)).toBe(true);
  });
});
