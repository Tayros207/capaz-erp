import type { Yo } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { ayudaDelSelectorDeCliente, opcionDeCandidata, opcionDeCliente, puedeCrearClientes } from './logica-selector-de-cliente.ts';

describe('opcionDeCliente', () => {
  it('el detalle es el documento, si no el teléfono, si no nada', () => {
    expect(opcionDeCliente({ id: '1', nombre: 'Ana', documentoNumero: '123', telefono: '9' }).detalle).toBe('123');
    expect(opcionDeCliente({ id: '1', nombre: 'Ana', documentoNumero: null, telefono: '9' }).detalle).toBe('9');
    expect('detalle' in opcionDeCliente({ id: '1', nombre: 'Ana', documentoNumero: null, telefono: null })).toBe(false);
  });
  it('candidata con y sin detalle', () => {
    expect(opcionDeCandidata({ id: '1', nombre: 'Ana', detalle: 'x' }).detalle).toBe('x');
    expect('detalle' in opcionDeCandidata({ id: '1', nombre: 'Ana' })).toBe(false);
  });
});

describe('permiso y ayuda', () => {
  it('solo con clientes:editar se puede crear', () => {
    expect(puedeCrearClientes(null)).toBe(false);
    expect(puedeCrearClientes({ permisos: [] } as unknown as Yo)).toBe(false);
    expect(puedeCrearClientes({ permisos: ['clientes:editar'] } as unknown as Yo)).toBe(true);
  });
  it('la ayuda menciona el botón solo si se puede crear', () => {
    expect(ayudaDelSelectorDeCliente(true)).toContain('Nuevo cliente');
    expect(ayudaDelSelectorDeCliente(false)).not.toContain('Nuevo cliente');
  });
});
