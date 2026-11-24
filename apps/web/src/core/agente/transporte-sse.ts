import { codigoDeEstado, eventoDelAgenteSchema, type EventoDelAgente, type TurnoParaEnviar } from '@capaz/shared';

// El transporte del turno: un POST cuya respuesta es un flujo de eventos (`text/event-stream`). Se lee con `fetch` y un lector del
// cuerpo, porque `EventSource` no sabe hacer POST. Nunca lanza: lo que falle se traduce en un evento de error o en `'cortado'`.

export type ResultadoDelTransporte = 'fin' | 'error' | 'cortado';
export type BloqueSse = { nombre: string | null; datos: string };

const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Tu mensaje sigue aquí; inténtalo de nuevo.';

/**
 * Separa un texto SSE en bloques completos (terminan en una línea en blanco) y devuelve lo que quedó sin terminar. Los comentarios
 * (`: latido`) se saltan; varias líneas `data:` de un mismo bloque se unen con salto de línea.
 */
export function analizarBloques(texto: string): { bloques: BloqueSse[]; resto: string } {
  const normal = texto.replace(/\r\n/g, '\n');
  const partes = normal.split('\n\n');
  const resto = partes.pop() ?? '';
  const bloques: BloqueSse[] = [];
  for (const parte of partes) {
    let nombre: string | null = null;
    const datos: string[] = [];
    for (const linea of parte.split('\n')) {
      if (linea.startsWith(':')) continue;
      if (linea.startsWith('event:')) nombre = linea.slice(6).trim();
      else if (linea.startsWith('data:')) datos.push(linea.slice(5).replace(/^ /, ''));
    }
    if (datos.length > 0) bloques.push({ nombre, datos: datos.join('\n') });
  }
  return { bloques, resto };
}

/** Un bloque que no es JSON o no cumple el contrato de eventos se ignora: un evento raro no debe romper el turno. */
export function eventoDeBloque(b: BloqueSse): EventoDelAgente | null {
  try {
    const r = eventoDelAgenteSchema.safeParse(JSON.parse(b.datos));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

const eventoDeError = (mensaje: string): EventoDelAgente => ({ type: 'error', motivo: 'interno', mensaje });

/** Lo que dice la persona cuando el servidor respondió con un estado de error ANTES de empezar el flujo (cuerpo inválido, sin sesión…). */
function mensajeDeEstado(estado: number): string {
  const codigo = codigoDeEstado(estado);
  if (codigo === 'no_autenticado') return 'Tu sesión terminó. Inicia sesión de nuevo.';
  if (codigo === 'sin_permiso' || codigo === 'sin_empresa') return 'No tienes permiso para usar el asistente.';
  return 'No se pudo enviar el mensaje. Inténtalo de nuevo.';
}

/**
 * Envía un turno y entrega cada evento a medida que llega.
 *  - `'fin'`: llegó el evento `fin`.
 *  - `'error'`: llegó un evento `error` (o el servidor rechazó la petición antes de empezar).
 *  - `'cortado'`: el flujo se cerró sin `fin` ni `error` (la conexión cayó, el móvil pasó a segundo plano o se canceló). El turno
 *    puede haber terminado en el servidor: quien llama debe consultar la conversación antes de dar nada por perdido.
 */
export async function enviarTurno(
  cuerpo: TurnoParaEnviar,
  alEvento: (e: EventoDelAgente) => void,
  senal: AbortSignal,
  enviar: typeof fetch = fetch,
): Promise<ResultadoDelTransporte> {
  let respuesta: Response;
  try {
    respuesta = await enviar('/api/v1/agente/turno', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: senal,
    });
  } catch {
    if (senal.aborted) return 'cortado';
    alEvento(eventoDeError(MENSAJE_SIN_CONEXION));
    return 'error';
  }
  if (!respuesta.ok || !respuesta.body) {
    alEvento(eventoDeError(mensajeDeEstado(respuesta.status)));
    return 'error';
  }
  return leerFlujo(respuesta.body, alEvento);
}

async function leerFlujo(cuerpo: ReadableStream<Uint8Array>, alEvento: (e: EventoDelAgente) => void): Promise<ResultadoDelTransporte> {
  const lector = cuerpo.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  let terminal: ResultadoDelTransporte | null = null;
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      const { bloques, resto } = analizarBloques(pendiente + decodificador.decode(value, { stream: true }));
      pendiente = resto;
      for (const b of bloques) {
        const e = eventoDeBloque(b);
        if (!e) continue;
        alEvento(e);
        if (e.type === 'fin') terminal = 'fin';
        else if (e.type === 'error') terminal = 'error';
      }
    }
  } catch {
    // La conexión se cayó o se canceló a mitad de flujo.
  } finally {
    lector.releaseLock();
  }
  return terminal ?? 'cortado';
}
