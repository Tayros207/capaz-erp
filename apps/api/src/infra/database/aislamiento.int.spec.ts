import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';

// Aislamiento real entre dos empresas con el rol `capaz_app`. Cada tabla nueva con tenant_id se
// agrega a `EJEMPLOS` (insert mínimo, `$1` = empresa) con su modo de acceso para `capaz_app`.
// La prueba de cobertura obliga a no olvidarla. Las filas se siembran con el rol dueño, que también
// está sujeto a la RLS (forzada): sin empresa fijada no inserta nada.

type Modo = 'completo' | 'lectura' | 'insercion';
const EJEMPLOS: Record<string, { sql: string; modo: Modo }> = {
  'core.empresa_config': { sql: `insert into core.empresa_config (tenant_id) values ($1)`, modo: 'completo' },
  'core.empresa_modulos': { sql: `insert into core.empresa_modulos (tenant_id, modulo) values ($1, 'ejemplo')`, modo: 'lectura' },
  'core.empresa_modulos_eventos': {
    sql: `insert into core.empresa_modulos_eventos (tenant_id, modulo, evento, estado_nuevo) values ($1, 'ejemplo', 'alta', 'activo')`,
    modo: 'lectura',
  },
  'core.usuario_modulos': { sql: `insert into core.usuario_modulos (tenant_id, usuario_id, modulo) values ($1, 'u1', 'ejemplo')`, modo: 'completo' },
  'core.solicitudes_modulo': {
    sql: `insert into core.solicitudes_modulo (tenant_id, modulo, usuario_id) values ($1, 'ejemplo', 'u1')`,
    modo: 'insercion',
  },
  'core.auditoria': {
    sql: `insert into core.auditoria (tenant_id, usuario_id, modulo, herramienta, canal, resultado, hash_args, request_id) values ($1, 'u1', 'core', 'ejemplo', 'ui', 'ok', 'h', 'r1')`,
    modo: 'insercion',
  },
  'core.confirmaciones_usadas': { sql: `insert into core.confirmaciones_usadas (tenant_id, jti) values ($1, 'jti-1')`, modo: 'insercion' },
  'core.idempotencia': { sql: `insert into core.idempotencia (tenant_id, clave, herramienta, hash_args) values ($1, 'c1', 'h', 'x')`, modo: 'completo' },
  'core.eventos_salida': { sql: `insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, 'ejemplo.creado', '{"x":1}')`, modo: 'insercion' },
  'core.eventos_procesados': {
    sql: `insert into core.eventos_procesados (tenant_id, evento_id, consumidor) values ($1, '00000000-0000-7000-8000-000000000001', 'c1')`,
    modo: 'insercion',
  },
  'core.contadores': { sql: `insert into core.contadores (tenant_id, clave, serie, anio) values ($1, 'ejemplo', '', 2026)`, modo: 'completo' },
  'core.clientes': { sql: `insert into core.clientes (tenant_id, clase, nombre, nombre_normalizado, creado_por) values ($1, 'persona', 'Ana', 'ana', 'u1')`, modo: 'completo' },
  'core.productos': { sql: `insert into core.productos (tenant_id, nombre, nombre_normalizado, tipo, creado_por) values ($1, 'Tarjeta', 'tarjeta', 'producto', 'u1')`, modo: 'completo' },
  'core.sucursales': { sql: `insert into core.sucursales (tenant_id, codigo, nombre) values ($1, 'LIM', 'Lima')`, modo: 'completo' },
  'core.conexiones': { sql: `insert into core.conexiones (id, tenant_id, conector, creado_por) values (md5($1::text || 'c1')::uuid, $1, 'ejemplo', 'u1')`, modo: 'completo' },
  'core.referencias_externas': { sql: `insert into core.referencias_externas (tenant_id, conector, entidad, id_interno, id_externo) values ($1, 'ejemplo', 'cliente', 'i1', 'x1')`, modo: 'completo' },
  'core.sincronizaciones': {
    sql: `insert into core.sincronizaciones (tenant_id, conector, conexion_id, tipo, entidad, iniciado_por) values ($1, 'ejemplo', md5($1::text || 'c1')::uuid, 'importar', 'cliente', 'u1')`,
    modo: 'completo',
  },
  'core.claves_api': {
    sql: `insert into core.claves_api (hash, id, tenant_id, nombre, prefijo, creado_por) values ('hash-' || $1::text, md5($1::text || 'a1')::uuid, $1, 'Clave', 'cpz_', 'u1')`,
    modo: 'completo',
  },
  'core.webhooks_entrantes': {
    sql: `insert into core.webhooks_entrantes (tenant_id, clave_api_id, evento, clave_idempotencia, carga) values ($1, md5($1::text || 'a1')::uuid, 'ejemplo.recibido', 'k1', '{}')`,
    modo: 'completo',
  },
  'core.webhooks_salientes': {
    sql: `insert into core.webhooks_salientes (id, tenant_id, nombre, url, eventos, secreto_cifrado, clave_version, creado_por) values (md5($1::text || 'b1')::uuid, $1, 'Hook', 'https://ejemplo.test/h', array['x'], 'cifrado', 1, 'u1')`,
    modo: 'completo',
  },
  'core.webhooks_envios': {
    sql: `insert into core.webhooks_envios (tenant_id, webhook_id, evento_id, tipo) values ($1, md5($1::text || 'b1')::uuid, '00000000-0000-7000-8000-000000000002', 'ejemplo.creado')`,
    modo: 'completo',
  },
  'core.borradores': {
    sql: `insert into core.borradores (tenant_id, herramienta, modulo, args, args_originales, resumen, origen, propuesto_por) values ($1, 'ejemplo', 'core', '{}', '{}', 'Resumen', 'texto', 'u1')`,
    modo: 'completo',
  },
  'core.reglas_automaticas': {
    sql: `insert into core.reglas_automaticas (id, tenant_id, nombre, disparador_tipo, disparador, acciones, creado_por) values (md5($1::text || 'd1')::uuid, $1, 'Regla', 'manual', '{}', '[]', 'u1')`,
    modo: 'completo',
  },
  'core.reglas_ejecuciones': {
    sql: `insert into core.reglas_ejecuciones (tenant_id, regla_id, disparado_por, resultado) values ($1, md5($1::text || 'd1')::uuid, '{}', 'ok')`,
    modo: 'insercion',
  },
  'core.reglas_disparos': { sql: `insert into core.reglas_disparos (tenant_id, regla_id, clave) values ($1, md5($1::text || 'd1')::uuid, 'k1')`, modo: 'insercion' },
};

let app: pg.Pool;
let owner: pg.Pool;
const A = empresaDePrueba();
const B = empresaDePrueba();

beforeAll(async () => {
  app = abrirPool('app');
  owner = abrirPool('owner');
  await owner.query(`insert into core.modulos (codigo, nombre) values ('ejemplo', 'Ejemplo') on conflict do nothing`);
  await owner.query(`insert into core.conectores (codigo, nombre, autenticacion) values ('ejemplo', 'Ejemplo', 'ninguna') on conflict do nothing`);
  // empresa_modulos va antes que usuario_modulos (llave compuesta).
  const orden = Object.keys(EJEMPLOS).sort((a, b) => (a === 'core.empresa_modulos' ? -1 : b === 'core.empresa_modulos' ? 1 : 0));
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
      where c.relkind = 'r' and n.nspname in ('core','registro','cotizador')
        and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id')`);
    expect(rows.map((r) => r.tabla).sort()).toEqual(Object.keys(EJEMPLOS).sort());
  });
});

describe.each(Object.entries(EJEMPLOS))('%s con capaz_app', (tabla, { sql, modo }) => {
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

describe('capaz_app no puede saltarse la RLS', () => {
  it('no puede desactivar la política ni asumir otro rol', async () => {
    await expect(app.query('alter table core.empresa_config disable row level security')).rejects.toThrow();
    await comoEmpresa(app, A, async (c) => {
      await expect(c.query('set role capaz_owner')).rejects.toThrow();
    });
  });
});
