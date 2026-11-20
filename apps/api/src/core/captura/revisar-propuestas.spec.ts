import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AccesoDeModulo } from '@capaz/shared';
import { conectarCatalogo } from '../borradores/catalogo.js';
import { revisarPropuestas } from './revisar-propuestas.js';
import type { PropuestaInterpretada } from './tipos.js';

const CATALOGO: Record<string, { modulo: string; permiso: string }> = {
  movimiento_registrar: { modulo: 'registro', permiso: 'registro:editar' },
  pedido_crear: { modulo: 'ordenes', permiso: 'ordenes:editar' },
};
const acceso = (codigo: string, puedeEscribir: boolean): AccesoDeModulo => ({
  codigo, motivo: 'activo', visible: true, puedeEntrar: true, puedeEscribir, nivel: puedeEscribir ? 'completo' : 'lectura', alcance: 'todos', diasDePrueba: null,
});
const propuesta = (herramienta: string): PropuestaInterpretada => ({ herramienta, args: {}, resumen: 'x' }) as PropuestaInterpretada;
const REGISTRO = { modulo: 'registro', tambienPropone: ['ordenes'] } as const;
const ctx = (modulos: AccesoDeModulo[], permisos: string[]) => ({ modulos, permisos });
const COMPLETO = ctx([acceso('registro', true), acceso('ordenes', true)], ['registro:editar', 'ordenes:editar']);

beforeAll(() => conectarCatalogo((n) => CATALOGO[n]));
afterAll(() => conectarCatalogo(null));

describe('revisarPropuestas', () => {
  test('una herramienta de otro módulo sin declararlo lanza', () => {
    expect(() => revisarPropuestas([propuesta('pedido_crear')], { modulo: 'registro' }, COMPLETO)).toThrow(/no es de ese módulo/);
  });
  test('declarado y con acceso y permiso: pasa', () => {
    expect(revisarPropuestas([propuesta('pedido_crear')], REGISTRO, COMPLETO)).toBeNull();
  });
  test('sin acceso al módulo', () => {
    const r = revisarPropuestas([propuesta('pedido_crear')], REGISTRO, ctx([acceso('registro', true)], ['registro:editar', 'ordenes:editar']));
    expect(r).toMatchObject({ ok: false, error: { codigo: 'modulo_no_disponible' } });
  });
  test('módulo en lectura', () => {
    const r = revisarPropuestas([propuesta('pedido_crear')], REGISTRO, ctx([acceso('registro', true), acceso('ordenes', false)], ['ordenes:editar']));
    expect(r).toMatchObject({ ok: false, error: { codigo: 'modulo_solo_lectura' } });
  });
  test('sin el permiso de la herramienta', () => {
    const r = revisarPropuestas([propuesta('pedido_crear')], REGISTRO, ctx(COMPLETO.modulos, ['registro:editar']));
    expect(r).toMatchObject({ ok: false, error: { codigo: 'sin_permiso' } });
  });
  test('más de 5 propuestas lanza', () => {
    expect(() => revisarPropuestas(Array.from({ length: 6 }, () => propuesta('movimiento_registrar')), REGISTRO, COMPLETO)).toThrow();
  });
  test('una herramienta del propio módulo no necesita declarar nada', () => {
    expect(revisarPropuestas([propuesta('movimiento_registrar')], { modulo: 'registro' }, COMPLETO)).toBeNull();
  });
});
