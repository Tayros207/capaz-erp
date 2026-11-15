import { rechazo, respuestaSchema, type Respuesta } from '@capaz/shared';
import { interpretarRespuesta } from '../cliente.ts';

const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

type Enviar = typeof fetch;

/**
 * Un POST a `/api/v1/herramientas/:nombre` con el cuerpo `{args, confirmacion}` y la clave de
 * idempotencia. Nunca lanza: una caída de red es el rechazo `sin_conexion`. El estado HTTP lo
 * traduce `interpretarRespuesta`; el origen lo pone el navegador (misma ruta del sitio).
 */
export async function enviarHerramienta(
  nombre: string,
  args: unknown,
  confirmacion: string | undefined,
  clave: string,
  esquemaDeSalida: Parameters<typeof respuestaSchema>[0],
  enviar: Enviar = fetch,
): Promise<Respuesta<unknown>> {
  try {
    const respuesta = await enviar(`/api/v1/herramientas/${encodeURIComponent(nombre)}`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'idempotency-key': clave },
      body: JSON.stringify({ ...(args === undefined ? {} : { args }), ...(confirmacion === undefined ? {} : { confirmacion }) }),
    });
    return interpretarRespuesta(respuesta.status, await respuesta.text(), esquemaDeSalida);
  } catch {
    return rechazo('sin_conexion', MENSAJE_SIN_CONEXION);
  }
}
