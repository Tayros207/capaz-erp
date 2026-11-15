import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { crearConEmpresa } from '../infra/database/con-empresa.js';

// Utilidades para las pruebas de integración (`*.int.spec.ts`), contra la base LOCAL `capaz_test`.
// Nunca contra Neon ni producción: `global-setup.ts` lo comprueba. Las pruebas no vacían tablas:
// cada una crea empresas con ids únicos (`empresaDePrueba()`).

const BASE = 'capaz_test';

function urlDePruebas(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta ${nombre} para las pruebas de integración.`);
  const u = new URL(valor);
  u.pathname = `/${BASE}`;
  return u.toString();
}

export const esLocal = (url: string): boolean => ['localhost', '127.0.0.1'].includes(new URL(url).hostname);

export function abrirPool(rol: 'app' | 'owner' | 'auth' | 'sistema'): pg.Pool {
  const nombre = { app: 'DATABASE_URL_APP', owner: 'DATABASE_URL_OWNER', auth: 'DATABASE_URL_AUTH', sistema: 'DATABASE_URL_SISTEMA' }[rol];
  const url = urlDePruebas(nombre);
  if (!esLocal(url)) throw new Error(`${nombre} no es local: las pruebas solo corren contra ${BASE} en localhost.`);
  return new pg.Pool({ connectionString: url, max: 3 });
}

export const empresaDePrueba = (): string => `emp_${randomUUID()}`;

/** Ejecuta `fn` como `capaz_app` con la empresa fijada, en una transacción que se revierte al final. */
export async function comoEmpresa<T>(
  pool: pg.Pool,
  empresaId: string,
  fn: (c: pg.PoolClient) => Promise<T>,
  opciones: { confirmar?: boolean } = {},
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('app.tenant_id', $1, true), set_config('app.user_id', 'prueba', true)`, [empresaId]);
    const r = await fn(c);
    await c.query(opciones.confirmar ? 'commit' : 'rollback');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export const conEmpresaDePruebas = (pool: pg.Pool) => crearConEmpresa(drizzle(pool));
