// El que convierte audio en texto, detrás de una interfaz: el servicio no sabe si habla con OpenRouter o con un guion de prueba.
// Nunca lanza: todo fallo vuelve como resultado, sin el audio, sin la respuesta del proveedor y sin la llave.

/** Lo que gastó una transcripción. El costo ya viene en millonésimas de dólar (entero, redondeado una sola vez). */
export type UsoDeTranscripcion = { tokensEntrada: number; tokensSalida: number; costoMicrousd: number };

export type MotivoDeFalloDeTranscripcion = 'modelo_no_disponible' | 'tiempo_agotado' | 'interno';

export type ResultadoDeTranscripcion =
  | { ok: true; texto: string; uso: UsoDeTranscripcion | null }
  /** `estado` es el código HTTP del proveedor, solo para el registro del servidor. */
  | { ok: false; motivo: MotivoDeFalloDeTranscripcion; uso: UsoDeTranscripcion | null; estado?: number };

export interface TranscriptorDeVoz {
  /** Para anotar el uso en `core.uso`. */
  readonly modelo: string;
  /** `audioBase64` es un WAV PCM ya validado. */
  transcribir(audioBase64: string): Promise<ResultadoDeTranscripcion>;
}

export const TRANSCRIPTOR_DE_VOZ = Symbol('TRANSCRIPTOR_DE_VOZ');

/**
 * Para las pruebas (proveedor `simulado`, que no existe en producción): devuelve lo programado, en orden, y recuerda cuántos audios
 * recibió. Sin nada programado responde vacío, como un audio sin voz.
 */
export class TranscriptorSimulado implements TranscriptorDeVoz {
  readonly modelo = 'simulado/voz';
  private cola: ResultadoDeTranscripcion[] = [];
  recibidos = 0;

  programar(resultados: ResultadoDeTranscripcion[]): void {
    this.cola = [...resultados];
  }

  async transcribir(): Promise<ResultadoDeTranscripcion> {
    this.recibidos++;
    return this.cola.shift() ?? { ok: true, texto: '', uso: null };
  }
}
