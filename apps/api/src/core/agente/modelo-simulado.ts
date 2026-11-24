import type { ModeloDeChat, PeticionDeModelo, TrozoDeModelo } from './modelo-de-chat.js';

/**
 * Un modelo de mentira con guion fijo: es el que usan TODAS las pruebas y el único que se acepta fuera de producción sin llave.
 * Cada llamada a `conversar` consume la siguiente ronda programada. Guarda lo que recibió para que la prueba lo revise.
 */
export class ModeloSimulado implements ModeloDeChat {
  private rondas: TrozoDeModelo[][] = [];
  /** Cada petición recibida, en orden. */
  readonly peticiones: PeticionDeModelo[] = [];
  private fallo: Error | null = null;

  /** Reemplaza el guion. Cada elemento es una ronda: sus trozos de texto y el `fin`. */
  programar(rondas: TrozoDeModelo[][]): this {
    this.rondas = [...rondas];
    this.peticiones.length = 0;
    this.fallo = null;
    return this;
  }

  /** La siguiente ronda lanza este error en lugar de responder. */
  programarFallo(error: Error): this {
    this.fallo = error;
    return this;
  }

  async *conversar(p: PeticionDeModelo): AsyncIterable<TrozoDeModelo> {
    this.peticiones.push({ ...p, mensajes: [...p.mensajes] });
    if (this.fallo) {
      const e = this.fallo;
      this.fallo = null;
      throw e;
    }
    const ronda = this.rondas.shift() ?? [
      { tipo: 'texto', delta: 'No tengo nada programado para responder.' },
      { tipo: 'fin', motivo: 'stop', llamadas: [], razonamiento: null, uso: null },
    ];
    for (const trozo of ronda) {
      if (p.senal.aborted) return;
      yield trozo;
    }
  }
}

/** Atajos para armar guiones legibles en las pruebas. */
export const guion = {
  texto: (delta: string): TrozoDeModelo => ({ tipo: 'texto', delta }),
  fin: (uso: { entrada?: number; salida?: number; cache?: number; costoMicrousd?: number } | null = { entrada: 100, salida: 20, cache: 0, costoMicrousd: 50 }): TrozoDeModelo => ({
    tipo: 'fin',
    motivo: 'stop',
    llamadas: [],
    razonamiento: null,
    uso: uso && { entrada: uso.entrada ?? 0, salida: uso.salida ?? 0, cache: uso.cache ?? 0, costoMicrousd: uso.costoMicrousd ?? 0 },
  }),
  llamar: (id: string, nombre: string, args: unknown, argumentosCrudos?: string): TrozoDeModelo => ({
    tipo: 'fin',
    motivo: 'tool_calls',
    llamadas: [{ id, type: 'function', function: { name: nombre, arguments: argumentosCrudos ?? JSON.stringify(args) } }],
    razonamiento: null,
    uso: { entrada: 100, salida: 20, cache: 0, costoMicrousd: 50 },
  }),
  /** Varias llamadas en UNA misma ronda (el modelo las pide juntas). `llamar` solo lleva una: dos `llamar` en la misma ronda se pisan. */
  llamarVarias: (llamadas: readonly { id: string; nombre: string; args: unknown }[]): TrozoDeModelo => ({
    tipo: 'fin',
    motivo: 'tool_calls',
    llamadas: llamadas.map((l) => ({ id: l.id, type: 'function' as const, function: { name: l.nombre, arguments: JSON.stringify(l.args) } })),
    razonamiento: null,
    uso: { entrada: 100, salida: 20, cache: 0, costoMicrousd: 50 },
  }),
  /** Una ronda que responde solo texto y termina. */
  respuesta: (texto: string): TrozoDeModelo[] => [{ tipo: 'texto', delta: texto }, guion.fin()],
} as const;
