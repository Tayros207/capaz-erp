import { describe, expect, it } from 'vitest';
import { claveDePagoFijo, decidirCopias, diaEquivalente, listaDeCopias, mesAnterior, type FuenteDePagoFijo } from './pagos-fijos.js';

describe('diaEquivalente', () => {
  it.each([
    ['2027-01-31', '2027-02', '2027-02-28'],
    ['2028-01-31', '2028-02', '2028-02-29'],
    ['2028-02-29', '2028-03', '2028-03-29'],
    ['2026-10-30', '2026-11', '2026-11-30'],
    ['2026-10-31', '2026-11', '2026-11-30'],
    ['2026-10-05', '2026-11', '2026-11-05'],
  ])('%s en %s es %s', (venceEn, mes, esperado) => {
    expect(diaEquivalente(venceEn, mes)).toBe(esperado);
  });
  it('con el día original guardado, 31 de enero → febrero → marzo conserva el 31', () => {
    const feb = diaEquivalente('2027-01-31', '2027-02', 31);
    expect(feb).toBe('2027-02-28');
    expect(diaEquivalente(feb, '2027-03', 31)).toBe('2027-03-31');
    expect(diaEquivalente(feb, '2027-03')).toBe('2027-03-28'); // sin el día guardado se desplaza
  });
});

describe('mesAnterior', () => {
  it('retrocede un mes y cruza el año', () => {
    expect(mesAnterior('2026-11')).toBe('2026-10');
    expect(mesAnterior('2027-01')).toBe('2026-12');
  });
});

describe('decidirCopias', () => {
  const f = (id: string, concepto: string): FuenteDePagoFijo => ({ id, contactoId: 'c1', concepto, totalCentimos: 50_000, venceEn: '2026-10-31', sucursalId: null, dia: null, contactoNombre: 'Proveedor Uno' });
  const vacio = { claves: new Set<string>(), origenes: new Set<string>() };

  it('copia con la fecha del día 1 y el vencimiento recortado', () => {
    const r = decidirCopias([f('a', 'Alquiler')], '2026-11', vacio);
    expect(r.copias).toEqual([expect.objectContaining({ origenId: 'a:2026-11', fecha: '2026-11-01', venceEnNuevo: '2026-11-30' })]);
    expect(r.yaExistian).toBe(0);
  });
  it('omite la que ya tiene copia o una manual parecida (sin tildes ni mayúsculas)', () => {
    const existentes = { claves: new Set([claveDePagoFijo('c1', 'ALQUILER del local', '2026-11-30')]), origenes: new Set(['b:2026-11']) };
    const r = decidirCopias([f('a', 'Alquiler del local'), f('b', 'Luz'), f('c', 'Agua')], '2026-11', existentes);
    expect(r.copias.map((c) => c.id)).toEqual(['c']);
    expect(r.yaExistian).toBe(2);
  });
  it('dos fuentes iguales dan una sola copia', () => {
    const r = decidirCopias([f('a', 'Internet'), f('b', 'internet')], '2026-11', vacio);
    expect(r.copias).toHaveLength(1);
    expect(r.yaExistian).toBe(1);
  });
  it('dos quincenas del mismo proveedor y concepto se copian las dos', () => {
    const q = (id: string, venceEn: string): FuenteDePagoFijo => ({ ...f(id, 'Sueldo'), venceEn });
    const r = decidirCopias([q('a', '2026-10-15'), q('b', '2026-10-30')], '2026-11', vacio);
    expect(r.copias.map((c) => c.venceEnNuevo)).toEqual(['2026-11-15', '2026-11-30']);
    expect(r.yaExistian).toBe(0);
  });
  it('una manual del mismo concepto pero de otro día no oculta la copia', () => {
    const existentes = { claves: new Set([claveDePagoFijo('c1', 'Sueldo', '2026-11-15')]), origenes: new Set<string>() };
    const r = decidirCopias([{ ...f('a', 'Sueldo'), venceEn: '2026-10-30' }], '2026-11', existentes);
    expect(r.copias).toHaveLength(1);
  });
});

describe('listaDeCopias', () => {
  const copia = (i: number) => ({ id: `${i}`, contactoId: 'c', concepto: `Concepto ${i}`, totalCentimos: 1, venceEn: '2026-10-05', sucursalId: null, dia: null, contactoNombre: `Proveedor ${i}`, origenId: `${i}:2026-11`, fecha: '2026-11-01', venceEnNuevo: '2026-11-05' });
  it('lista hasta 10 y dice cuántas más', () => {
    expect(listaDeCopias([copia(1), copia(2)])).toBe('Proveedor 1 (Concepto 1), Proveedor 2 (Concepto 2)');
    const doce = Array.from({ length: 12 }, (_, i) => copia(i + 1));
    expect(listaDeCopias(doce).endsWith('Proveedor 10 (Concepto 10) y 2 más')).toBe(true);
  });
});
