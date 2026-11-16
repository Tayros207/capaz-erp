import { randomUUID } from 'node:crypto';
import type { AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';

// Cliente HTTP de las pruebas de herramientas: como el de `app-de-pruebas`, pero deja elegir las
// cabeceras (origen, clave de idempotencia) y el cuerpo en crudo. Un jar de cookies por sesión.

export type RespuestaHttp = { estado: number; cabeceras: Headers; cuerpo: any };

export type Sesion = {
  correo: string;
  usuarioId: string;
  pedir: (metodo: string, ruta: string, cuerpo?: unknown, cabeceras?: Record<string, string>) => Promise<RespuestaHttp>;
  /** `POST /api/v1/herramientas/:nombre` con `{ args, confirmacion }`. */
  herramienta: (
    nombre: string,
    args?: unknown,
    opciones?: { confirmacion?: string; clave?: string; cabeceras?: Record<string, string>; cuerpo?: unknown },
  ) => Promise<RespuestaHttp>;
};

export const CLAVE_DE_PRUEBA = 'una-clave-larga-123';

function crearSesion(app: AppDePruebas): Omit<Sesion, 'correo' | 'usuarioId'> {
  const cookies = new Map<string, string>();
  const pedir: Sesion['pedir'] = async (metodo, ruta, cuerpo, cabeceras = {}) => {
    const res = await fetch(app.url + ruta, {
      method: metodo,
      headers: {
        origin: app.origen,
        ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...cabeceras,
      },
      body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    });
    for (const c of res.headers.getSetCookie()) {
      const [par] = c.split(';');
      const [k, ...v] = par!.split('=');
      cookies.set(k!, v.join('='));
    }
    return { estado: res.status, cabeceras: res.headers, cuerpo: await res.json().catch(() => null) };
  };
  return {
    pedir,
    herramienta: (nombre, args, o = {}) =>
      pedir(
        'POST',
        `/api/v1/herramientas/${nombre}`,
        o.cuerpo ?? { ...(args !== undefined && { args }), ...(o.confirmacion !== undefined && { confirmacion: o.confirmacion }) },
        { ...(o.clave ? { 'idempotency-key': o.clave } : {}), ...o.cabeceras },
      ),
  };
}

/** Registra a una persona nueva y abre su sesión (sin empresa todavía). */
export async function abrirSesion(app: AppDePruebas, nombre = 'Persona de prueba'): Promise<Sesion> {
  const base = crearSesion(app);
  const correo = `u-${randomUUID().slice(0, 8)}@prueba.pe`;
  const alta = await base.pedir('POST', '/api/auth/sign-up/email', { email: correo, password: CLAVE_DE_PRUEBA, name: nombre });
  if (alta.estado !== 200) throw new Error(`No se pudo registrar a la persona de prueba (${alta.estado}).`);
  const yo = await base.pedir('GET', '/api/v1/yo');
  return { ...base, correo, usuarioId: yo.cuerpo.datos.usuario.id as string };
}

/** Crea una empresa para la sesión y devuelve su id. */
export async function crearEmpresa(sesion: Sesion, nombre: string): Promise<string> {
  const r = await sesion.pedir('POST', '/api/v1/empresas', { nombre });
  if (r.estado !== 201) throw new Error(`No se pudo crear la empresa de prueba (${r.estado}).`);
  return r.cuerpo.datos.id as string;
}

/** Ejecuta una sentencia con el grupo `sistema` (el mismo que usa el servidor para lo que cruza empresas). */
async function comoSistema<T>(fn: (pool: ReturnType<typeof abrirPool>) => Promise<T>): Promise<T> {
  const pool = abrirPool('sistema');
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

/** Activa un módulo para la empresa (sin prueba). */
export async function activarModulo(empresaId: string, codigo: string): Promise<void> {
  await comoSistema((p) => p.query(`select core.activar_modulo($1, $2, null, 'pruebas')`, [empresaId, codigo]));
}

/** Da de baja un módulo de la empresa. */
export async function darDeBajaModulo(empresaId: string, codigo: string): Promise<void> {
  await comoSistema((p) => p.query(`select core.dar_baja_modulo($1, $2, null, 'pruebas')`, [empresaId, codigo]));
}

/**
 * Agrega a la persona de `sesion` como `member` de la empresa con acceso a `modulo`, y fija esa empresa como la
 * activa de su sesión. La caché de cookie de Better Auth guarda la empresa activa: se vuelve a entrar con la misma clave.
 */
export async function agregarMiembro(
  app: AppDePruebas,
  empresaId: string,
  sesion: Sesion,
  acceso: { modulo: string; nivel: 'completo' | 'lectura'; alcance: 'todos' | 'propios' },
): Promise<Sesion> {
  const auth = abrirPool('auth');
  const appPool = abrirPool('app');
  try {
    await auth.query(`insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, 'member', now())`, [randomUUID(), empresaId, sesion.usuarioId]);
    await auth.query(`update auth.session set active_organization_id = $1 where user_id = $2`, [empresaId, sesion.usuarioId]);
    await comoEmpresa(
      appPool,
      empresaId,
      (c) =>
        c.query(
          `insert into core.usuario_modulos (tenant_id, usuario_id, modulo, nivel, alcance) values ($1, $2, $3, $4, $5)
           on conflict (tenant_id, usuario_id, modulo) do update set nivel = excluded.nivel, alcance = excluded.alcance`,
          [empresaId, sesion.usuarioId, acceso.modulo, acceso.nivel, acceso.alcance],
        ),
      { confirmar: true },
    );
  } finally {
    await Promise.all([auth.end(), appPool.end()]);
  }
  const nueva = crearSesion(app);
  const r = await nueva.pedir('POST', '/api/auth/sign-in/email', { email: sesion.correo, password: CLAVE_DE_PRUEBA });
  if (r.estado !== 200) throw new Error(`No se pudo reabrir la sesión del miembro de prueba (${r.estado}).`);
  // Se reemplaza el jar de la sesión recibida: quien la tenía sigue usándola con la empresa activa nueva.
  return Object.assign(sesion, nueva);
}
