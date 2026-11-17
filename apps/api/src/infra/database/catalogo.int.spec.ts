import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool } from '../../pruebas/base-de-pruebas.js';

// Pruebas de catálogo (ADR-011, ADR-012): leen pg_catalog y fallan si aparece una tabla, llave o
// función que rompa las reglas. Son la defensa contra el olvido en migraciones futuras.

const ESQUEMAS = ['core', 'registro', 'cotizador', 'crm', 'ordenes', 'insumos', 'compras', 'personal'];
let owner: pg.Pool;

beforeAll(() => {
  owner = abrirPool('owner');
});
afterAll(() => owner.end());

describe('catálogo: aislamiento', () => {
  it('toda tabla con tenant_id tiene RLS habilitada, forzada y la política «aislamiento» sin restricción de rol', async () => {
    const { rows } = await owner.query<{ tabla: string; rls: boolean; forzada: boolean; roles: string[] | null }>(`
      select n.nspname || '.' || c.relname as tabla, c.relrowsecurity as rls, c.relforcerowsecurity as forzada,
             (select p.polroles::regrole[]::text[] from pg_policy p where p.polrelid = c.oid and p.polname = 'aislamiento') as roles
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname = any($1)
        and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)
      order by 1`, [ESQUEMAS]);
    expect(rows.length).toBeGreaterThan(0);
    const malas = rows.filter((r) => !r.rls || !r.forzada || r.roles === null || !r.roles.includes('-'));
    expect(malas, 'tablas sin aplicar_aislamiento()').toEqual([]);
  });

  it('toda llave foránea entre tablas con tenant_id incluye tenant_id en ambos lados', async () => {
    const { rows } = await owner.query<{ llave: string }>(`
      with con_tenant as (
        select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = any($1) and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id')
      )
      select conname as llave from pg_constraint k
      where k.contype = 'f' and k.conrelid in (select oid from con_tenant) and k.confrelid in (select oid from con_tenant)
        and not exists (select 1 from unnest(k.conkey) x join pg_attribute a on a.attrelid = k.conrelid and a.attnum = x where a.attname = 'tenant_id')`,
      [ESQUEMAS]);
    expect(rows.map((r) => r.llave), 'llaves foráneas sin tenant_id').toEqual([]);
  });
});

describe('catálogo: escalabilidad (ADR-013)', () => {
  // Excepción: la clave primaria por `id` (uuid), necesaria como destino de llaves foráneas. Las
  // búsquedas por empresa usan los demás índices, que sí empiezan por tenant_id.
  it('todo índice de una tabla con tenant_id empieza por tenant_id (salvo la clave primaria)', async () => {
    const { rows } = await owner.query<{ indice: string; primera: string }>(`
      select i.relname as indice, a.attname as primera
      from pg_index x
      join pg_class c on c.oid = x.indrelid
      join pg_class i on i.oid = x.indexrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum = x.indkey[0]
      where n.nspname = any($1) and c.relkind = 'r' and not x.indisprimary
        and exists (select 1 from pg_attribute t where t.attrelid = c.oid and t.attname = 'tenant_id' and not t.attisdropped)`,
      [ESQUEMAS]);
    expect(rows.length).toBeGreaterThan(0);
    // Excepción: el token del enlace público es único en toda la base (identifica a la empresa sin sesión).
    const GLOBALES = ['uq_cotizador_enlaces_token'];
    const malos = rows.filter((r) => r.primera !== 'tenant_id' && !GLOBALES.includes(r.indice));
    expect(malos, 'índices que no empiezan por tenant_id').toEqual([]);
  });
});

describe('catálogo: funciones', () => {
  it('ninguna función propia es security definer ni ejecutable por PUBLIC', async () => {
    const { rows } = await owner.query<{ funcion: string; definer: boolean; publico: boolean }>(`
      select n.nspname || '.' || p.proname as funcion, p.prosecdef as definer,
             has_function_privilege('public', p.oid, 'execute') as publico
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = any($1)`, [[...ESQUEMAS, 'auth']]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.definer).map((r) => r.funcion), 'security definer').toEqual([]);
    expect(rows.filter((r) => r.publico).map((r) => r.funcion), 'ejecutables por PUBLIC').toEqual([]);
  });
});

describe('catálogo: estado de cuenta (0022)', () => {
  it('las tablas de cuenta son de lectura para capaz_app y las funciones solo las ejecuta capaz_sistema', async () => {
    const { rows } = await owner.query<{ tabla: string; ins: boolean; upd: boolean; del: boolean; sel: boolean }>(`
      select t as tabla, has_table_privilege('capaz_app', t, 'insert') as ins, has_table_privilege('capaz_app', t, 'update') as upd,
             has_table_privilege('capaz_app', t, 'delete') as del, has_table_privilege('capaz_app', t, 'select') as sel
      from unnest(array['core.empresa_cuenta', 'core.empresa_cuenta_eventos']) t`);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r, r.tabla).toMatchObject({ sel: true, ins: false, upd: false, del: false });
    const ev = await owner.query<{ upd: boolean; del: boolean; ins: boolean }>(`
      select has_table_privilege('capaz_sistema', 'core.empresa_cuenta_eventos', 'update') as upd,
             has_table_privilege('capaz_sistema', 'core.empresa_cuenta_eventos', 'delete') as del,
             has_table_privilege('capaz_sistema', 'core.empresa_cuenta_eventos', 'insert') as ins`);
    expect(ev.rows[0]).toEqual({ upd: false, del: false, ins: true });
    const { rows: fn } = await owner.query<{ f: string; app: boolean; sis: boolean }>(`
      select p.proname as f, has_function_privilege('capaz_app', p.oid, 'execute') as app, has_function_privilege('capaz_sistema', p.oid, 'execute') as sis
      from pg_proc p where p.pronamespace = 'core'::regnamespace and p.proname in ('pausar_cuenta', 'dar_baja_cuenta', 'reactivar_cuenta', 'cambiar_estado_cuenta')`);
    expect(fn).toHaveLength(4);
    for (const r of fn) expect(r, r.f).toMatchObject({ app: false, sis: true });
  });
});

describe('catálogo: ficha de cuenta (0023)', () => {
  it('capaz_app no tiene ningún permiso sobre core.empresa_ficha; capaz_sistema lee, inserta y edita solo columnas, sin borrar', async () => {
    const { rows } = await owner.query<{ priv: string; app: boolean; sis: boolean }>(`
      select p.priv, has_table_privilege('capaz_app', 'core.empresa_ficha', p.priv) as app,
             has_table_privilege('capaz_sistema', 'core.empresa_ficha', p.priv) as sis
      from (values ('select'), ('insert'), ('update'), ('delete')) p(priv)`);
    expect(Object.fromEntries(rows.map((r) => [r.priv, r.app]))).toEqual({ select: false, insert: false, update: false, delete: false });
    expect(Object.fromEntries(rows.map((r) => [r.priv, r.sis]))).toEqual({ select: true, insert: true, update: false, delete: false });
    const cols = await owner.query<{ a: number }>(`
      select count(*)::int as a from information_schema.column_privileges
      where grantee = 'capaz_app' and table_schema = 'core' and table_name = 'empresa_ficha'`);
    expect(cols.rows[0]!.a).toBe(0);
  });
});

describe('catálogo: roles', () => {
  it('ningún rol de Capaz tiene SUPERUSER, BYPASSRLS ni CREATEROLE', async () => {
    const { rows } = await owner.query<{ rolname: string }>(
      `select rolname from pg_roles where rolname like 'capaz_%' and (rolsuper or rolbypassrls or rolcreaterole)`,
    );
    expect(rows).toEqual([]);
  });

  it('capaz_app no puede leer ninguna tabla del esquema auth; capaz_sistema no toca registro, cotizador, crm, ordenes, insumos, compras ni personal', async () => {
    const { rows } = await owner.query<{ rol: string; tabla: string }>(`
      select r.rol, n.nspname || '.' || c.relname as tabla
      from (values ('capaz_app', array['auth']), ('capaz_sistema', array['registro','cotizador','crm','ordenes','insumos','compras','personal'])) as r(rol, esquemas)
      join pg_namespace n on n.nspname = any(r.esquemas)
      join pg_class c on c.relnamespace = n.oid and c.relkind in ('r','v')
      where has_table_privilege(r.rol, c.oid, 'select')`);
    expect(rows).toEqual([]);
  });

  it('capaz_app puede usar pg_trgm (usage en public) pero no crear nada en public; los demás roles no reciben nada', async () => {
    const { rows } = await owner.query<{ rol: string; usage: boolean; crear: boolean }>(`
      select r as rol, has_schema_privilege(r, 'public', 'usage') as usage, has_schema_privilege(r, 'public', 'create') as crear
      from unnest(array['capaz_app', 'capaz_sistema', 'capaz_auth']) r`);
    const por = Object.fromEntries(rows.map((r) => [r.rol, r]));
    expect(por.capaz_app).toMatchObject({ usage: true, crear: false });
    expect(por.capaz_sistema).toMatchObject({ usage: false, crear: false });
    expect(por.capaz_auth).toMatchObject({ usage: false, crear: false });
  });

  it('capaz_app ejecuta similarity() y el operador % de pg_trgm', async () => {
    const app = abrirPool('app');
    try {
      const { rows } = await app.query<{ s: number; p: boolean }>(`select similarity('ana', 'anna') as s, 'ana' % 'anna' as p`);
      expect(rows[0]!.s).toBeGreaterThan(0);
      expect(typeof rows[0]!.p).toBe('boolean');
    } finally {
      await app.end();
    }
  });
});
