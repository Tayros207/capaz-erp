import { describe, expect, it } from 'vitest';
import { codificarCursor, decodificarCursor } from './cursor.js';
import { ETAPAS_POR_DEFECTO, numerar, primeraAbierta, problemaDeOrden, problemaParaArchivar, type EtapaViva } from './etapas.js';
import {
  actividadVencida,
  codigoDeOportunidad,
  problemaDeEtapaDestino,
  problemaParaCerrar,
  problemaParaMover,
  problemaParaReabrir,
} from './oportunidad.js';

const id = (n: number) => `00000000-0000-7000-8000-00000000000${n}`;
const etapa = (n: number, tipo: EtapaViva['tipo'], orden: number, archivada = false): EtapaViva => ({ id: id(n), tipo, orden, archivada });
// Abiertas 1, 2, 3 (la 9 archivada); cierre: ganada 4, perdida 5.
const ETAPAS = [etapa(5, 'perdida', 5), etapa(2, 'abierta', 1), etapa(4, 'ganada', 4), etapa(3, 'abierta', 2), etapa(1, 'abierta', 0), etapa(9, 'abierta', 0, true)];

describe('codigoDeOportunidad', () => {
  it('arma OPO-AAAA-0001 con al menos cuatro cifras', () => {
    expect(codigoDeOportunidad(2026, 1)).toBe('OPO-2026-0001');
    expect(codigoDeOportunidad(2026, 123)).toBe('OPO-2026-0123');
    expect(codigoDeOportunidad(2027, 12345)).toBe('OPO-2027-12345');
  });
});

describe('etapas por defecto', () => {
  it('cuatro abiertas y exactamente una ganada y una perdida, al final', () => {
    expect(ETAPAS_POR_DEFECTO.map((e) => e.tipo)).toEqual(['abierta', 'abierta', 'abierta', 'abierta', 'ganada', 'perdida']);
    expect(ETAPAS_POR_DEFECTO.map((e) => e.orden)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('primeraAbierta', () => {
  it('es la abierta viva de menor orden (ignora archivadas y de cierre)', () => {
    expect(primeraAbierta(ETAPAS)?.id).toBe(id(1));
    expect(primeraAbierta([etapa(4, 'ganada', 0), etapa(5, 'perdida', 1)])).toBeNull();
  });
});

describe('numerar', () => {
  it('las abiertas en el orden dado y después ganada y perdida; las archivadas no se tocan', () => {
    expect(numerar([id(3), id(1), id(2)], ETAPAS)).toEqual([
      { id: id(3), orden: 0 },
      { id: id(1), orden: 1 },
      { id: id(2), orden: 2 },
      { id: id(4), orden: 3 },
      { id: id(5), orden: 4 },
    ]);
  });
});

describe('problemaDeOrden', () => {
  it('acepta exactamente las abiertas vivas', () => {
    expect(problemaDeOrden([id(2), id(3), id(1)], ETAPAS)).toBeNull();
  });
  it('rechaza si falta, sobra (cierre o archivada) o se repite una', () => {
    expect(problemaDeOrden([id(1), id(2)], ETAPAS)).toMatch(/todas las etapas abiertas/);
    expect(problemaDeOrden([id(1), id(2), id(3), id(4)], ETAPAS)).toMatch(/todas las etapas abiertas/);
    expect(problemaDeOrden([id(1), id(2), id(3), id(9)], ETAPAS)).toMatch(/todas las etapas abiertas/);
    expect(problemaDeOrden([id(1), id(2), id(2), id(3)], ETAPAS)).toMatch(/dos veces/);
  });
});

describe('problemaParaArchivar', () => {
  it('las de cierre no se archivan', () => {
    expect(problemaParaArchivar(ETAPAS[2]!, ETAPAS, 0)).toMatch(/cierre/);
  });
  it('con oportunidades abiertas en ella, no', () => {
    expect(problemaParaArchivar(ETAPAS[1]!, ETAPAS, 1)).toMatch(/Queda 1 oportunidad/);
    expect(problemaParaArchivar(ETAPAS[1]!, ETAPAS, 3)).toMatch(/Quedan 3 oportunidades/);
  });
  it('la última abierta, no; las demás, sí', () => {
    expect(problemaParaArchivar(etapa(1, 'abierta', 0), [etapa(1, 'abierta', 0), etapa(4, 'ganada', 1), etapa(9, 'abierta', 0, true)], 0)).toMatch(/única etapa abierta/);
    expect(problemaParaArchivar(ETAPAS[1]!, ETAPAS, 0)).toBeNull();
  });
});

describe('transiciones de una oportunidad', () => {
  const abierta = { tipo: 'abierta' as const, archivada: false };
  it('se mueve solo abierta y hacia una etapa abierta viva', () => {
    expect(problemaParaMover('abierta', abierta)).toBeNull();
    expect(problemaParaMover('ganada', abierta)).toMatchObject({ codigo: 'conflicto' });
    expect(problemaParaMover('abierta', { tipo: 'ganada', archivada: false })).toMatchObject({ codigo: 'argumentos_invalidos' });
    expect(problemaParaMover('abierta', { tipo: 'abierta', archivada: true })).toMatchObject({ codigo: 'conflicto', mensaje: 'Esa etapa está archivada.' });
  });
  it('una oportunidad nueva no entra en una etapa de cierre', () => {
    expect(problemaDeEtapaDestino({ tipo: 'perdida', archivada: false })).toMatchObject({ codigo: 'argumentos_invalidos' });
  });
  it('se gana o se pierde solo abierta; se reabre solo cerrada', () => {
    expect(problemaParaCerrar('abierta')).toBeNull();
    expect(problemaParaCerrar('ganada')?.mensaje).toBe('La oportunidad ya está ganada.');
    expect(problemaParaCerrar('perdida')?.mensaje).toBe('La oportunidad ya está perdida.');
    expect(problemaParaReabrir('abierta')).toMatchObject({ codigo: 'conflicto' });
    expect(problemaParaReabrir('perdida')).toBeNull();
  });
});

describe('actividadVencida', () => {
  it('sin hacer y con vencimiento anterior a hoy', () => {
    expect(actividadVencida('2026-11-14', false, '2026-11-15')).toBe(true);
    expect(actividadVencida('2026-11-15', false, '2026-11-15')).toBe(false);
    expect(actividadVencida('2026-11-14', true, '2026-11-15')).toBe(false);
    expect(actividadVencida(null, false, '2026-11-15')).toBe(false);
  });
});

describe('cursor por instante', () => {
  it('ida y vuelta; basura es null', () => {
    const p = { instante: '2026-11-15 10:20:30.123456-05', id: id(1) };
    expect(decodificarCursor(codificarCursor(p))).toEqual(p);
    expect(decodificarCursor('no-es-cursor')).toBeNull();
    expect(decodificarCursor(Buffer.from('ayer|' + id(1)).toString('base64url'))).toBeNull();
  });
});
