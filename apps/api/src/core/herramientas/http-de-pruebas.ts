import { randomUUID } from 'node:crypto';
import type { AppDePruebas } from '../../pruebas/app-de-pruebas.js';

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
