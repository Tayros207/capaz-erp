import { CORREO_DEMO, conAdmin, type Entorno } from './entorno.ts';

/** Borra SOLO lo sembrado: cuentas `@demo.capaz.test` y las empresas de las que son miembros, en la base local. */
export async function limpiar(e: Entorno, log: (m: string) => void): Promise<void> {
  await conAdmin(e, async (c) => {
    const { rows: usuarios } = await c.query<{ id: string; email: string }>('select id, email from auth."user" where email like $1', [`%${CORREO_DEMO}`]);
    const ids = usuarios.map((u) => u.id);
    if (!ids.length) return log('No hay nada sembrado que limpiar.');
    const { rows: orgs } = await c.query<{ organization_id: string }>('select distinct organization_id from auth.member where user_id = any($1::text[])', [ids]);
    const empresas = orgs.map((o) => o.organization_id);
    const { rows: tablas } = await c.query<{ s: string; t: string }>(
      `select c.table_schema s, c.table_name t from information_schema.columns c
         join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
        where c.column_name = 'tenant_id' and c.table_schema not in ('pg_catalog', 'information_schema')`,
    );
    await c.query('begin');
    try {
      await c.query('set local session_replication_role = replica'); // sin comprobar llaves foráneas ni disparadores de solo inserción
      for (const { s, t } of tablas) await c.query(`delete from "${s}"."${t}" where tenant_id = any($1::text[])`, [empresas]);
      await c.query('delete from core.plataforma_admins where usuario_id = any($1::text[])', [ids]);
      await c.query('delete from auth.invitation where organization_id = any($1::text[]) or inviter_id = any($2::text[])', [empresas, ids]);
      await c.query('delete from auth.member where organization_id = any($1::text[]) or user_id = any($2::text[])', [empresas, ids]);
      await c.query('delete from auth.session where user_id = any($1::text[])', [ids]);
      await c.query('delete from auth.account where user_id = any($1::text[])', [ids]);
      await c.query('delete from auth.verification where identifier = any($1::text[])', [usuarios.map((u) => u.email)]);
      await c.query('delete from auth.organization where id = any($1::text[])', [empresas]);
      await c.query('delete from auth."user" where id = any($1::text[])', [ids]);
      await c.query('commit');
    } catch (err) {
      await c.query('rollback');
      throw err;
    }
    log(`Limpiado: ${usuarios.length} cuentas demo y ${empresas.length} empresas.`);
  });
}
