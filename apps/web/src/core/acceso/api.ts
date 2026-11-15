import { codigoDeEstado, empresaCreadaSchema, exito, rechazo, type EmpresaCreada, type Respuesta } from '@capaz/shared';
import { pedir } from '../../shared/api/cliente.ts';

// Better Auth NO responde con el contrato `Respuesta` (devuelve su propio JSON), así que sus tres
// rutas no pasan por `pedir`: `pedirAuth` hace el `fetch` y traduce el resultado al mismo contrato.
// Crear empresa sí usa `pedir`.

const SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

/** Convierte estado HTTP + cuerpo de Better Auth en `Respuesta`. Pura. */
export function interpretarAuth(estado: number, texto: string): Respuesta<null> {
  if (estado >= 200 && estado < 300) return exito(null);
  let mensaje = 'No se pudo completar la acción.';
  try {
    const m = (JSON.parse(texto) as { message?: unknown }).message;
    if (typeof m === 'string' && m) mensaje = m;
  } catch {
    // cuerpo que no es JSON: se queda el texto general
  }
  return rechazo(codigoDeEstado(estado), mensaje);
}

async function pedirAuth(ruta: string, cuerpo: unknown): Promise<Respuesta<null>> {
  try {
    const r = await fetch(`/api/auth${ruta}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    return interpretarAuth(r.status, await r.text());
  } catch {
    return rechazo('sin_conexion', SIN_CONEXION);
  }
}

export const registrarse = (d: { nombre: string; correo: string; clave: string }) =>
  pedirAuth('/sign-up/email', { name: d.nombre.trim(), email: d.correo.trim(), password: d.clave });

export const iniciarSesion = (d: { correo: string; clave: string }) =>
  pedirAuth('/sign-in/email', { email: d.correo.trim(), password: d.clave });

/** La usará la carcasa (W4). Tras el éxito, quien llama recarga la página para soltar la sesión en memoria. */
export const cerrarSesion = () => pedirAuth('/sign-out', {});

export const crearEmpresa = (nombre: string): Promise<Respuesta<EmpresaCreada>> =>
  pedir('POST', '/api/v1/empresas', empresaCreadaSchema, { nombre: nombre.trim() });
