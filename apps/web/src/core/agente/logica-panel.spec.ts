import type { ModuloDeYo, Yo } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { ETIQUETA_DE_RESOLUCION, puedeDictar } from './logica-panel.ts';

const acceso = (o: Partial<ModuloDeYo['acceso']> = {}): ModuloDeYo['acceso'] => ({
  codigo: 'registro', motivo: 'activo', visible: true, puedeEntrar: true, puedeEscribir: true, nivel: 'completo', alcance: 'todos', diasDePrueba: null, ...o,
});
const modulo = (codigo: string, a: ModuloDeYo['acceso']): ModuloDeYo => ({
  codigo, nombre: codigo, descripcion: '', familia: 'finanzas', orden: 1, acento: '#000', icono: 'caja', enConstruccion: false, secciones: [], acceso: a,
}) as ModuloDeYo;
const yo = (permisos: string[], modulos: ModuloDeYo[]): Pick<Yo, 'permisos' | 'modulos'> => ({ permisos, modulos });

describe('puedeDictar', () => {
  it('con permiso de bandeja y Registro con escritura, sí', () => {
    expect(puedeDictar(yo(['borradores:ver'], [modulo('registro', acceso())]))).toBe(true);
  });
  it('sin el permiso de la bandeja, no', () => {
    expect(puedeDictar(yo([], [modulo('registro', acceso())]))).toBe(false);
  });
  it('con Registro en solo lectura, no', () => {
    expect(puedeDictar(yo(['borradores:ver'], [modulo('registro', acceso({ puedeEscribir: false, nivel: 'lectura' }))]))).toBe(false);
  });
  it('sin entrada al módulo Registro, no', () => {
    expect(puedeDictar(yo(['borradores:ver'], [modulo('registro', acceso({ puedeEntrar: false, puedeEscribir: false }))]))).toBe(false);
  });
  it('sin el módulo Registro en la lista, no', () => {
    expect(puedeDictar(yo(['borradores:ver'], [modulo('crm', acceso({ codigo: 'crm' }))]))).toBe(false);
  });
});

describe('ETIQUETA_DE_RESOLUCION', () => {
  it('tiene un texto para cada resolución', () => {
    expect(ETIQUETA_DE_RESOLUCION).toEqual({ aprobado: 'Aprobado', descartado: 'Descartado', despues: 'Queda en la bandeja' });
  });
});
