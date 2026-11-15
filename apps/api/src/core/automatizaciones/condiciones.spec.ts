import { describe, expect, it } from 'vitest';
import type { Condicion } from '@capaz/shared';
import { diaLocal, evaluarCondicion, evaluarCondiciones, sumarDias, sustituir, valorDe } from './condiciones.js';

const raiz = { disparo: { tipo: 'evento' }, datos: { total: 150, texto: 'Hola Mundo', nulo: null, lista: ['a', 'b'], cliente: { nombre: 'Ana' }, fecha: '2026-11-10', num: '12' } };
const c = (campo: string, op: Condicion['op'], valor?: Condicion['valor']): Condicion => ({ campo, op, valor });

describe('valorDe', () => {
  it('sigue rutas y no sale de las propias', () => {
    expect(valorDe(raiz, 'datos.cliente.nombre')).toBe('Ana');
    expect(valorDe(raiz, 'datos.lista.1')).toBe('b');
    expect(valorDe(raiz, 'datos.nada')).toBeUndefined();
    expect(valorDe(raiz, 'datos.constructor')).toBeUndefined();
    expect(valorDe(raiz, '__proto__.x')).toBeUndefined();
    expect(valorDe(raiz, 'datos.total + 1')).toBeUndefined();
  });
});

describe('operadores', () => {
  it('igual y distinto', () => {
    expect(evaluarCondicion(c('datos.total', 'igual', 150), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.num', 'igual', 12), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.cliente.nombre', 'igual', 'Ana'), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.nada', 'igual', 'x'), raiz)).toBe(false);
    expect(evaluarCondicion(c('datos.total', 'distinto', 1), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.nada', 'distinto', 'x'), raiz)).toBe(true);
  });
  it('mayor y menor, por número y por fecha; lo no comparable no coincide', () => {
    expect(evaluarCondicion(c('datos.total', 'mayor', 100), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.total', 'menor', 100), raiz)).toBe(false);
    expect(evaluarCondicion(c('datos.fecha', 'menor', '2026-12-01'), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.texto', 'mayor', 1), raiz)).toBe(false);
    expect(evaluarCondicion(c('datos.texto', 'menor', 1), raiz)).toBe(false);
  });
  it('contiene en texto (sin mayúsculas) y en listas', () => {
    expect(evaluarCondicion(c('datos.texto', 'contiene', 'mundo'), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.lista', 'contiene', 'b'), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.lista', 'contiene', 'z'), raiz)).toBe(false);
  });
  it('existe: nulo y ausente no existen', () => {
    expect(evaluarCondicion(c('datos.total', 'existe'), raiz)).toBe(true);
    expect(evaluarCondicion(c('datos.nulo', 'existe'), raiz)).toBe(false);
    expect(evaluarCondicion(c('datos.nada', 'existe', false), raiz)).toBe(true);
  });
  it('se unen por «y»; vacío coincide', () => {
    expect(evaluarCondiciones([], raiz)).toBe(true);
    expect(evaluarCondiciones([c('datos.total', 'mayor', 100), c('datos.texto', 'contiene', 'zzz')], raiz)).toBe(false);
  });
});

describe('sustituir', () => {
  it('conserva el tipo si es solo la plantilla y recorre en profundidad', () => {
    const r = sustituir({ monto: '{{datos.total}}', nota: 'Para {{ datos.cliente.nombre }}: {{datos.total}}', l: ['{{datos.lista.0}}', 3], 'clave_{x}': 1 }, raiz);
    expect(r.valor).toEqual({ monto: 150, nota: 'Para Ana: 150', l: ['a', 3], 'clave_{x}': 1 });
    expect(r.faltantes).toEqual([]);
  });
  it('anota lo que falta y no ejecuta expresiones', () => {
    const r = sustituir({ a: '{{datos.nada}}', b: '{{datos.total * 2}}' }, raiz);
    expect(r.faltantes).toEqual(['datos.nada', 'datos.total * 2']);
  });
});

describe('días', () => {
  it('día local y suma de días', () => {
    expect(diaLocal(new Date('2026-11-10T03:00:00Z'), 'America/Lima')).toBe('2026-11-09');
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});
