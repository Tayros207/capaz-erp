import { describe, expect, it } from 'vitest';
import { datosDeSaldo, filtrarPorCobro, type CobroAbierto } from './cobro-en-lista.ts';

const debe = (abonado: number, saldo: number, vencida = false): CobroAbierto => ({ totalCentimos: abonado + saldo, abonadoCentimos: abonado, saldoCentimos: saldo, vencida });
const cobros = new Map<string, CobroAbierto>([['a', debe(0, 10_000)], ['b', debe(4_000, 6_000)], ['c', debe(0, 5_000, true)]]);
const filas = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

describe('filtrarPorCobro', () => {
  it('«todos» no toca la lista', () => expect(filtrarPorCobro(filas, cobros, 'todos')).toHaveLength(4));
  it('«con saldo» deja los que deben algo', () => expect(filtrarPorCobro(filas, cobros, 'con_saldo').map((f) => f.id)).toEqual(['a', 'b', 'c']));
  it('«sin adelanto» deja los que no abonaron nada', () => expect(filtrarPorCobro(filas, cobros, 'sin_adelanto').map((f) => f.id)).toEqual(['a', 'c']));
  it('sin datos de cobro no filtra (no inventa)', () => expect(filtrarPorCobro(filas, null, 'sin_adelanto')).toHaveLength(4));
});

describe('datosDeSaldo', () => {
  it('sin adelanto lo avisa', () => expect(datosDeSaldo({ estado: 'confirmado' }, debe(0, 10_000))).toEqual({ saldoCentimos: 10_000, nota: 'Sin adelanto', tono: 'aviso' }));
  it('con adelanto solo muestra lo que falta', () => expect(datosDeSaldo({ estado: 'confirmado' }, debe(4_000, 6_000))).toEqual({ saldoCentimos: 6_000, nota: null, tono: 'neutro' }));
  it('vencida manda sobre sin adelanto', () => expect(datosDeSaldo({ estado: 'listo' }, debe(0, 5_000, true))?.nota).toBe('Vencida'));
  it('sin deuda abierta, borrador o cancelado: nada', () => {
    expect(datosDeSaldo({ estado: 'confirmado' }, undefined)).toBeNull();
    expect(datosDeSaldo({ estado: 'borrador' }, debe(0, 100))).toBeNull();
    expect(datosDeSaldo({ estado: 'cancelado' }, debe(0, 100))).toBeNull();
  });
});
