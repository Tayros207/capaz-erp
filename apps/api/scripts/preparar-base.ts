import pg from 'pg';
import { ROLES, baseDe, credencialesDeRoles, urlDeAdmin, urlDelDueno, variable, type Rol } from './config.ts';

// `pnpm db:preparar`: deja las bases `capaz` y `capaz_test` (y `CAPAZ_TEST_DB`, si existe) con sus cuatro roles (ADR-011).
// Corre con el superusuario del contenedor LOCAL (DATABASE_URL_ADMIN) y es idempotente.
// En Neon no hay superusuario: allí el dueño del proyecto crea los roles con `--solo-roles`
// usando DATABASE_URL_ADMIN = URL de `neondb_owner` (fase 10a).
//
// Los roles se crean SIEMPRE por SQL y sin SUPERUSER, BYPASSRLS ni CREATEROLE: los que crea la
// consola de algunos proveedores traen BYPASSRLS y la RLS no les aplicaría.

const NOMBRE_DE_PRUEBAS = /^capaz_test(_[a-z0-9]+)?$/;

/** La base de pruebas de este carril (`CAPAZ_TEST_DB`), si la hay. La lectura del entorno es de `config.ts`. */
function baseDePruebasDelCarril(): string | null {
  let nombre: string;
  try {
    nombre = variable('CAPAZ_TEST_DB');
  } catch {
    return null;
  }
  if (!NOMBRE_DE_PRUEBAS.test(nombre)) throw new Error(`CAPAZ_TEST_DB «${nombre}» no cumple ${NOMBRE_DE_PRUEBAS}.`);
  return nombre;
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function asegurarRol(c: pg.Client, rol: Rol, contrasena: string): Promise<void> {
  const { rowCount } = await c.query('select 1 from pg_roles where rolname = $1', [rol]);
  const opciones = `login nosuperuser nobypassrls nocreaterole nocreatedb noinherit password ${literal(contrasena)}`;
  await c.query(`${rowCount ? 'alter' : 'create'} role ${ident(rol)} with ${opciones}`);
}

async function asegurarBase(c: pg.Client, base: string): Promise<void> {
  const { rowCount } = await c.query('select 1 from pg_database where datname = $1', [base]);
  if (!rowCount) await c.query(`create database ${ident(base)} owner capaz_owner`);
  else await c.query(`alter database ${ident(base)} owner to capaz_owner`);
  // Nadie entra por defecto; cada rol recibe CONNECT explícito.
  await c.query(`revoke all on database ${ident(base)} from public`);
  for (const rol of ROLES) await c.query(`grant connect on database ${ident(base)} to ${ident(rol)}`);
}

async function verificarSinPrivilegios(c: pg.Client): Promise<void> {
  const { rows } = await c.query<{ rolname: string }>(
    `select rolname from pg_roles where rolname = any($1) and (rolsuper or rolbypassrls or rolcreaterole)`,
    [ROLES],
  );
  if (rows.length) throw new Error(`Roles con privilegios prohibidos: ${rows.map((r) => r.rolname).join(', ')}`);
}

export async function prepararBase(opciones: { soloRoles?: boolean } = {}): Promise<void> {
  const credenciales = credencialesDeRoles();
  const bases = [...new Set([baseDe(urlDelDueno()), 'capaz_test', baseDePruebasDelCarril()].filter((b): b is string => b !== null))];
  const c = new pg.Client({ connectionString: urlDeAdmin() });
  await c.connect();
  try {
    for (const rol of ROLES) await asegurarRol(c, rol, credenciales[rol].contrasena);
    if (!opciones.soloRoles) for (const base of bases) await asegurarBase(c, base);
    await verificarSinPrivilegios(c);
    console.log(`Roles listos: ${ROLES.join(', ')}${opciones.soloRoles ? '' : ` · bases: ${bases.join(', ')}`}`);
  } finally {
    await c.end();
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  prepararBase({ soloRoles: process.argv.includes('--solo-roles') }).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
