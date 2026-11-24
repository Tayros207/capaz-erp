import type { LlamadaDeModelo, TrozoDeModelo, UsoDeRonda } from './modelo-de-chat.js';

// Junta los fragmentos que el proveedor manda en una ronda (texto, llamadas a herramientas por trozos, razonamiento y uso)
// y los convierte en el `fin` de esa ronda. Sin red: se prueba con trozos escritos a mano.

type Motivo = 'stop' | 'tool_calls' | 'length' | 'error';
type Objeto = Record<string, unknown>;

const esObjeto = (x: unknown): x is Objeto => x !== null && typeof x === 'object' && !Array.isArray(x);
const numero = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

/** `stop`, `tool_calls` y `length` se entienden; cualquier otro motivo (`content_filter`, `error`) se trata como fallo. */
function motivoDe(fin: unknown): Motivo | null {
  if (typeof fin !== 'string' || fin === '') return null;
  return fin === 'stop' || fin === 'tool_calls' || fin === 'length' ? fin : 'error';
}

/** `usage.cost` viene en dólares con decimales: se redondea UNA vez, aquí, a millonésimas enteras. */
function usoDe(u: Objeto): UsoDeRonda {
  const detalle = esObjeto(u.prompt_tokens_details) ? u.prompt_tokens_details : {};
  return {
    entrada: numero(u.prompt_tokens),
    salida: numero(u.completion_tokens),
    cache: numero(detalle.cached_tokens),
    costoMicrousd: Math.round(numero(u.cost) * 1_000_000),
  };
}

export class AcumuladorDeRonda {
  private readonly llamadas = new Map<number, { id: string; nombre: string; argumentos: string }>();
  private readonly razonamiento: unknown[] = [];
  private motivo: Motivo | null = null;
  private uso: UsoDeRonda | null = null;
  /** Mensaje del proveedor si la ronda falló a mitad de flujo (llega con HTTP 200). */
  error: string | null = null;

  /** Procesa un objeto del flujo. Devuelve el texto nuevo, si lo trae. */
  aplicar(trozo: unknown): string | null {
    if (!esObjeto(trozo)) return null;
    if (esObjeto(trozo.error)) {
      this.error = typeof trozo.error.message === 'string' ? trozo.error.message : 'El proveedor devolvió un error.';
      this.motivo = 'error';
      return null;
    }
    // El uso llega en el último trozo, a veces sin `choices`: se lee ANTES de mirar las opciones.
    if (esObjeto(trozo.usage)) this.uso = usoDe(trozo.usage);
    const opcion = Array.isArray(trozo.choices) && esObjeto(trozo.choices[0]) ? trozo.choices[0] : null;
    if (!opcion) return null;
    this.motivo = motivoDe(opcion.finish_reason) ?? this.motivo;
    return esObjeto(opcion.delta) ? this.aplicarDelta(opcion.delta) : null;
  }

  private aplicarDelta(delta: Objeto): string | null {
    if (Array.isArray(delta.tool_calls)) for (const l of delta.tool_calls) this.juntarLlamada(l);
    if (Array.isArray(delta.reasoning_details)) this.razonamiento.push(...delta.reasoning_details);
    return typeof delta.content === 'string' && delta.content.length > 0 ? delta.content : null;
  }

  /** Las llamadas llegan en pedazos con un `index`: nombre y argumentos se van pegando. */
  private juntarLlamada(l: unknown): void {
    if (!esObjeto(l)) return;
    const indice = typeof l.index === 'number' ? l.index : 0;
    const actual = this.llamadas.get(indice) ?? { id: `llamada_${indice}`, nombre: '', argumentos: '' };
    if (typeof l.id === 'string' && l.id) actual.id = l.id;
    if (esObjeto(l.function)) {
      if (typeof l.function.name === 'string') actual.nombre += l.function.name;
      if (typeof l.function.arguments === 'string') actual.argumentos += l.function.arguments;
    }
    this.llamadas.set(indice, actual);
  }

  /**
   * El cierre de la ronda. Un flujo que termina SIN `finish_reason` se cortó a medias (un intermediario cerró la conexión, o el
   * cuerpo vino vacío): se trata como error, no como una respuesta completa.
   */
  fin(): Extract<TrozoDeModelo, { tipo: 'fin' }> {
    const llamadas: LlamadaDeModelo[] = [...this.llamadas.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, l]) => ({ id: l.id, type: 'function', function: { name: l.nombre, arguments: l.argumentos || '{}' } }));
    const motivo = this.motivo ?? 'error';
    return { tipo: 'fin', motivo, llamadas, razonamiento: this.razonamiento.length > 0 ? this.razonamiento : null, uso: this.uso };
  }
}
