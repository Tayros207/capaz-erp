import pg from 'pg';
import { baseDe, conBase, variable } from '../config.ts';

// Protecciones del sembrador: solo base local, y la API debe ser la local. Nunca lee NEON_*.

export const ANFITRIONES_LOCALES = ['localhost', '127.0.0.1', '::1', '[::1]'];

export const CORREO_DEMO = '@demo.capaz.test';
export const CLAVE_DEMO = 'DemoCapaz2026!';

export type Entorno = { api: string; origen: string; urls: { auth: string; sistema: string; app: string }; admin: string; base: string };

function exigirLocal(nombre: string, url: string): void {
  const host = new URL(url).hostname;
  if (!ANFITRIONES_LOCALES.includes(host)) {
    throw new Error(`El sembrador de demostración solo corre contra una base local. ${nombre} apunta a «${host}»: no se hace nada.`);
  }
}

export function leerEntorno(): Entorno {
  const urls = { auth: variable('DATABASE_URL_AUTH'), sistema: variable('DATABASE_URL_SISTEMA'), app: variable('DATABASE_URL_APP') };
  for (const [n, u] of Object.entries(urls)) exigirLocal(`DATABASE_URL_${n.toUpperCase()}`, u);
  const base = baseDe(urls.app);
  // El superusuario local solo sirve para contar filas y limpiar; se conecta a la base de la aplicación.
  const adminBruta = variable('DATABASE_URL_ADMIN');
  exigirLocal('DATABASE_URL_ADMIN', adminBruta);
  const api = process.env.DEMO_API ?? `http://localhost:${process.env.PORT ?? '3001'}`;
  exigirLocal('la URL de la API', api);
  const origen = (process.env.ORIGENES_PERMITIDOS ?? 'http://localhost:5173').split(',')[0]!.trim();
  return { api, origen, urls, admin: conBase(adminBruta, base), base };
}

export async function conAdmin<T>(e: Entorno, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: e.admin });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/**
 * Better Auth limita los intentos de acceso por IP y minuto (`INTENTOS_DE_ACCESO`); sembrar crea muchas
 * cuentas seguidas. En la base local se vacía ese contador (`auth.rate_limit`): es solo un contador de ritmo.
 */
export async function soltarLimiteDeAcceso(e: Entorno): Promise<void> {
  await conAdmin(e, (c) => c.query('delete from auth.rate_limit'));
}
