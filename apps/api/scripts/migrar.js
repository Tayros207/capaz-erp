import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { ROLES, conBase, urlDelDueno } from "./config.js";
const CARPETA = fileURLToPath(new URL('../drizzle', import.meta.url));
async function verificarRoles(c) {
    const { rows } = await c.query('select rolname, rolsuper, rolbypassrls from pg_roles where rolname = any($1)', [ROLES]);
    const faltan = ROLES.filter((r) => !rows.some((x) => x.rolname === r));
    if (faltan.length)
        throw new Error(`Faltan roles: ${faltan.join(', ')}. Ejecuta pnpm db:preparar.`);
    const malos = rows.filter((r) => r.rolsuper || r.rolbypassrls);
    if (malos.length)
        throw new Error(`Roles con SUPERUSER o BYPASSRLS: ${malos.map((r) => r.rolname).join(', ')}.`);
    const { rows: yo } = await c.query('select current_user as u');
    if (yo[0]?.u !== 'capaz_owner')
        throw new Error(`Las migraciones corren con capaz_owner, no con «${yo[0]?.u}».`);
}
export async function migrar(opciones = {}) {
    const url = opciones.base ? conBase(urlDelDueno(), opciones.base) : urlDelDueno();
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    const cliente = await pool.connect();
    try {
        await verificarRoles(cliente);
        await cliente.query('create schema if not exists core');
    }
    finally {
        cliente.release();
    }
    try {
        await migrate(drizzle(pool), { migrationsFolder: CARPETA, migrationsSchema: 'core', migrationsTable: 'migraciones' });
        console.log(`Migraciones aplicadas en ${new URL(url).pathname.slice(1)}.`);
    }
    finally {
        await pool.end();
    }
}
if (process.argv[1] && import.meta.filename === process.argv[1]) {
    const i = process.argv.indexOf('--base');
    migrar({ base: i > 0 ? process.argv[i + 1] : undefined }).catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    });
}
//# sourceMappingURL=migrar.js.map