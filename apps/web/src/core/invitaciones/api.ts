import { codigoDeEstado, exito, rechazo, type Respuesta } from '@capaz/shared';
import { interpretarInvitacion, type DetalleDeInvitacion } from './logica.ts';

// Rutas de Better Auth permitidas (lista blanca del servidor): `GET /organization/get-invitation` y
// `POST /organization/accept-invitation`, más `POST /organization/set-active` para dejar la empresa
// activa. No hablan el contrato `Respuesta`, así que se llaman con `fetch` propio.

const SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

async function mensajeDe(r: Response): Promise<string> {
  try {
    const m = (JSON.parse(await r.text()) as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  } catch {
    // cuerpo que no es JSON
  }
  return '';
}

export async function verInvitacion(id: string): Promise<Respuesta<DetalleDeInvitacion>> {
  try {
    const r = await fetch(`/api/auth/organization/get-invitation?id=${encodeURIComponent(id)}`, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!r.ok) return rechazo(codigoDeEstado(r.status), await mensajeDe(r));
    const detalle = interpretarInvitacion(await r.json().catch(() => null), id);
    return detalle ? exito(detalle) : rechazo('no_encontrado', '');
  } catch {
    return rechazo('sin_conexion', SIN_CONEXION);
  }
}

async function enviar(ruta: string, cuerpo: unknown): Promise<Respuesta<null>> {
  try {
    const r = await fetch(`/api/auth${ruta}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    return r.ok ? exito(null) : rechazo(codigoDeEstado(r.status), await mensajeDe(r));
  } catch {
    return rechazo('sin_conexion', SIN_CONEXION);
  }
}

/** Acepta y deja la empresa activa (lo segundo es de mejor esfuerzo: la sesión ya queda unida a la empresa). */
export async function aceptarInvitacion(d: DetalleDeInvitacion): Promise<Respuesta<null>> {
  const r = await enviar('/organization/accept-invitation', { invitationId: d.id });
  if (r.ok && d.empresaId) await enviar('/organization/set-active', { organizationId: d.empresaId });
  return r;
}
