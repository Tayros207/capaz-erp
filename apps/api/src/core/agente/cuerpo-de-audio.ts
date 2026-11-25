import type { IncomingMessage } from 'node:http';

// El cuerpo grande del dictado por audio. El resto del servidor sigue con su límite de 256 kB: solo ESTA ruta, y solo con JSON,
// admite unos 3 MB (el WAV en base64). Lo usa `configurar-app.ts` como `type` del analizador JSON.

export const RUTA_DE_TRANSCRIPCION = '/api/v1/agente/transcribir';
/** Holgura sobre `MAXIMO_DE_AUDIO_BASE64` (3 MB) para el resto del JSON. Por debajo de los 4,5 MB que admite Vercel por petición. */
export const LIMITE_DEL_CUERPO_DE_AUDIO = '3200kb';

export function esCuerpoDeAudio(req: IncomingMessage): boolean {
  const ruta = (req.url ?? '').split('?')[0];
  return req.method === 'POST' && ruta === RUTA_DE_TRANSCRIPCION && /^application\/json\b/i.test(req.headers['content-type'] ?? '');
}
