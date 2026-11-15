import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { CorrelativoSinTransaccion, siguienteNumero } from './siguiente-numero.js';

let app: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
beforeAll(() => {
  app = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(app);
});
afterAll(() => app.end());

const ctx = (e: string) => ({ empresaId: e, usuarioId: 'u1' });

describe('siguienteNumero', () => {
  it('empieza en 1 y es consecutivo', async () => {
    const e = empresaDePrueba();
    const n = [];
    for (let i = 0; i < 3; i++) n.push(await conEmpresa(ctx(e), (tx) => siguienteNumero(tx, 'orden', { serie: 'A', anio: 2031 })));
    expect(n).toEqual([1, 2, 3]);
  });

  it('dos llamadas simultáneas (y veinte) dan números distintos y consecutivos', async () => {
    const e = empresaDePrueba();
    const dos = await Promise.all([1, 2].map(() => conEmpresa(ctx(e), (tx) => siguienteNumero(tx, 'venta', { anio: 2031 }))));
    expect([...dos].sort()).toEqual([1, 2]);
    const muchos = await Promise.all(Array.from({ length: 20 }, () => conEmpresa(ctx(e), (tx) => siguienteNumero(tx, 'venta', { anio: 2031 }))));
    expect(new Set(muchos).size).toBe(20);
    expect([...muchos].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 3));
  });

  it('serie, año, clave y empresa llevan cuentas separadas', async () => {
    const e = empresaDePrueba();
    const otra = empresaDePrueba();
    const p = (c: string, o: { serie?: string; anio: number }, emp = e) => conEmpresa(ctx(emp), (tx) => siguienteNumero(tx, c, o));
    expect(await Promise.all([p('x', { serie: 'A', anio: 2031 }), p('x', { serie: 'B', anio: 2031 }), p('x', { serie: 'A', anio: 2032 }), p('y', { serie: 'A', anio: 2031 }), p('x', { serie: 'A', anio: 2031 }, otra)])).toEqual([1, 1, 1, 1, 1]);
  });

  it('sin huecos: si la transacción se revierte, el número se devuelve', async () => {
    const e = empresaDePrueba();
    await conEmpresa(ctx(e), (tx) => siguienteNumero(tx, 'k', { anio: 2031 }));
    await expect(conEmpresa(ctx(e), async (tx) => { await siguienteNumero(tx, 'k', { anio: 2031 }); throw new Error('x'); })).rejects.toThrow('x');
    expect(await conEmpresa(ctx(e), (tx) => siguienteNumero(tx, 'k', { anio: 2031 }))).toBe(2);
  });

  it('exige la transacción de conEmpresa', async () => {
    await expect(siguienteNumero({} as never, 'k', { anio: 2031 })).rejects.toBeInstanceOf(CorrelativoSinTransaccion);
  });
});
