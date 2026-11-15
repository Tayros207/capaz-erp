import { codigoDeEstado, rechazo, respuestaSchema, type Respuesta } from '@capaz/shared';

/** Cualquier esquema de Zod para el campo `datos` de la respuesta (la web no importa Zod directamente). */
export type EsquemaDeDatos = Parameters<typeof respuestaSchema>[0];

const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
const MENSAJE_FORMA = 'La respuesta del servidor no tiene la forma esperada.';

/**
 * Convierte el estado HTTP y el texto recibido en una `Respuesta`. Pura: no toca la red.
 * Un cuerpo que no es el contrato (página de error, texto) se traduce según el estado HTTP.
 */
export function interpretarRespuesta<S extends EsquemaDeDatos>(
  estado: number,
  texto: string,
  esquema: S,
): Respuesta<S['_output']> {
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  const analizada = respuestaSchema(esquema).safeParse(json);
  if (analizada.success) return analizada.data as Respuesta<S['_output']>;
  const ok = estado >= 200 && estado < 300;
  return rechazo(ok ? 'error_interno' : codigoDeEstado(estado), ok ? MENSAJE_FORMA : mensajeDeEstado(estado));
}

function mensajeDeEstado(estado: number): string {
  if (estado === 401) return 'Tu sesión terminó. Inicia sesión de nuevo.';
  if (estado === 403) return 'No tienes permiso para hacer esto.';
  if (estado === 404) return 'No se encontró lo que buscabas.';
  if (estado === 429) return 'Demasiados intentos. Espera un momento.';
  return 'Ocurrió un error en el servidor. Inténtalo de nuevo.';
}

/** Llamada a la API con el contrato `Respuesta`. Nunca lanza: una caída de red es el rechazo `sin_conexion`. */
export async function pedir<S extends EsquemaDeDatos>(
  metodo: 'GET' | 'POST',
  ruta: string,
  esquema: S,
  cuerpo?: unknown,
): Promise<Respuesta<S['_output']>> {
  try {
    const respuesta = await fetch(ruta, {
      method: metodo,
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return interpretarRespuesta(respuesta.status, await respuesta.text(), esquema);
  } catch {
    return rechazo('sin_conexion', MENSAJE_SIN_CONEXION);
  }
}
