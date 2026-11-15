import { describe, expect, it } from 'vitest';
import { accesoAModulo, permisosEfectivos, type Contratacion } from './acceso.js';

const AHORA = new Date('2026-11-14T12:00:00Z');
const M = { codigo: 'registro' };
const en = (dias: number) => new Date(AHORA.getTime() + dias * 86_400_000);
const contrato = (estado: Contratacion['estado'], pruebaHasta: Date | null = null): Contratacion => ({ modulo: 'registro', estado, pruebaHasta });
const acceso = (rol: string, contratacion?: Contratacion, asignacion?: { nivel: 'completo' | 'lectura'; alcance: 'todos' | 'propios' }) =>
  accesoAModulo({ manifiesto: M, rol, contratacion, asignacion: asignacion && { modulo: 'registro', ...asignacion }, ahora: AHORA });

describe('accesoAModulo', () => {
  it('owner y admin entran a todo lo contratado con nivel completo, sin asignación', () => {
    for (const rol of ['owner', 'admin']) {
      expect(acceso(rol, contrato('activo'))).toMatchObject({ motivo: 'activo', puedeEntrar: true, puedeEscribir: true, nivel: 'completo' });
    }
  });

  it('un member sin asignación ve la tarjeta pero no entra', () => {
    expect(acceso('member', contrato('activo'))).toMatchObject({ motivo: 'sin_asignar', visible: true, puedeEntrar: false, puedeEscribir: false });
  });

  it('un member con asignación completa entra y escribe; con lectura entra y no escribe', () => {
    expect(acceso('member', contrato('activo'), { nivel: 'completo', alcance: 'propios' })).toMatchObject({ puedeEntrar: true, puedeEscribir: true, alcance: 'propios' });
    expect(acceso('member', contrato('activo'), { nivel: 'lectura', alcance: 'todos' })).toMatchObject({ puedeEntrar: true, puedeEscribir: false, nivel: 'lectura' });
  });

  it('no contratado: no entra, ni siquiera un administrador', () => {
    expect(acceso('owner', undefined)).toMatchObject({ motivo: 'no_contratado', puedeEntrar: false, visible: true });
  });

  it('en prueba vigente cuenta los días restantes y escribe', () => {
    expect(acceso('owner', contrato('prueba', en(21)))).toMatchObject({ motivo: 'prueba', diasDePrueba: 21, puedeEscribir: true });
    expect(acceso('owner', contrato('prueba', en(0.2)))).toMatchObject({ diasDePrueba: 1 });
  });

  it('una prueba vencida equivale a baja: solo lectura', () => {
    expect(acceso('owner', contrato('prueba', en(-1)))).toMatchObject({ motivo: 'baja_solo_lectura', puedeEntrar: true, puedeEscribir: false });
  });

  it('baja y suspensión: entran en solo lectura', () => {
    expect(acceso('owner', contrato('baja'))).toMatchObject({ motivo: 'baja_solo_lectura', puedeEntrar: true, puedeEscribir: false });
    expect(acceso('owner', contrato('suspendido'))).toMatchObject({ motivo: 'suspendido', puedeEntrar: true, puedeEscribir: false });
  });

  it('el núcleo siempre está activo: escribe solo el administrador', () => {
    const core = (rol: string) => accesoAModulo({ manifiesto: { codigo: 'core' }, rol, contratacion: undefined, asignacion: undefined });
    expect(core('owner')).toMatchObject({ puedeEntrar: true, puedeEscribir: true });
    expect(core('member')).toMatchObject({ puedeEntrar: true, puedeEscribir: false, nivel: 'lectura' });
  });
});

describe('permisosEfectivos', () => {
  const manifiestos = [
    { codigo: 'core', permisosPorNivel: { completo: ['clientes:ver', 'clientes:editar'], lectura: ['clientes:ver'] } },
    { codigo: 'registro', permisosPorNivel: { completo: ['registro:ver', 'registro:editar'], lectura: ['registro:ver'] } },
  ] as never;

  it('suma los permisos de cada módulo según el nivel', () => {
    const accesos = [
      accesoAModulo({ manifiesto: { codigo: 'core' }, rol: 'member', contratacion: undefined, asignacion: undefined }),
      acceso('member', contrato('activo'), { nivel: 'lectura', alcance: 'todos' }),
    ];
    expect(permisosEfectivos(manifiestos, accesos)).toEqual(['clientes:ver', 'registro:ver']);
  });

  it('en baja solo quedan los de lectura; con escritura en un módulo se puede editar clientes', () => {
    expect(permisosEfectivos(manifiestos, [acceso('owner', contrato('baja'))])).toEqual(['registro:ver']);
    expect(permisosEfectivos(manifiestos, [acceso('owner', contrato('activo'))])).toEqual(['clientes:editar', 'registro:editar', 'registro:ver']);
  });
});
