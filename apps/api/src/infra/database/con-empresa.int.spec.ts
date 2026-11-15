import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type pg from 'pg';
import { abrirPool, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { CambioDeEmpresa, type Transaccion } from './con-empresa.js';

let app: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;

beforeAll(() => {
  app = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(app);
});
afterAll(() => app.end());

const ctx = (empresaId: string) => ({ empresaId, usuarioId: 'u1' });
const empresaFijada = async (tx: Transaccion) =>
  (await tx.execute(sql`select current_setting('app.tenant_id', true) as t, current_setting('app.user_id', true) as u`)).rows[0];

describe('conEmpresa', () => {
  it('fija empresa y usuario dentro de la transacción y los suelta fuera', async () => {
    const e = empresaDePrueba();
    const dentro = await conEmpresa(ctx(e), empresaFijada);
    expect(dentro).toEqual({ t: e, u: 'u1' });
    const { rows } = await app.query(`select current_setting('app.tenant_id', true) as t`);
    expect(rows[0].t ?? '').toBe('');
  });

  it('anida reutilizando la misma transacción', async () => {
    const e = empresaDePrueba();
    const r = await conEmpresa(ctx(e), async (tx) => {
      await tx.execute(sql`insert into core.empresa_config (tenant_id) values (${e})`);
      return conEmpresa(ctx(e), async (tx2) => {
        expect(tx2).toBe(tx);
        const q = await tx2.execute(sql`select count(*)::int as n from core.empresa_config where tenant_id = ${e}`);
        return q.rows[0]!.n;
      });
    });
    expect(r).toBe(1);
  });

  it('rechaza cambiar de empresa dentro de una transacción', async () => {
    await expect(
      conEmpresa(ctx(empresaDePrueba()), () => conEmpresa(ctx(empresaDePrueba()), async () => undefined)),
    ).rejects.toBeInstanceOf(CambioDeEmpresa);
  });

  it('revierte todo si la función falla', async () => {
    const e = empresaDePrueba();
    await expect(
      conEmpresa(ctx(e), async (tx) => {
        await tx.execute(sql`insert into core.empresa_config (tenant_id) values (${e})`);
        throw new Error('falla a propósito');
      }),
    ).rejects.toThrow('falla a propósito');
    const n = await conEmpresa(ctx(e), async (tx) => (await tx.execute(sql`select count(*)::int as n from core.empresa_config`)).rows[0]!.n);
    expect(n).toBe(0);
  });

  it('exige una empresa', async () => {
    await expect(conEmpresa({ empresaId: '', usuarioId: 'u' }, async () => 1)).rejects.toThrow(/empresa/);
  });
});
