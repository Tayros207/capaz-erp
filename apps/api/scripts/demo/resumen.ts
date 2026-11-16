import pg from 'pg';
import { conAdmin, type Entorno } from './entorno.ts';

const TABLAS: [string, string][] = [
  ['productos', 'core.productos'], ['contactos', 'core.clientes'], ['sucursales', 'core.sucursales'], ['movimientos', 'registro.movimientos'],
  ['deudas', 'registro.deudas'], ['oportunid.', 'crm.oportunidades'], ['pedidos', 'ordenes.pedidos'], ['artículos', 'insumos.articulos'],
  ['compras', 'compras.ordenes'], ['colaborad.', 'personal.colaboradores'], ['borradores', 'core.borradores'],
];

/** Conteos por empresa y comprobación de aislamiento con el rol de la aplicación (RLS real, no el superusuario). */
export async function resumir(e: Entorno, log: (m: string) => void): Promise<void> {
  const empresas = await conAdmin(e, async (c) => {
    const { rows } = await c.query<{ id: string; name: string }>(
      `select distinct o.id, o.name from auth.organization o join auth.member m on m.organization_id = o.id
         join auth."user" u on u.id = m.user_id where u.email like '%@demo.capaz.test' order by o.name`,
    );
    const filas: { id: string; nombre: string; n: Record<string, number>; estados: string }[] = [];
    for (const o of rows) {
      const n: Record<string, number> = {};
      for (const [rotulo, tabla] of TABLAS) n[rotulo] = Number((await c.query(`select count(*) n from ${tabla} where tenant_id = $1`, [o.id])).rows[0].n);
      const { rows: m } = await c.query<{ modulo: string; estado: string }>('select modulo, estado from core.empresa_modulos where tenant_id = $1 order by modulo', [o.id]);
      filas.push({ id: o.id, nombre: o.name, n, estados: m.map((x) => `${x.modulo}:${x.estado}`).join(' ') });
    }
    return filas;
  });
  for (const f of empresas) {
    log(`\n${f.nombre}\n  ${Object.entries(f.n).map(([k, v]) => `${k} ${v}`).join(' · ')}\n  módulos: ${f.estados}`);
  }
  await comprobarAislamiento(e, empresas, log);
}

async function comprobarAislamiento(e: Entorno, empresas: { id: string; nombre: string; n: Record<string, number> }[], log: (m: string) => void): Promise<void> {
  const app = new pg.Pool({ connectionString: e.urls.app, max: 1 });
  try {
    let bien = 0;
    for (const f of empresas) {
      const c = await app.connect();
      try {
        await c.query('begin');
        await c.query(`select set_config('app.tenant_id', $1, true)`, [f.id]);
        const { rows } = await c.query('select count(*)::int total, count(*) filter (where tenant_id <> $1)::int ajenas from core.productos', [f.id]);
        await c.query('rollback');
        if (rows[0].ajenas === 0 && rows[0].total === f.n.productos) bien++;
        else log(`  ✗ AISLAMIENTO: ${f.nombre} ve ${rows[0].total} productos (propios ${f.n.productos}, ajenos ${rows[0].ajenas}).`);
      } finally {
        c.release();
      }
    }
    log(`\nAislamiento (rol capaz_app con RLS): ${bien}/${empresas.length} empresas ven únicamente sus datos.`);
  } finally {
    await app.end();
  }
}
