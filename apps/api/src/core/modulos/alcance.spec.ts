import { describe, expect, it } from 'vitest';
import { acceso, contextoDePrueba } from '../herramientas/pruebas-del-ejecutor.js';
import { alcanceDe } from './alcance.js';

describe('alcanceDe', () => {
  it('propios solo si el acceso de ese módulo lo dice', () => {
    const ctx = contextoDePrueba('emp_1', { modulos: [acceso('core'), acceso('crm', { alcance: 'propios' }), acceso('registro')] });
    expect(alcanceDe(ctx, 'crm')).toBe('propios');
    expect(alcanceDe(ctx, 'registro')).toBe('todos');
  });
  it('módulo ausente: todos', () => {
    expect(alcanceDe(contextoDePrueba('emp_1'), 'ordenes')).toBe('todos');
  });
});
