import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { abrirPool, comoEmpresa, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { Mantenimiento } from './mantenimiento.js';
import { RegistroDeTareas } from './registro-de-tareas.js';

let app: pg.Pool;
let sistema: pg.Pool;
const AHORA = new Date('2031-06-15T12:00:00Z');
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);

beforeAll(() => {
  app = abrirPool('app');
  sistema = abrirPool('sistema');
});
afterAll(() => Promise.all([app.end(), sistema.end()]));

describe('mantenimiento diario', () => {
  it('borra solo lo vencido, con el reloj controlado', async () => {
    const e = empresaDePrueba();
    await comoEmpresa(app, e, async (c) => {
      for (const [clave, dias] of [['vieja', 31], ['reciente', 29]] as const)
        await c.query(`insert into core.idempotencia (tenant_id, clave, herramienta, hash_args, creado_en) values ($1, $2, 'h', 'x', $3)`, [e, clave, hace(dias)]);
      for (const [jti, dias] of [['usada-ayer-y-medio', 1.5], ['usada-hoy', 0.5]] as const)
        await c.query(`insert into core.confirmaciones_usadas (tenant_id, jti, usado_en) values ($1, $2, $3)`, [e, jti, hace(dias)]);
      for (const [n, dias] of [['viejo', 91], ['nuevo', 89]] as const)
        await c.query(`insert into core.eventos_procesados (tenant_id, evento_id, consumidor, procesado_en) values ($1, gen_random_uuid(), $2, $3)`, [e, n, hace(dias)]);
    }, { confirmar: true });

    const m = new Mantenimiento({ sistema } as unknown as DatabaseService, new RegistroDeTareas(), () => AHORA);
    const r = await m.ejecutar();
    expect(r.idempotencia).toBeGreaterThanOrEqual(1);

    const quedan = await comoEmpresa(app, e, async (c) => ({
      idem: (await c.query('select clave from core.idempotencia')).rows.map((x) => x.clave),
      conf: (await c.query('select jti from core.confirmaciones_usadas')).rows.map((x) => x.jti),
      proc: (await c.query('select consumidor from core.eventos_procesados')).rows.map((x) => x.consumidor),
    }));
    expect(quedan).toEqual({ idem: ['reciente'], conf: ['usada-hoy'], proc: ['nuevo'] });
  });

  it('se registra como tarea diaria', () => {
    const tareas = new RegistroDeTareas();
    new Mantenimiento({ sistema } as unknown as DatabaseService, tareas).onModuleInit();
    expect(tareas.todas().map((t) => [t.nombre, t.cadaSegundos])).toEqual([['mantenimiento_diario', 86_400]]);
  });
});
