import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';

// Reglas de las guías de remisión (0034): inmutables salvo la anulación, líneas solo de inserción, CHECK, número único,
// llave compuesta de línea de pedido, eventos con guía y módulo en baja. Todo con `capaz_app` y su empresa fijada.

let app: pg.Pool;
let owner: pg.Pool;
let sistema: pg.Pool;
const A = empresaDePrueba();
const B = empresaDePrueba();
const C = empresaDePrueba(); // empresa cuyo módulo se da de baja
const cliente = (e: string) => `md5('${e}' || 'cl')::uuid`;

async function activar(emp: string): Promise<void> {
  await comoEmpresa(
    owner,
    emp,
    async (c) => {
      await c.query(`insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1, 'ordenes', 'activo')`, [emp]);
      await c.query(
        `insert into core.clientes (id, tenant_id, clase, nombre, nombre_normalizado, creado_por) values (${cliente(emp)}, $1, 'persona', 'Ana', 'ana', 'u1')`,
        [emp],
      );
    },
    { confirmar: true },
  );
}

beforeAll(async () => {
  app = abrirPool('app');
  owner = abrirPool('owner');
  sistema = abrirPool('sistema');
  await owner.query(`insert into core.modulos (codigo, nombre) values ('ordenes', 'Pedidos') on conflict do nothing`);
  for (const e of [A, B, C]) await activar(e);
});
afterAll(async () => {
  await app.end();
  await owner.end();
  await sistema.end();
});

const COLUMNAS = `tenant_id, serie, numero, cliente_id, destinatario_nombre, fecha_emision, fecha_traslado, punto_partida, punto_llegada, motivo, modalidad, creado_por`;

/** Inserta una guía con valores base y `extra` (columna → literal SQL) que sobrescribe o añade. */
async function guia(c: pg.PoolClient, emp: string, numero: number, extra: Record<string, string> = {}): Promise<string> {
  const base: Record<string, string> = {
    tenant_id: `'${emp}'`,
    serie: `'G001'`,
    numero: String(numero),
    cliente_id: cliente(emp),
    destinatario_nombre: `'Ana'`,
    fecha_emision: `date '2026-01-01'`,
    fecha_traslado: `date '2026-01-02'`,
    punto_partida: `'Av. A 1'`,
    punto_llegada: `'Jr. B 2'`,
    motivo: `'venta'`,
    modalidad: `'privado'`,
    ...extra,
  };
  const cols = Object.keys(base);
  const r = await c.query(`insert into ordenes.guias (${cols.join(', ')}, creado_por) values (${cols.map((k) => base[k]).join(', ')}, 'u1') returning id`);
  return r.rows[0].id as string;
}

async function pedido(c: pg.PoolClient, emp: string): Promise<{ pedido: string; linea: string }> {
  const p = (await c.query(`insert into ordenes.pedidos (tenant_id, cliente_id, fecha, creado_por) values ($1, ${cliente(emp)}, date '2026-01-01', 'u1') returning id`, [emp])).rows[0].id as string;
  const l = (
    await c.query(
      `insert into ordenes.pedido_lineas (tenant_id, pedido_id, posicion, descripcion, cantidad_milesimas, precio_unitario_milesimas, importe_centimos) values ($1, $2, 0, 'Línea', 1000, 1000, 1) returning id`,
      [emp, p],
    )
  ).rows[0].id as string;
  return { pedido: p, linea: l };
}

async function rechaza(c: pg.PoolClient, q: string, p: unknown[], patron: RegExp): Promise<void> {
  await c.query('savepoint s');
  await expect(c.query(q, p), q).rejects.toThrow(patron);
  await c.query('rollback to savepoint s');
}

describe('guías: inmutables salvo la anulación', () => {
  it('no se borra ni cambia sus datos; sí se anula con las 4 columnas', async () => {
    await comoEmpresa(app, A, async (c) => {
      const g = await guia(c, A, 1);
      await rechaza(c, `update ordenes.guias set punto_llegada = 'otro' where id = $1`, [g], /permission denied/);
      await rechaza(c, `delete from ordenes.guias where id = $1`, [g], /permission denied|rechaz|no se/i);
      const r = await c.query(`update ordenes.guias set estado = 'anulada', anulado_en = now(), anulado_por = 'u1', motivo_anulacion = 'error' where id = $1`, [g]);
      expect(r.rowCount).toBe(1);
    });
  });

  it('las líneas no admiten update ni delete, ni siquiera el dueño', async () => {
    await comoEmpresa(app, A, async (c) => {
      const g = await guia(c, A, 1);
      await c.query(`insert into ordenes.guia_lineas (tenant_id, guia_id, posicion, descripcion, cantidad_milesimas) values ($1, $2, 0, 'L', 1000)`, [A, g]);
      await rechaza(c, `update ordenes.guia_lineas set descripcion = 'x' where guia_id = $1`, [g], /solo inserción|permission denied/);
      await rechaza(c, `delete from ordenes.guia_lineas where guia_id = $1`, [g], /solo inserción|permission denied/);
    });
    await comoEmpresa(owner, A, async (c) => {
      const g = await guia(c, A, 1);
      await c.query(`insert into ordenes.guia_lineas (tenant_id, guia_id, posicion, descripcion, cantidad_milesimas) values ($1, $2, 0, 'L', 1000)`, [A, g]);
      await rechaza(c, `update ordenes.guia_lineas set descripcion = 'x' where guia_id = $1`, [g], /solo inserción/);
      await rechaza(c, `delete from ordenes.guia_lineas where guia_id = $1`, [g], /solo inserción/);
    });
  });
});

describe('guías: número y CHECK', () => {
  it('el número es único por empresa y serie; otra empresa puede repetirlo', async () => {
    await comoEmpresa(app, A, async (c) => {
      await guia(c, A, 7);
      await rechaza(c, `insert into ordenes.guias (${COLUMNAS}) values ($1, 'G001', 7, ${cliente(A)}, 'Ana', date '2026-01-01', date '2026-01-01', 'a', 'b', 'venta', 'privado', 'u1')`, [A], /uq_ordenes_guias_numero/);
    });
    await comoEmpresa(app, B, async (c) => {
      expect(await guia(c, B, 7)).toBeTruthy();
    });
  });

  it('rechaza estado, motivo, modalidad, detalle, transportista, número y anulación incoherentes', async () => {
    const casos: Array<[Record<string, string>, RegExp]> = [
      [{ estado: `'otra'` }, /guia_estado/],
      [{ motivo: `'regalo'` }, /guia_motivo/],
      [{ modalidad: `'aereo'` }, /guia_modalidad/],
      [{ motivo: `'otro'` }, /guia_motivo_detalle/],
      [{ modalidad: `'publico'` }, /guia_transportista/],
      [{ numero: '0' }, /guia_numero/],
      [{ estado: `'anulada'` }, /guia_anulacion/],
      [{ anulado_en: 'now()', anulado_por: `'u1'`, motivo_anulacion: `'x'` }, /guia_anulacion/],
      [{ estado: `'anulada'`, anulado_en: 'now()' }, /guia_anulacion/],
    ];
    await comoEmpresa(app, A, async (c) => {
      for (const [extra, patron] of casos) {
        await c.query('savepoint s');
        await expect(guia(c, A, 50, extra), JSON.stringify(extra)).rejects.toThrow(patron);
        await c.query('rollback to savepoint s');
      }
      expect(await guia(c, A, 51, { motivo: `'otro'`, motivo_detalle: `'Muestra'` })).toBeTruthy();
      expect(await guia(c, A, 52, { modalidad: `'publico'`, transportista: `'Cruz'` })).toBeTruthy();
    });
  });
});

describe('líneas de guía: CHECK y llave compuesta', () => {
  it('cantidad > 0 y origen completo o vacío', async () => {
    await comoEmpresa(app, A, async (c) => {
      const g = await guia(c, A, 1);
      const { pedido: p } = await pedido(c, A);
      const q = `insert into ordenes.guia_lineas (tenant_id, guia_id, posicion, descripcion, cantidad_milesimas, pedido_id) values ($1, $2, $3, 'L', $4, $5)`;
      await rechaza(c, q, [A, g, 0, 0, null], /guia_linea_cantidad/);
      await rechaza(c, q, [A, g, 0, -5, null], /guia_linea_cantidad/);
      await rechaza(c, q, [A, g, 0, 1000, p], /guia_linea_origen/);
    });
  });

  it('una línea no puede citar la línea de otro pedido ni de otra empresa', async () => {
    await comoEmpresa(app, A, async (c) => {
      const g = await guia(c, A, 1);
      const uno = await pedido(c, A);
      const dos = await pedido(c, A);
      const q = `insert into ordenes.guia_lineas (tenant_id, guia_id, posicion, descripcion, cantidad_milesimas, pedido_id, pedido_linea_id) values ($1, $2, 0, 'L', 1000, $3, $4)`;
      await rechaza(c, q, [A, g, uno.pedido, dos.linea], /guia_lineas_pedido_linea_fk/);
      expect((await c.query(q, [A, g, uno.pedido, uno.linea])).rowCount).toBe(1);
    });
    await comoEmpresa(app, B, async (c) => {
      const g = await guia(c, B, 1);
      const x = await pedido(c, B);
      // otra empresa: la fila de A no es visible ni referenciable
      await rechaza(c, `insert into ordenes.guia_lineas (tenant_id, guia_id, posicion, descripcion, cantidad_milesimas, pedido_id, pedido_linea_id) values ($1, $2, 0, 'L', 1000, md5('nada')::uuid, $3)`, [B, g, x.linea], /guia_lineas_pedido/);
    });
  });
});

describe('eventos de pedido con guía', () => {
  it('guia_emitida exige guia_id y guia_id exige tipo de guía', async () => {
    await comoEmpresa(app, A, async (c) => {
      const g = await guia(c, A, 1);
      const { pedido: p } = await pedido(c, A);
      const q = `insert into ordenes.pedido_eventos (tenant_id, pedido_id, tipo, guia_id, usuario_id) values ($1, $2, $3, $4, 'u1')`;
      await rechaza(c, q, [A, p, 'guia_emitida', null], /evento_guia/);
      await rechaza(c, q, [A, p, 'nota', g], /evento_guia/);
      expect((await c.query(q, [A, p, 'guia_emitida', g])).rowCount).toBe(1);
      expect((await c.query(q, [A, p, 'guia_anulada', g])).rowCount).toBe(1);
      expect((await c.query(q, [A, p, 'datos_editados', null])).rowCount).toBe(1);
    });
  });
});

describe('módulo en baja', () => {
  it('con ordenes dado de baja no se inserta una guía', async () => {
    await sistema.query(`select core.dar_baja_modulo($1, 'ordenes', null, 'pruebas')`, [C]);
    await expect(comoEmpresa(app, C, (c) => guia(c, C, 1))).rejects.toThrow(/no está activo/);
  });
});
