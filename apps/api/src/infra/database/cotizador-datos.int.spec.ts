import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';

// Reglas propias de las tablas del Cotizador (0024): CHECK, inmutabilidad de versiones emitidas, solo inserción de eventos,
// módulo en baja, `capaz_sistema` sin permisos y llave compuesta entre empresas. Todo con `capaz_app` y su empresa fijada.

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
      await c.query(`insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1, 'cotizador', 'activo')`, [emp]);
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
  await owner.query(`insert into core.modulos (codigo, nombre) values ('cotizador', 'Cotizador') on conflict do nothing`);
  for (const e of [A, B, C]) await activar(e);
});
afterAll(async () => {
  await app.end();
  await owner.end();
  await sistema.end();
});

/** Cotización, versión y dos líneas; devuelve los ids. */
async function sembrar(c: pg.PoolClient, emp: string) {
  const cot = (await c.query(`insert into cotizador.cotizaciones (tenant_id, titulo, creado_por) values ($1, 'Volantes', 'u1') returning id`, [emp])).rows[0].id as string;
  const ver = (
    await c.query(`insert into cotizador.versiones (tenant_id, cotizacion_id, version, creado_por) values ($1, $2, 1, 'u1') returning id`, [emp, cot])
  ).rows[0].id as string;
  for (const pos of [0, 1]) {
    await c.query(
      `insert into cotizador.version_lineas (tenant_id, version_id, posicion, descripcion, cantidad_milesimas, precio_unitario_milesimas, importe_centimos, igv_centimos, total_centimos)
       values ($1, $2, $3, 'Línea', 1000, 1000, 100, 18, 118)`,
      [emp, ver, pos],
    );
  }
  return { cot, ver };
}

function lineaSql(emp: string, ver: string, pos: number): [string, unknown[]] {
  return [
    `insert into cotizador.version_lineas (tenant_id, version_id, posicion, descripcion, cantidad_milesimas, precio_unitario_milesimas, importe_centimos, igv_centimos, total_centimos)
     values ($1, $2, $3, 'Otra', 1000, 1000, 100, 18, 118)`,
    [emp, ver, pos],
  ];
}

describe('versiones emitidas son inmutables', () => {
  it('emitir pasa; después ni la versión ni sus líneas se tocan', async () => {
    await comoEmpresa(app, A, async (c) => {
      const { ver } = await sembrar(c, A);
      // Antes de emitir se puede editar y borrar líneas
      await c.query(`update cotizador.version_lineas set descripcion = 'Editada' where version_id = $1 and posicion = 1`, [ver]);
      await c.query(`delete from cotizador.version_lineas where version_id = $1 and posicion = 1`, [ver]);
      await c.query(`insert into cotizador.version_lineas (tenant_id, version_id, posicion, descripcion, cantidad_milesimas, precio_unitario_milesimas, importe_centimos, igv_centimos, total_centimos) values ($1, $2, 1, 'Nueva', 1000, 1000, 100, 18, 118)`, [A, ver]);
      await c.query(`update cotizador.versiones set observaciones = 'x' where id = $1`, [ver]);
      expect((await c.query(`update cotizador.versiones set emitida_en = now(), emitida_por = 'u1' where id = $1`, [ver])).rowCount).toBe(1);
      const intentos: Array<[string, unknown[]]> = [
        [`update cotizador.versiones set observaciones = 'y' where id = $1`, [ver]],
        [`delete from cotizador.versiones where id = $1`, [ver]],
        lineaSql(A, ver, 5),
        [`update cotizador.version_lineas set descripcion = 'z' where version_id = $1 and posicion = 0`, [ver]],
        [`delete from cotizador.version_lineas where version_id = $1 and posicion = 0`, [ver]],
      ];
      for (const [q, p] of intentos) {
        await c.query('savepoint s');
        await expect(c.query(q, p), q).rejects.toThrow(/emitida/);
        await c.query('rollback to savepoint s');
      }
    });
  });

  it('una versión emitida de otra cotización no afecta a las líneas de una versión sin emitir', async () => {
    await comoEmpresa(app, A, async (c) => {
      const a = await sembrar(c, A);
      const b = await sembrar(c, A);
      await c.query(`update cotizador.versiones set emitida_en = now(), emitida_por = 'u1' where id = $1`, [a.ver]);
      expect((await c.query(`update cotizador.version_lineas set descripcion = 'ok' where version_id = $1`, [b.ver])).rowCount).toBe(2);
    });
  });
});

describe('reglas de las cotizaciones', () => {
  it('emitida exige número y cliente; la numeración va completa', async () => {
    await comoEmpresa(app, A, async (c) => {
      const { cot } = await sembrar(c, A);
      await c.query('savepoint s');
      await expect(c.query(`update cotizador.cotizaciones set estado = 'emitida' where id = $1`, [cot])).rejects.toThrow(/cotizacion_estado_(numero|cliente)/);
      await c.query('rollback to savepoint s');
      await c.query('savepoint s');
      await expect(c.query(`update cotizador.cotizaciones set numero = 1 where id = $1`, [cot])).rejects.toThrow(/cotizacion_numeracion/);
      await c.query('rollback to savepoint s');
      await c.query('savepoint s');
      await expect(c.query(`update cotizador.cotizaciones set estado = 'emitida', numero = 1, anio = 2026 where id = $1`, [cot])).rejects.toThrow(/cotizacion_estado_cliente/);
      await c.query('rollback to savepoint s');
      expect(
        (await c.query(`update cotizador.cotizaciones set estado = 'emitida', numero = 1, anio = 2026, cliente_id = ${cliente(A)} where id = $1`, [cot])).rowCount,
      ).toBe(1);
      // aceptada exige fecha; anulada exige anulado_en (y al revés)
      await c.query('savepoint s');
      await expect(c.query(`update cotizador.cotizaciones set estado = 'aceptada' where id = $1`, [cot])).rejects.toThrow(/cotizacion_aceptacion/);
      await c.query('rollback to savepoint s');
      await c.query('savepoint s');
      await expect(c.query(`update cotizador.cotizaciones set estado = 'anulada' where id = $1`, [cot])).rejects.toThrow(/cotizacion_anulacion/);
      await c.query('rollback to savepoint s');
      // el número no se repite en el año
      const otra = (await c.query(`insert into cotizador.cotizaciones (tenant_id, titulo, creado_por) values ($1, 'Otra', 'u1') returning id`, [A])).rows[0].id;
      await expect(
        c.query(`update cotizador.cotizaciones set estado = 'emitida', numero = 1, anio = 2026, cliente_id = ${cliente(A)} where id = $1`, [otra]),
      ).rejects.toThrow(/uq_cotizador_cotizaciones_numero/);
    });
  });

  it('no se borra una cotización', async () => {
    await comoEmpresa(app, A, async (c) => {
      const { cot } = await sembrar(c, A);
      await expect(c.query(`delete from cotizador.cotizaciones where id = $1`, [cot])).rejects.toThrow();
    });
  });
});

describe('listas de precio y demás CHECK', () => {
  const lista = (p1: number, p2: number, p3: number, nombre = 'L'): [string, unknown[]] => [
    `insert into cotizador.listas_de_precio (tenant_id, nombre, nombre_normalizado, p100_centimos, p1000_centimos, p5000_centimos, creado_por) values ($1, $5, $5, $2, $3, $4, 'u1')`,
    [A, p1, p2, p3, nombre],
  ];

  it('exige p100 < p1000 < p5000', async () => {
    await comoEmpresa(app, A, async (c) => {
      await expect(c.query(...lista(19000, 15000, 40000))).rejects.toThrow(/lista_invariante_b/);
    });
    await comoEmpresa(app, A, async (c) => {
      await expect(c.query(...lista(19000, 58000, 58000))).rejects.toThrow(/lista_invariante_b/);
    });
    await comoEmpresa(app, A, async (c) => {
      expect((await c.query(...lista(19000, 58000, 120000))).rowCount).toBe(1);
    });
  });

  it('el nombre no se repite entre las activas; una archivada libera el nombre', async () => {
    await comoEmpresa(app, A, async (c) => {
      await c.query(...lista(1, 2, 3, 'dup'));
      await c.query('savepoint s');
      await expect(c.query(...lista(1, 2, 3, 'dup'))).rejects.toThrow(/uq_cotizador_listas_nombre/);
      await c.query('rollback to savepoint s');
      await c.query(`update cotizador.listas_de_precio set archivado_en = now() where nombre_normalizado = 'dup'`);
      expect((await c.query(...lista(1, 2, 3, 'dup'))).rowCount).toBe(1);
    });
  });

  it('configuración: umbrales, utilidad, redondeo, IGV; una fila por empresa', async () => {
    const mal = [
      `umbral_minimo_pct = 30`, // no menor que verde (30)
      `utilidad_pct = 100`,
      `utilidad_pct = -1`,
      `redondeo_comercial = '2'`,
      `igv_porcentaje = 101`,
      `utilidad_base = 'otra'`,
    ];
    for (const set of mal) {
      await comoEmpresa(app, A, async (c) => {
        await c.query(`insert into cotizador.configuracion (tenant_id) values ($1)`, [A]);
        await expect(c.query(`update cotizador.configuracion set ${set}`), set).rejects.toThrow(/configuracion_/);
      });
    }
    await comoEmpresa(app, A, async (c) => {
      await c.query(`insert into cotizador.configuracion (tenant_id) values ($1)`, [A]);
      expect((await c.query(`update cotizador.configuracion set utilidad_base = 'costo', utilidad_pct = 150`)).rowCount).toBe(1);
      await expect(c.query(`insert into cotizador.configuracion (tenant_id) values ($1)`, [A])).rejects.toThrow(/configuracion_pkey/);
    });
  });

  it('ajuste de cliente: porcentaje fuera de rango o cero; uno por cliente', async () => {
    for (const p of [0, -100, 501]) {
      await comoEmpresa(app, A, async (c) => {
        await expect(
          c.query(`insert into cotizador.ajustes_de_cliente (tenant_id, cliente_id, porcentaje, creado_por) values ($1, ${cliente(A)}, $2, 'u1')`, [A, p]),
        ).rejects.toThrow(/ajuste_porcentaje/);
      });
    }
    await comoEmpresa(app, A, async (c) => {
      const ins = `insert into cotizador.ajustes_de_cliente (tenant_id, cliente_id, porcentaje, creado_por) values ($1, ${cliente(A)}, -5, 'u1')`;
      await c.query(ins, [A]);
      await expect(c.query(ins, [A])).rejects.toThrow(/uq_cotizador_ajustes_cliente/);
    });
  });

  it('versión y línea: el total es subtotal + IGV', async () => {
    await comoEmpresa(app, A, async (c) => {
      const { cot, ver } = await sembrar(c, A);
      await c.query('savepoint s');
      await expect(c.query(`update cotizador.versiones set subtotal_centimos = 100, igv_centimos = 18, total_centimos = 119 where id = $1`, [ver])).rejects.toThrow(/version_total/);
      await c.query('rollback to savepoint s');
      expect((await c.query(`update cotizador.versiones set subtotal_centimos = 100, igv_centimos = 18, total_centimos = 118 where id = $1`, [ver])).rowCount).toBe(1);
      await expect(c.query(`update cotizador.version_lineas set total_centimos = 1 where version_id = $1`, [ver])).rejects.toThrow(/linea_total/);
      void cot;
    });
  });
});

describe('eventos: solo inserción', () => {
  it('update y delete fallan con permission denied', async () => {
    await comoEmpresa(app, A, async (c) => {
      const { cot } = await sembrar(c, A);
      await c.query(`insert into cotizador.eventos (tenant_id, cotizacion_id, version, tipo, usuario_id) values ($1, $2, 1, 'creada', 'u1')`, [A, cot]);
      await c.query('savepoint s');
      await expect(c.query(`update cotizador.eventos set motivo = 'x'`)).rejects.toThrow(/permission denied/);
      await c.query('rollback to savepoint s');
      await expect(c.query(`delete from cotizador.eventos`)).rejects.toThrow(/permission denied/);
    });
  });

  it('el rol dueño tampoco los cambia (disparador)', async () => {
    await comoEmpresa(
      owner,
      A,
      async (c) => {
        const { cot } = await sembrar(c, A);
        await c.query(`insert into cotizador.eventos (tenant_id, cotizacion_id, version, tipo, usuario_id) values ($1, $2, 1, 'creada', 'u1')`, [A, cot]);
        await expect(c.query(`update cotizador.eventos set motivo = 'x'`)).rejects.toThrow();
      },
    );
  });

  it('tipo fuera de la lista falla', async () => {
    await comoEmpresa(app, A, async (c) => {
      const { cot } = await sembrar(c, A);
      await expect(c.query(`insert into cotizador.eventos (tenant_id, cotizacion_id, version, tipo, usuario_id) values ($1, $2, 1, 'rara', 'u1')`, [A, cot])).rejects.toThrow(/evento_tipo/);
    });
  });
});

describe('módulo, sistema y empresas', () => {
  it('con el módulo dado de baja no se escribe en cotizador', async () => {
    await sistema.query(`select core.dar_baja_modulo($1, 'cotizador', null, 'pruebas')`, [C]);
    await expect(
      comoEmpresa(app, C, (c) =>
        c.query(`insert into cotizador.listas_de_precio (tenant_id, nombre, nombre_normalizado, p100_centimos, p1000_centimos, p5000_centimos, creado_por) values ($1, 'L', 'l', 1, 2, 3, 'u1')`, [C]),
      ),
    ).rejects.toThrow(/no está activo/);
    // se sigue leyendo
    await comoEmpresa(app, C, async (c) => {
      expect((await c.query(`select 1 from cotizador.listas_de_precio`)).rowCount).toBe(0);
    });
  });

  it('capaz_sistema no lee ninguna tabla de cotizador', async () => {
    const { rows } = await owner.query<{ tablename: string }>(`select tablename from pg_tables where schemaname = 'cotizador'`);
    expect(rows.length).toBe(12);
    // `enlaces` es la única con lectura de columnas para el sistema (0027); el resto, nada.
    for (const { tablename } of rows.filter((r) => r.tablename !== 'enlaces')) {
      await expect(sistema.query(`select 1 from cotizador.${tablename} limit 1`), tablename).rejects.toThrow(/permission denied/);
    }
  });

  it('una línea que apunta a la versión de otra empresa falla por la llave compuesta', async () => {
    let verB = '';
    await comoEmpresa(
      app,
      B,
      async (c) => {
        verB = (await sembrar(c, B)).ver;
      },
      { confirmar: true },
    );
    await comoEmpresa(app, A, async (c) => {
      await expect(c.query(...lineaSql(A, verB, 0))).rejects.toThrow(/version_lineas_version_fk/);
    });
  });

  it('las funciones de inmutabilidad no son ejecutables por PUBLIC ni son security definer', async () => {
    const { rows } = await owner.query(
      `select proname, prosecdef, has_function_privilege('public', oid, 'execute') as publico from pg_proc where pronamespace = 'cotizador'::regnamespace`,
    );
    expect(rows.map((r) => r.proname).sort()).toEqual(['proteger_lineas_emitidas', 'proteger_version_emitida']);
    for (const r of rows) {
      expect(r.prosecdef).toBe(false);
      expect(r.publico).toBe(false);
    }
  });
});
