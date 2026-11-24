// El modelo de lenguaje del asistente, detrás de una interfaz: el bucle no sabe si habla con OpenRouter o con un guion de prueba.
// Es el formato de «chat con herramientas» (el mismo que usa OpenRouter), reducido a lo que el bucle necesita.

export type LlamadaDeModelo = { id: string; type: 'function'; function: { name: string; arguments: string } };

export type MensajeDeModelo =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LlamadaDeModelo[]; reasoning_details?: unknown }
  | { role: 'tool'; tool_call_id: string; content: string };

/** Lo que gastó una ronda. El costo ya viene en millonésimas de dólar (entero). */
export type UsoDeRonda = { entrada: number; salida: number; cache: number; costoMicrousd: number };

export type TrozoDeModelo =
  | { tipo: 'texto'; delta: string }
  | { tipo: 'fin'; motivo: 'stop' | 'tool_calls' | 'length' | 'error'; llamadas: LlamadaDeModelo[]; razonamiento: unknown; uso: UsoDeRonda | null };

export type PeticionDeModelo = {
  modelo: string;
  mensajes: MensajeDeModelo[];
  herramientas: unknown[];
  /** Se aborta cuando la persona corta el turno o se agota el tiempo. */
  senal: AbortSignal;
  /** Para agrupar las rondas de una misma conversación en el proveedor. */
  sesion: string;
};

export interface ModeloDeChat {
  conversar(p: PeticionDeModelo): AsyncIterable<TrozoDeModelo>;
}

export const MODELO_DE_CHAT = Symbol('MODELO_DE_CHAT');

/** Por qué no se pudo hablar con el modelo. Los mensajes están en español y se pueden mostrar. */
export type MotivoDeFalloDeModelo = 'modelo_no_disponible' | 'tiempo_agotado' | 'interno' | 'cancelado';

export class ErrorDeModelo extends Error {
  constructor(
    readonly motivo: MotivoDeFalloDeModelo,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeModelo';
  }
}
