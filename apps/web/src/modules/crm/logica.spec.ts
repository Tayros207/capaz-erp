import { describe, expect, it } from 'vitest';
import type { Centimos, EtapaDto, OportunidadDto } from '@capaz/shared';
import {
  argumentosDeCreacion,
  argumentosDeEdicion,
  columnasDelTablero,
  destinosDeMovimiento,
  formularioDesde,
  mensajeDeRechazo,
  moverEnOrden,
  pasosDeOportunidad,
  textoDeMonto,
  validarOportunidad,
} from './logica.ts';

const etapa = (id: string, nombre: string, orden: number, tipo: EtapaDto['tipo'] = 'abierta', archivadoEn: string | null = null): EtapaDto => ({ id, nombre, orden, tipo, archivadoEn });
const ETAPAS = [etapa('g', 'Ganada', 3, 'ganada'), etapa('b', 'Contactado', 1), etapa('a', 'Nuevo', 0), etapa('x', 'Vieja', 2, 'abierta', '2026-01-01T00:00:00.000Z'), etapa('p', 'Perdida', 4, 'perdida')];
const opo = (id: string, etapaId: string, monto: number | null, estado: OportunidadDto['estado'] = 'abierta'): OportunidadDto => ({
  id, codigo: 'OPO-2026-0001', titulo: 'Banners', clienteId: 'c', clienteNombre: 'Imprenta Sol', etapaId, etapaNombre: estado === 'ganada' ? 'Ganada' : 'Nuevo', estado,
  montoEstimadoCentimos: monto, fechaEsperada: null, responsableId: null, motivoPerdida: null, cerradaEn: null, ultimaActividadEn: '2026-11-15T10:00:00.000Z',
  notas: null, sucursalId: null, actividadesPendientes: 0, creadoPor: 'u', creadoEn: '2026-11-15T10:00:00.000Z', actualizadoEn: '2026-11-15T10:00:00.000Z',
});

describe('columnasDelTablero', () => {
  it('una columna por etapa abierta viva, en orden, con sus oportunidades y el monto que suman', () => {
    const cols = columnasDelTablero(ETAPAS, [opo('1', 'a', 150000), opo('2', 'a', null), opo('3', 'b', 5050), opo('4', 'g', 9999, 'ganada')]);
    expect(cols.map((c) => [c.titulo, c.filas.map((f) => f.id), c.resumen])).toEqual([
      ['Nuevo', ['1', '2'], 'S/ 1,500.00'],
      ['Contactado', ['3'], 'S/ 50.50'],
    ]);
  });
});

describe('destinos y pasos', () => {
  it('se mueve a las otras abiertas; una cerrada no se mueve', () => {
    expect(destinosDeMovimiento(ETAPAS, opo('1', 'a', null)).map((e) => e.id)).toEqual(['b']);
    expect(destinosDeMovimiento(ETAPAS, opo('1', 'g', null, 'ganada'))).toEqual([]);
  });
  it('la barra muestra las abiertas y el cierre al final', () => {
    expect(pasosDeOportunidad(ETAPAS, opo('1', 'b', null))).toEqual({ pasos: ['Nuevo', 'Contactado', 'Cierre'], actual: 1 });
    expect(pasosDeOportunidad(ETAPAS, opo('1', 'g', null, 'ganada'))).toEqual({ pasos: ['Nuevo', 'Contactado', 'Ganada'], actual: 2 });
  });
});

describe('moverEnOrden', () => {
  it('sube y baja intercambiando con la vecina; en los bordes no hace nada', () => {
    expect(moverEnOrden(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moverEnOrden(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moverEnOrden(['a', 'b', 'c'], 0, -1)).toBeNull();
    expect(moverEnOrden(['a', 'b', 'c'], 2, 1)).toBeNull();
  });
});

describe('formulario de oportunidad', () => {
  const base = { titulo: '  Banners  ', montoEstimadoCentimos: 150000 as Centimos, fechaEsperada: '', notas: ' ' };
  it('valida título y cliente', () => {
    expect(validarOportunidad({ ...base, titulo: ' ' }, null)).toEqual({ titulo: 'Indica el título.', cliente: 'Elige un cliente.' });
    expect(validarOportunidad(base, 'c')).toEqual({});
  });
  it('crear recorta y deja en null lo vacío', () => {
    expect(argumentosDeCreacion(base, 'c')).toEqual({ titulo: 'Banners', clienteId: 'c', montoEstimadoCentimos: 150000, fechaEsperada: null, notas: null });
  });
  it('editar envía solo lo que cambió, o nada', () => {
    const o = opo('1', 'a', 150000);
    expect(argumentosDeEdicion(o, formularioDesde(o))).toBeNull();
    expect(argumentosDeEdicion(o, { ...formularioDesde(o), montoEstimadoCentimos: null, notas: 'Llamar' })).toEqual({ id: '1', montoEstimadoCentimos: null, notas: 'Llamar' });
  });
});

describe('textos', () => {
  it('monto vacío y mensajes de rechazo', () => {
    expect(textoDeMonto(null)).toBe('—');
    expect(mensajeDeRechazo('modulo_solo_lectura', 'x')).toBe('Tu acceso al CRM es de solo lectura.');
    expect(mensajeDeRechazo('conflicto', 'La oportunidad ya está ganada.')).toBe('La oportunidad ya está ganada.');
  });
});
