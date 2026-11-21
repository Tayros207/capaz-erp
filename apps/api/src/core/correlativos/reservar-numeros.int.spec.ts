import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { reservarNumeros } from './reservar-numeros.js';
import { CorrelativoSinTransaccion, siguienteNumero } from './siguiente-numero.js';

let app: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
beforeAll(() => {
  app = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(app);
});
afterAll(() => app.end());

const ctx = (e: string) => ({ empresaId: e, usuarioId: 'u1' });

describe('reservarNumeros', () => {
  it('devuelve el primero del bloque y deja el contador al final', async () => {
    const e = empresaDePrueba();
    const primero = await conEmpresa(ctx(e), (tx) => reservarNumeros(tx, 'r', { serie: 'H', anio: 2031 }, 5));
    expect(primero).toBe(1);
    expect(await conEmpresa(ctx(e), (tx) => reservarNumeros(tx, 'r', { serie: 'H', anio: 2031 }, 3))).toBe(6);
    expect(await conEmpresa(ctx(e), (tx) => siguienteNumero(tx, 'r', { serie: 'H', anio: 2031 }))).toBe(9);
  });

  it('serie y año llevan cuentas separadas', async () => {
    const e = empresaDePrueba();
    const p = (o: { serie?: string; anio: number }) => conEmpresa(ctx(e), (tx) => reservarNumeros(tx, 'r', o, 2));
    expect([await p({ serie: 'A', anio: 2031 }), await p({ serie: 'B', anio: 2031 }), await p({ serie: 'A', anio: 2032 })]).toEqual([1, 1, 1]);
  });

  it('sin huecos: si la transacción se revierte, el bloque se devuelve', async () => {
    const e = empresaDePrueba();
    await expect(conEmpresa(ctx(e), async (tx) => { await reservarNumeros(tx, 'k', { anio: 2031 }, 10); throw new Error('x'); })).rejects.toThrow('x');
    expect(await conEmpresa(ctx(e), (tx) => reservarNumeros(tx, 'k', { anio: 2031 }, 1))).toBe(1);
  });

  it('exige la transacción de conEmpresa y una cantidad válida', async () => {
    await expect(reservarNumeros({} as never, 'k', { anio: 2031 }, 1)).rejects.toBeInstanceOf(CorrelativoSinTransaccion);
    const e = empresaDePrueba();
    await expect(conEmpresa(ctx(e), (tx) => reservarNumeros(tx, 'k', { anio: 2031 }, 0))).rejects.toThrow('cantidad');
  });
});
