import { describe, expect, it } from 'vitest';
import type { Centimos, ModuloDeEmpresaDto } from '@capaz/shared';
import { accionesPosibles, argumentosDeContrato, diaAIso, formularioDeContrato, isoADia, listaDeCodigos, mensajeDeRechazo, parsearDiasDePrueba, resumenDeModulos, validarEmpresa, validarPlan, PLAN_VACIO } from './logica.ts';

const MODULO: ModuloDeEmpresaDto = {
  modulo: 'ventas', nombre: 'Ventas', estado: 'activo', altaEn: '2026-11-01T10:00:00.000Z', pruebaHasta: null, bajaEn: null, motivo: null,
  plan: 'basico', precioAcordadoCentimos: 5000 as Centimos, vigenteHasta: '2026-12-31T23:59:59-05:00', maxUsuarios: 5,
};

describe('consola de plataforma: lógica', () => {
  it('las acciones dependen del estado', () => {
    expect(accionesPosibles('activo')).toEqual(['suspender', 'dar_de_baja']);
    expect(accionesPosibles('suspendido')).toEqual(['reactivar', 'dar_de_baja']);
    expect(accionesPosibles('baja')).toEqual(['reactivar']);
  });

  it('resume los módulos de una empresa', () => {
    expect(resumenDeModulos([])).toBe('Sin módulos');
    expect(resumenDeModulos([{ modulo: 'ventas', estado: 'prueba' }])).toBe('ventas (en prueba)');
  });

  it('convierte día a ISO de Lima y de vuelta', () => {
    expect(diaAIso('2026-12-31')).toBe('2026-12-31T23:59:59-05:00');
    expect(diaAIso('31/12/2026')).toBeNull();
    expect(isoADia('2026-12-31T23:59:59-05:00')).toBe('2026-12-31');
    expect(isoADia(null)).toBe('');
  });

  it('el contrato manda solo lo que cambió y null para borrar', () => {
    const base = formularioDeContrato(MODULO);
    expect(argumentosDeContrato(base, base)).toBeNull();
    expect(argumentosDeContrato({ ...base, precio: 6000 as Centimos }, base)).toEqual({ precioAcordadoCentimos: 6000 });
    expect(argumentosDeContrato({ ...base, plan: '', vigenteHasta: '', maxUsuarios: '' }, base)).toEqual({ plan: null, vigenteHasta: null, maxUsuarios: null });
    expect(argumentosDeContrato({ ...base, vigenteHasta: '2027-01-15' }, base)).toEqual({ vigenteHasta: '2027-01-15T23:59:59-05:00' });
    expect(argumentosDeContrato({ ...base, maxUsuarios: '0' }, base)).toEqual({ error: 'El máximo de usuarios es un entero desde 1.' });
  });

  it('valida días de prueba', () => {
    expect(parsearDiasDePrueba('')).toEqual({});
    expect(parsearDiasDePrueba('30')).toEqual({ dias: 30 });
    expect(parsearDiasDePrueba('0')).toHaveProperty('error');
    expect(parsearDiasDePrueba('400')).toHaveProperty('error');
  });

  it('valida empresa y plan', () => {
    expect(validarEmpresa('A', 'x')).toEqual({ nombre: 'El nombre de la empresa es muy corto.', correo: 'El correo no es válido.' });
    expect(validarEmpresa('Taller Sur', 'dueno@taller.pe')).toEqual({});
    expect(Object.keys(validarPlan(PLAN_VACIO, true)).sort()).toEqual(['codigo', 'nombre', 'precio']);
    expect(validarPlan({ ...PLAN_VACIO, nombre: 'Básico', precio: 0 as Centimos }, false)).toEqual({});
  });

  it('separa códigos de módulos sin repetir', () => {
    expect(listaDeCodigos('ventas, compras  ventas;caja')).toEqual(['ventas', 'compras', 'caja']);
  });

  it('sin_permiso se muestra como falta de acceso a la consola', () => {
    expect(mensajeDeRechazo('sin_permiso', 'x')).toBe('No tienes acceso a la consola.');
    expect(mensajeDeRechazo('otro', 'Falló.')).toBe('Falló.');
  });
});
