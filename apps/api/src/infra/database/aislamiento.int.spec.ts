import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { EJEMPLOS } from './aislamiento-ejemplos.js';

// Aislamiento real entre dos empresas con el rol `capaz_app`. Cada tabla nueva con tenant_id se
// agrega a `EJEMPLOS` (en `aislamiento-ejemplos.ts`; insert mínimo, `$1` = empresa) con su modo de acceso para `capaz_app`.
// La prueba de cobertura obliga a no olvidarla. Las filas se siembran con el rol dueño, que también
// está sujeto a la RLS (forzada): sin empresa fijada no inserta nada.

let app: pg.Pool;
let owner: pg.Pool;
const A = empresaDePrueba();
const B = empresaDePrueba();

beforeAll(async () => {
  app = abrirPool('app');
  owner = abrirPool('owner');
  await owner.query(`insert into core.modulos (codigo, nombre) values ('ejemplo', 'Ejemplo') on conflict do nothing`);
  await owner.query(
    `insert into core.modulos (codigo, nombre) values ('registro', 'Registro'), ('crm', 'CRM'), ('ordenes', 'Pedidos'), ('insumos', 'Inventario'), ('compras', 'Compras'), ('personal', 'Personal'), ('cotizador', 'Cotizador'), ('produccion', 'Producción') on conflict do nothing`,
  );
  await owner.query(`insert into core.conectores (codigo, nombre, autenticacion) values ('ejemplo', 'Ejemplo', 'ninguna') on conflict do nothing`);
  // empresa_modulos va antes que usuario_modulos (llave compuesta).
  const orden = Object.keys(EJEMPLOS).sort((a, b) => (a === 'core.empresa_modulos' ? -1 : b === 'core.empresa_modulos' ? 1 : 0));
  // El disparador de escritura de cada módulo exige que la empresa lo tenga activo.
  for (const emp of [A, B]) {
    await comoEmpresa(
      owner,
      emp,
      (c) =>
        c.query(
          `insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1,'registro','activo'), ($1,'crm','activo'), ($1,'ordenes','activo'), ($1,'insumos','activo'), ($1,'compras','activo'), ($1,'personal','activo'), ($1,'cotizador','activo'), ($1,'produccion','activo') on conflict do nothing`,
          [emp],
        ),
      { confirmar: true },
    );
  }
  for (const tabla of orden) {
    for (const emp of [A, B]) await comoEmpresa(owner, emp, (c) => c.query(EJEMPLOS[tabla]!.sql, [emp]), { confirmar: true });
  }
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

describe('toda tabla con tenant_id tiene su ejemplo aquí', () => {
  it('la lista de ejemplos cubre el catálogo', async () => {
    const { rows } = await owner.query<{ tabla: string }>(`
      select n.nspname || '.' || c.relname as tabla from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname in ('core','registro','cotizador','crm','ordenes','insumos','compras','personal','produccion')
        and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id')`);
    expect(rows.map((r) => r.tabla).sort()).toEqual(Object.keys(EJEMPLOS).sort());
  });
});

describe.each(Object.entries(EJEMPLOS).filter(([, e]) => e.modo !== 'plataforma'))('%s con capaz_app', (tabla, { sql, modo }) => {
  it('la empresa A solo ve lo suyo', async () => {
    await comoEmpresa(app, A, async (c) => {
      const { rows } = await c.query(`select tenant_id from ${tabla}`);
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((r) => r.tenant_id))).toEqual(new Set([A]));
    });
  });

  it('sin empresa fijada no se ve nada, ni siquiera con el rol dueño (falla cerrado)', async () => {
    for (const pool of [app, owner]) {
      const { rows } = await pool.query(`select count(*)::int as n from ${tabla}`);
      expect(rows[0].n).toBe(0);
    }
  });

  if (modo === 'completo') {
    it('no puede modificar ni borrar lo de B, ni insertar con el tenant_id de B', async () => {
      await comoEmpresa(app, A, async (c) => {
        expect((await c.query(`update ${tabla} set tenant_id = tenant_id where tenant_id = $1`, [B])).rowCount).toBe(0);
        expect((await c.query(`delete from ${tabla} where tenant_id = $1`, [B])).rowCount).toBe(0);
      });
      await expect(comoEmpresa(app, A, (c) => c.query(sql, [B]))).rejects.toThrow(/row-level security/);
    });
  } else {
    it(`modo «${modo}»: la plataforma administra; la empresa no puede modificar ni borrar`, async () => {
      await expect(comoEmpresa(app, A, (c) => c.query(`update ${tabla} set tenant_id = tenant_id`))).rejects.toThrow(/permission denied/);
      await expect(comoEmpresa(app, A, (c) => c.query(`delete from ${tabla}`))).rejects.toThrow(/permission denied/);
      if (modo === 'lectura') {
        await expect(comoEmpresa(app, A, (c) => c.query(sql, [A]))).rejects.toThrow(/permission denied/);
      }
    });
  }
});

describe.each(Object.entries(EJEMPLOS).filter(([, e]) => e.modo === 'plataforma'))('%s (solo plataforma)', (tabla) => {
  it('capaz_app no puede leer, escribir ni borrar, ni con su empresa fijada', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`select tenant_id from ${tabla}`))).rejects.toThrow(/permission denied/);
    await expect(comoEmpresa(app, A, (c) => c.query(`update ${tabla} set tenant_id = tenant_id`))).rejects.toThrow(/permission denied/);
    await expect(comoEmpresa(app, A, (c) => c.query(`delete from ${tabla}`))).rejects.toThrow(/permission denied/);
  });
  it('sin empresa fijada el dueño no ve nada (la RLS está forzada)', async () => {
    expect((await owner.query(`select count(*)::int as n from ${tabla}`)).rows[0].n).toBe(0);
  });
});

describe('capaz_app no puede saltarse la RLS', () => {
  it('no puede desactivar la política ni asumir otro rol', async () => {
    await expect(app.query('alter table core.empresa_config disable row level security')).rejects.toThrow();
    await comoEmpresa(app, A, async (c) => {
      await expect(c.query('set role capaz_owner')).rejects.toThrow();
    });
  });
});

describe('core.empresa_config: datos de la empresa (0021)', () => {
  it('capaz_app guarda los datos de su empresa y los checks rechazan lo inválido', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    await comoEmpresa(app, A, async (c) => {
      await c.query(`update core.empresa_config set razon_social = 'Mi Empresa SAC', ruc = '20123456789', logo_data_url = $1`, [png]);
      const r = await c.query('select ruc, logo_data_url from core.empresa_config');
      expect(r.rows[0]).toEqual({ ruc: '20123456789', logo_data_url: png });
    }, { confirmar: true });
    const malos = [
      [`ruc = '123'`, []],
      [`ruc = '2012345678A'`, []],
      [`logo_data_url = 'data:image/svg+xml;base64,AAAA'`, []],
      [`logo_data_url = 'https://x/y.png'`, []],
      [`logo_data_url = $1`, ['data:image/png;base64,' + 'A'.repeat(150000)]],
      [`pie_de_documento = $1`, ['x'.repeat(1001)]],
    ] as const;
    for (const [set, params] of malos) {
      await comoEmpresa(
        app,
        A,
        async (c) => {
          await c.query('savepoint s');
          await expect(c.query(`update core.empresa_config set ${set}`, [...params])).rejects.toThrow(/check constraint/);
          await c.query('rollback to savepoint s');
        },
        { confirmar: true },
      );
    }
  });
});

describe('registro: reglas propias de DB2a con capaz_app', () => {
  it('no puede cambiar el monto de un movimiento, pero sí anularlo', async () => {
    await comoEmpresa(app, A, async (c) => {
      await expect(c.query(`update registro.movimientos set monto_centimos = 1`)).rejects.toThrow(/permission denied/);
    });
    await comoEmpresa(app, A, async (c) => {
      const r = await c.query(
        `update registro.movimientos set estado = 'anulado', anulado_en = now(), anulado_por = 'u1', motivo_anulacion = 'prueba'`,
      );
      expect(r.rowCount).toBeGreaterThan(0);
    });
  });

  it('no puede borrar una deuda (disparador)', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`delete from registro.deudas`))).rejects.toThrow();
  });

  it('con el módulo registro en baja, un insert falla con «no está activo»', async () => {
    const E = empresaDePrueba();
    await comoEmpresa(
      owner,
      E,
      async (c) => {
        await c.query(`insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1, 'registro', 'activo')`, [E]);
        await c.query(`update core.empresa_modulos set estado = 'baja', baja_en = now() where tenant_id = $1 and modulo = 'registro'`, [E]);
      },
      { confirmar: true },
    );
    await expect(
      comoEmpresa(app, E, (c) =>
        c.query(`insert into registro.categorias (tenant_id, nombre, nombre_normalizado, tipo, creado_por) values ($1, 'X', 'x', 'egreso', 'u1')`, [E]),
      ),
    ).rejects.toThrow(/no está activo/);
  });
});

describe('ordenes: reglas propias de DB2b con capaz_app', () => {
  it('el historial de un pedido no admite update ni delete (permisos y disparador)', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`update ordenes.pedido_eventos set nota = 'x'`))).rejects.toThrow();
    await expect(comoEmpresa(app, A, (c) => c.query(`delete from ordenes.pedido_eventos`))).rejects.toThrow();
    // Ni siquiera el dueño (con la empresa fijada) puede cambiarlo: lo frena el disparador.
    await expect(comoEmpresa(owner, A, (c) => c.query(`update ordenes.pedido_eventos set nota = 'x'`))).rejects.toThrow(/solo inserción/);
  });

  it('no puede borrar un pedido (disparador)', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`delete from ordenes.pedidos`))).rejects.toThrow();
  });

  it('un pedido confirmado exige número, y el total debe ser subtotal más IGV', async () => {
    await expect(
      comoEmpresa(app, A, (c) =>
        c.query(`insert into ordenes.pedidos (tenant_id, cliente_id, fecha, estado, creado_por) values ($1, md5($1::text || 'cl')::uuid, date '2026-01-01', 'confirmado', 'u1')`, [A]),
      ),
    ).rejects.toThrow(/pedido_estado_numero/);
    await expect(
      comoEmpresa(app, A, (c) =>
        c.query(`insert into ordenes.pedidos (tenant_id, cliente_id, fecha, subtotal_centimos, igv_centimos, total_centimos, creado_por) values ($1, md5($1::text || 'cl')::uuid, date '2026-01-01', 100, 18, 100, 'u1')`, [A]),
      ),
    ).rejects.toThrow(/pedido_total/);
  });
});

describe('crm: reglas propias de DB2b con capaz_app', () => {
  it('con el módulo crm en baja, un insert falla con «no está activo»', async () => {
    const E = empresaDePrueba();
    await comoEmpresa(
      owner,
      E,
      async (c) => {
        await c.query(`insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1, 'crm', 'activo')`, [E]);
        await c.query(`update core.empresa_modulos set estado = 'baja', baja_en = now() where tenant_id = $1 and modulo = 'crm'`, [E]);
      },
      { confirmar: true },
    );
    await expect(
      comoEmpresa(app, E, (c) =>
        c.query(`insert into crm.etapas (tenant_id, nombre, nombre_normalizado, orden, creado_por) values ($1, 'X', 'x', 0, 'u1')`, [E]),
      ),
    ).rejects.toThrow(/no está activo/);
  });

  it('solo una etapa ganada y una perdida activas por empresa', async () => {
    for (const tipo of ['ganada', 'perdida']) {
      await expect(
        comoEmpresa(app, A, async (c) => {
          const ins = `insert into crm.etapas (tenant_id, nombre, nombre_normalizado, orden, tipo, creado_por) values ($1, $2, $2, 9, $3, 'u1')`;
          await c.query(ins, [A, tipo, tipo]);
          await c.query(ins, [A, `${tipo}2`, tipo]);
        }),
      ).rejects.toThrow(/uq_crm_etapas_/);
    }
  });
});

describe('insumos: reglas propias de DB3a con capaz_app', () => {
  const art = `md5($1::text || 'i1')::uuid`;
  const suc = `md5($1::text || 'su')::uuid`;
  const mov = (tipo: string, cantidad: number, resultante: number, extra = '') =>
    `insert into insumos.movimientos (tenant_id, articulo_id, sucursal_id, tipo, cantidad_milesimas, existencia_resultante_milesimas, creado_por${extra ? ', origen_tipo, origen_id' : ''}) values ($1, ${art}, ${suc}, '${tipo}', ${cantidad}, ${resultante}, 'u1'${extra})`;

  it('los movimientos solo se insertan: ni update ni delete, ni siquiera el dueño', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`update insumos.movimientos set motivo = 'x'`))).rejects.toThrow();
    await expect(comoEmpresa(app, A, (c) => c.query(`delete from insumos.movimientos`))).rejects.toThrow();
    await expect(comoEmpresa(owner, A, (c) => c.query(`update insumos.movimientos set motivo = 'x'`))).rejects.toThrow(/solo inserción/);
  });

  it('la existencia no puede ser negativa y es única por artículo y sucursal', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`update insumos.existencias set cantidad_milesimas = -1`))).rejects.toThrow(/existencia_no_negativa/);
    await expect(
      comoEmpresa(app, A, (c) =>
        c.query(`insert into insumos.existencias (tenant_id, articulo_id, sucursal_id, creado_por) values ($1, ${art}, ${suc}, 'u1')`, [A]),
      ),
    ).rejects.toThrow(/insumos_existencias_articulo_sucursal/);
  });

  it('un movimiento respeta el signo de su tipo y la existencia resultante no es negativa', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(mov('entrada', -1000, 4000), [A]))).rejects.toThrow(/movimiento_signo/);
    await expect(comoEmpresa(app, A, (c) => c.query(mov('salida', 1000, 4000), [A]))).rejects.toThrow(/movimiento_signo/);
    await expect(comoEmpresa(app, A, (c) => c.query(mov('ajuste', 0, 5000), [A]))).rejects.toThrow(/movimiento_signo/);
    await expect(comoEmpresa(app, A, (c) => c.query(mov('salida', -9000, -4000), [A]))).rejects.toThrow(/movimiento_existencia_resultante/);
    await comoEmpresa(app, A, async (c) => {
      await c.query(mov('salida', -1000, 4000), [A]);
      await c.query(mov('ajuste', -500, 3500), [A]);
    });
  });

  it('una recepción no suma dos veces: único por origen y artículo', async () => {
    const con = `, 'compra', 'c-1'`;
    await expect(
      comoEmpresa(app, A, async (c) => {
        await c.query(mov('entrada', 1000, 6000, con), [A]);
        await c.query(mov('entrada', 1000, 7000, con), [A]);
      }),
    ).rejects.toThrow(/uq_insumos_movimientos_origen/);
  });

  it('origen_tipo y origen_id van juntos', async () => {
    await expect(
      comoEmpresa(app, A, (c) =>
        c.query(`insert into insumos.movimientos (tenant_id, articulo_id, sucursal_id, tipo, cantidad_milesimas, existencia_resultante_milesimas, origen_tipo, creado_por) values ($1, ${art}, ${suc}, 'entrada', 1000, 6000, 'compra', 'u1')`, [A]),
      ),
    ).rejects.toThrow(/movimiento_origen/);
  });

  it('con el módulo insumos en baja, un insert falla con «no está activo»', async () => {
    const E = empresaDePrueba();
    await comoEmpresa(
      owner,
      E,
      async (c) => {
        await c.query(`insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1, 'insumos', 'activo')`, [E]);
        await c.query(`update core.empresa_modulos set estado = 'baja', baja_en = now() where tenant_id = $1 and modulo = 'insumos'`, [E]);
      },
      { confirmar: true },
    );
    await expect(
      comoEmpresa(app, E, (c) => c.query(`insert into insumos.articulos (tenant_id, producto_id, creado_por) values ($1, gen_random_uuid(), 'u1')`, [E])),
    ).rejects.toThrow(/no está activo/);
  });
});

describe('compras: reglas propias de DB3b con capaz_app', () => {
  const prov = `md5($1::text || 'cl')::uuid`;
  const orden = (cols: string, vals: string) =>
    `insert into compras.ordenes (tenant_id, proveedor_id, fecha, ${cols}, creado_por) values ($1, ${prov}, date '2026-01-01', ${vals}, 'u1')`;

  it('las recepciones y sus líneas solo se insertan: ni update ni delete, ni siquiera el dueño', async () => {
    for (const t of ['recepciones', 'recepcion_lineas']) {
      await expect(comoEmpresa(app, A, (c) => c.query(`update compras.${t} set creado_en = now()`))).rejects.toThrow();
      await expect(comoEmpresa(app, A, (c) => c.query(`delete from compras.${t}`))).rejects.toThrow();
      await expect(comoEmpresa(owner, A, (c) => c.query(`update compras.${t} set creado_en = now()`))).rejects.toThrow(/solo inserción/);
    }
  });

  it('no puede borrar una orden (disparador)', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`delete from compras.ordenes`))).rejects.toThrow();
  });

  it('una orden enviada exige número, y el total debe ser subtotal más IGV', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(orden('estado', `'enviada'`), [A]))).rejects.toThrow(/orden_estado_numero/);
    await expect(
      comoEmpresa(app, A, (c) => c.query(orden('subtotal_centimos, igv_centimos, total_centimos', '100, 18, 100'), [A])),
    ).rejects.toThrow(/orden_total/);
  });

  it('numero, serie y anio van juntos, y la cancelación exige su marca', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(orden('numero', '1'), [A]))).rejects.toThrow(/orden_numeracion/);
    await expect(comoEmpresa(app, A, (c) => c.query(orden('estado', `'cancelada'`), [A]))).rejects.toThrow(/orden_cancelacion/);
  });

  it('lo recibido de una línea no supera lo pedido', async () => {
    await expect(
      comoEmpresa(app, A, (c) => c.query(`update compras.orden_lineas set recibido_milesimas = cantidad_milesimas + 1`)),
    ).rejects.toThrow(/linea_recibido_maximo/);
    await comoEmpresa(app, A, async (c) => {
      const r = await c.query(`update compras.orden_lineas set recibido_milesimas = cantidad_milesimas`);
      expect(r.rowCount).toBe(1);
    });
  });

  it('una recepción tiene número único dentro de su orden y la cantidad de su línea es positiva', async () => {
    await expect(
      comoEmpresa(app, A, (c) =>
        c.query(`insert into compras.recepciones (tenant_id, orden_id, numero, fecha, creado_por) values ($1, md5($1::text || 'k1')::uuid, 1, date '2026-01-03', 'u1')`, [A]),
      ),
    ).rejects.toThrow(/compras_recepciones_numero/);
    await expect(
      comoEmpresa(app, A, (c) =>
        c.query(`insert into compras.recepcion_lineas (tenant_id, recepcion_id, orden_linea_id, cantidad_milesimas) values ($1, md5($1::text || 'k3')::uuid, md5($1::text || 'k2')::uuid, 0)`, [A]),
      ),
    ).rejects.toThrow(/recepcion_linea_cantidad/);
  });

  it('con el módulo compras en baja, un insert falla con «no está activo»', async () => {
    const E = empresaDePrueba();
    await comoEmpresa(
      owner,
      E,
      async (c) => {
        await c.query(`insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1, 'compras', 'activo')`, [E]);
        await c.query(`update core.empresa_modulos set estado = 'baja', baja_en = now() where tenant_id = $1 and modulo = 'compras'`, [E]);
      },
      { confirmar: true },
    );
    await expect(
      comoEmpresa(app, E, (c) => c.query(`insert into compras.ordenes (tenant_id, proveedor_id, fecha, creado_por) values ($1, gen_random_uuid(), date '2026-01-01', 'u1')`, [E])),
    ).rejects.toThrow(/no está activo/);
  });
});

describe('personal: reglas propias de DB3a con capaz_app', () => {
  const col = `md5($1::text || 'p1')::uuid`;

  it('un adelanto no cambia de monto ni se borra, pero sí se anula', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`update personal.adelantos set monto_centimos = 1`))).rejects.toThrow(/permission denied/);
    await expect(comoEmpresa(app, A, (c) => c.query(`delete from personal.adelantos`))).rejects.toThrow(/permission denied/);
    await comoEmpresa(app, A, async (c) => {
      const r = await c.query(`update personal.adelantos set estado = 'anulado', anulado_en = now(), anulado_por = 'u1', motivo_anulacion = 'prueba'`);
      expect(r.rowCount).toBeGreaterThan(0);
    });
  });

  it('un adelanto exige monto positivo y coherencia entre estado y anulación', async () => {
    const ins = (monto: number, estado = 'registrado') =>
      `insert into personal.adelantos (tenant_id, numero, anio, colaborador_id, monto_centimos, fecha, estado, creado_por) values ($1, 2, 2026, ${col}, ${monto}, date '2026-01-01', '${estado}', 'u1')`;
    await expect(comoEmpresa(app, A, (c) => c.query(ins(0), [A]))).rejects.toThrow(/adelanto_monto/);
    await expect(comoEmpresa(app, A, (c) => c.query(ins(100, 'anulado'), [A]))).rejects.toThrow(/adelanto_anulacion/);
    await expect(comoEmpresa(app, A, (c) => c.query(ins(100, 'otro'), [A]))).rejects.toThrow(/adelanto_estado/);
  });

  it('una asistencia es única por colaborador y fecha, y la salida exige entrada', async () => {
    await expect(
      comoEmpresa(app, A, (c) =>
        c.query(`insert into personal.asistencias (tenant_id, colaborador_id, fecha, creado_por) values ($1, ${col}, date '2026-01-01', 'u1')`, [A]),
      ),
    ).rejects.toThrow(/personal_asistencias_colaborador_fecha/);
    await expect(
      comoEmpresa(app, A, (c) =>
        c.query(`insert into personal.asistencias (tenant_id, colaborador_id, fecha, salida, creado_por) values ($1, ${col}, date '2026-01-02', now(), 'u1')`, [A]),
      ),
    ).rejects.toThrow(/asistencia_salida/);
    await comoEmpresa(app, A, (c) =>
      c.query(`insert into personal.asistencias (tenant_id, colaborador_id, fecha, entrada, salida, creado_por) values ($1, ${col}, date '2026-01-02', now(), now(), 'u1')`, [A]),
    );
  });

  it('el estado de una asistencia es uno de la lista', async () => {
    await expect(comoEmpresa(app, A, (c) => c.query(`update personal.asistencias set estado = 'otro'`))).rejects.toThrow(/asistencia_estado/);
  });

  it('el nombre de un colaborador activo es único, pero uno archivado libera el nombre', async () => {
    const ins = `insert into personal.colaboradores (tenant_id, nombre, nombre_normalizado, creado_por) values ($1, 'Luis', 'luis', 'u1')`;
    await expect(comoEmpresa(app, A, (c) => c.query(ins, [A]))).rejects.toThrow(/uq_personal_colaboradores_nombre/);
    await comoEmpresa(app, A, async (c) => {
      await c.query(`update personal.colaboradores set archivado_en = now()`);
      await c.query(ins, [A]);
    });
  });

  it('con el módulo personal en baja, un insert falla con «no está activo»', async () => {
    const E = empresaDePrueba();
    await comoEmpresa(
      owner,
      E,
      async (c) => {
        await c.query(`insert into core.empresa_modulos (tenant_id, modulo, estado) values ($1, 'personal', 'activo')`, [E]);
        await c.query(`update core.empresa_modulos set estado = 'baja', baja_en = now() where tenant_id = $1 and modulo = 'personal'`, [E]);
      },
      { confirmar: true },
    );
    await expect(
      comoEmpresa(app, E, (c) => c.query(`insert into personal.colaboradores (tenant_id, nombre, nombre_normalizado, creado_por) values ($1, 'X', 'x', 'u1')`, [E])),
    ).rejects.toThrow(/no está activo/);
  });
});
