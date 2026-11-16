import { describe, expect, it } from 'vitest';
import type { ModuloDeYo, Yo } from '@capaz/shared';
import { accesoA, puedeEscribirEn, seccionesDe } from './acceso.ts';

function modulo(codigo: string, acceso: Partial<ModuloDeYo['acceso']>): ModuloDeYo {
  return {
    codigo,
    nombre: codigo,
    descripcion: '',
    familia: 'finanzas',
    orden: 1,
    acento: '',
    icono: '',
    enConstruccion: false,
    secciones: [
      { id: 'a', nombre: 'Resumen', ruta: '/x', construida: true },
      { id: 'b', nombre: 'Pronto', ruta: '/y', construida: false },
    ],
    acceso: { codigo, motivo: 'activo', visible: true, puedeEntrar: true, puedeEscribir: true, nivel: 'completo', alcance: 'todos', diasDePrueba: null, ...acceso },
  } as ModuloDeYo;
}

const yo = {
  modulos: [modulo('registro', {}), modulo('crm', { puedeEscribir: false, nivel: 'lectura' }), modulo('ordenes', { puedeEntrar: false, puedeEscribir: false, nivel: null })],
} as unknown as Yo;

describe('acceso', () => {
  it('devuelve el acceso solo si puede entrar', () => {
    expect(accesoA(yo, 'registro')?.alcance).toBe('todos');
    expect(accesoA(yo, 'ordenes')).toBeNull();
    expect(accesoA(yo, 'inexistente')).toBeNull();
    expect(accesoA(null, 'registro')).toBeNull();
  });
  it('escribir exige acceso completo', () => {
    expect(puedeEscribirEn(yo, 'registro')).toBe(true);
    expect(puedeEscribirEn(yo, 'crm')).toBe(false);
    expect(puedeEscribirEn(yo, 'ordenes')).toBe(false);
  });
  it('lista solo las secciones construidas', () => {
    expect(seccionesDe(yo, 'registro').map((s) => s.id)).toEqual(['a']);
    expect(seccionesDe(yo, 'ordenes')).toEqual([]);
    expect(seccionesDe(undefined, 'registro')).toEqual([]);
  });
});
