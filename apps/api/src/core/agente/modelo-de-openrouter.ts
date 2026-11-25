import { AcumuladorDeRonda } from './acumulador-de-ronda.js';
import { leerSse } from './leer-sse.js';
import { ErrorDeModelo, type ModeloDeChat, type PeticionDeModelo, type TrozoDeModelo } from './modelo-de-chat.js';

// Habla con OpenRouter por `fetch`, sin dependencias (regla 15). La llave entra por el constructor, que la recibe de `infra/config`:
// aquí no se lee `process.env` (regla 2) y la llave nunca se escribe en un registro ni en un error.

const URL_DE_CHAT = 'https://openrouter.ai/api/v1/chat/completions';
/** Hasta tener las cabeceras de la respuesta (conexión y enrutamiento del proveedor). */
export const MS_PARA_CONECTAR = 30_000;
/** Silencio máximo entre dos trozos del flujo. Reinicia con cada trozo, así un turno largo y sano no tiene techo. */
export const MS_DE_SILENCIO = 60_000;
const MAXIMO_DE_SALIDA_POR_RONDA = 2000;

export type OpcionesDeOpenRouter = {
  apiKey: string;
  razonamiento: 'none' | 'low' | 'high';
  /** Se inyecta para que las pruebas no salgan a la red. */
  fetch?: typeof fetch;
};

/**
 * El esfuerzo de razonamiento que de verdad se pide. DeepSeek se usa con el razonamiento apagado (lo seguro con herramientas), pero los
 * modelos de Anthropic lo exigen («Reasoning is mandatory…», 400): con ellos «ninguno» se vuelve «bajo».
 */
export function esfuerzoDeRazonamiento(modelo: string, configurado: 'none' | 'low' | 'high'): 'none' | 'low' | 'high' {
  return configurado === 'none' && modelo.startsWith('anthropic/') ? 'low' : configurado;
}

/** Qué le decimos a la persona según el código HTTP del proveedor. Nunca incluye el cuerpo de la respuesta. */
function falloPorEstado(estado: number): ErrorDeModelo {
  if (estado === 408 || estado === 504) return new ErrorDeModelo('tiempo_agotado', 'El modelo tardó demasiado en responder.');
  if (estado === 402) return new ErrorDeModelo('modelo_no_disponible', 'El proveedor del modelo no tiene saldo disponible.');
  if (estado === 404 || estado === 429 || estado === 502 || estado === 503) {
    return new ErrorDeModelo('modelo_no_disponible', 'El modelo no está disponible ahora mismo. Inténtalo en unos minutos.');
  }
  return new ErrorDeModelo('interno', 'No se pudo hablar con el modelo.');
}

export class ModeloDeOpenRouter implements ModeloDeChat {
  private readonly llamar: typeof fetch;

  constructor(private readonly opciones: OpcionesDeOpenRouter) {
    this.llamar = opciones.fetch ?? fetch;
  }

  /** El cuerpo de la petición. Sin marcas de caché (DeepSeek cachea el prefijo solo) y sin `tool_choice: required` (no todos lo admiten). */
  private cuerpo(p: PeticionDeModelo): string {
    const conHerramientas = p.herramientas.length > 0;
    return JSON.stringify({
      model: p.modelo,
      messages: p.mensajes,
      ...(conHerramientas ? { tools: p.herramientas, tool_choice: 'auto' } : {}),
      stream: true,
      max_tokens: MAXIMO_DE_SALIDA_POR_RONDA,
      reasoning: { effort: esfuerzoDeRazonamiento(p.modelo, this.opciones.razonamiento) },
      // Solo proveedores que no guardan los datos. Si ninguno cumple, el proveedor responde con error y el turno lo dice.
      provider: { data_collection: 'deny', zdr: true, require_parameters: true },
    });
  }

  async *conversar(p: PeticionDeModelo): AsyncIterable<TrozoDeModelo> {
    const interno = new AbortController();
    const senal = AbortSignal.any([p.senal, interno.signal]);
    let agotado = false;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const armar = (ms: number) => {
      clearTimeout(reloj);
      reloj = setTimeout(() => {
        agotado = true;
        interno.abort();
      }, ms);
    };
    try {
      armar(MS_PARA_CONECTAR);
      const respuesta = await this.llamar(URL_DE_CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.opciones.apiKey}`, 'X-Title': 'Capaz ERP' },
        body: this.cuerpo(p),
        signal: senal,
      });
      if (!respuesta.ok || !respuesta.body) throw falloPorEstado(respuesta.status);
      yield* this.leerRonda(respuesta.body, armar);
    } catch (e) {
      if (e instanceof ErrorDeModelo) throw e;
      if (agotado) throw new ErrorDeModelo('tiempo_agotado', 'El modelo dejó de responder.');
      if (p.senal.aborted) throw new ErrorDeModelo('cancelado', 'El turno se canceló.');
      throw new ErrorDeModelo('interno', 'No se pudo hablar con el modelo.');
    } finally {
      clearTimeout(reloj);
    }
  }

  private async *leerRonda(cuerpo: ReadableStream<Uint8Array>, armar: (ms: number) => void): AsyncIterable<TrozoDeModelo> {
    const ronda = new AcumuladorDeRonda();
    armar(MS_DE_SILENCIO);
    // El reloj de silencio se rearma con cada trozo de bytes, incluidos los comentarios de «sigo vivo» del proveedor.
    for await (const datos of leerSse(cuerpo, () => armar(MS_DE_SILENCIO))) {
      if (datos === '[DONE]') break;
      let objeto: unknown;
      try {
        objeto = JSON.parse(datos);
      } catch {
        continue;
      }
      const delta = ronda.aplicar(objeto);
      if (delta !== null) yield { tipo: 'texto', delta };
    }
    yield ronda.fin();
  }
}
