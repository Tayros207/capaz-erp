import { describe, expect, it } from 'vitest';
import type { Yo } from '@capaz/shared';
import { puede } from './sesion.ts';

const yo: Yo = {
  usuario: { id: 'u1', nombre: 'Ana', correo: 'ana@ejemplo.pe' },
  empresa: null,
  empresas: [],
  puedeCrearEmpresas: false,
  modulos: [],
  permisos: ['clientes:ver', 'clientes:editar'],
};

describe('puede', () => {
  it('compara el permiso exacto', () => {
    expect(puede(yo, 'clientes:ver')).toBe(true);
    expect(puede(yo, 'clientes:borrar')).toBe(false);
    expect(puede(yo, 'clientes')).toBe(false);
  });
});
