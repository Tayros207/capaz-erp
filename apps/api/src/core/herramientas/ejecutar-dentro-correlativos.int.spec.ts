import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { exito } from '@capaz/shared';
import { z } from 'zod';
import { abrirPool } from '../../pruebas/base-de-pruebas.js';
import { siguienteNumero } from '../correlativos/siguiente-numero.js';
import { crearEntorno, type Entorno } from './pruebas-del-ejecutor.js';
import { herramientaDePrueba } from './pruebas.js';

// Una herramienta ejecutada con `ejecutarDentro` (borradores, reglas) debe poder pedir correlativos y
// emitir eventos: el punto de guardado queda registrado como la transacción en curso.

let pool: pg.Pool;
let e: Entorno;
beforeAll(() => {
  pool = abrirPool('app');
  e = crearEntorno(pool, () => [
    herramientaDePrueba({
      nombre: 'numera',
      entrada: z.strictObject({}),
      salida: z.strictObject({ n: z.number() }),
      ejecutar: async (_a, _c, tx) => exito({ n: await siguienteNumero(tx, 'dentro', { anio: 2026 }) }),
    }),
    herramientaDePrueba({
      nombre: 'padre_numera',
      entrada: z.strictObject({}),
      salida: z.strictObject({ n: z.number() }),
      ejecutar: async (_a, ctx, tx) => {
        const r = await e.ejecutor.ejecutarDentro(tx, 'numera', {}, { ctx });
        return r as ReturnType<typeof exito<{ n: number }>>;
      },
    }),
  ]);
});
afterAll(() => pool.end());

describe('ejecutarDentro y correlativos', () => {
  it('la herramienta hija obtiene su número y dos llamadas dan números consecutivos', async () => {
    const a = await e.llamar('padre_numera', {});
    const b = await e.llamar('padre_numera', {});
    expect(a).toMatchObject({ ok: true, datos: { n: 1 } });
    expect(b).toMatchObject({ ok: true, datos: { n: 2 } });
  });
});
