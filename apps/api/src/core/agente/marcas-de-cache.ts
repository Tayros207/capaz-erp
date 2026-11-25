import type { MensajeDeModelo } from './modelo-de-chat.js';

// Caché de prompt de los modelos de Anthropic: se marcan dos puntos y lo anterior se cobra mucho más barato cuando se repite.
//   1. El bloque fijo del prompt (con las herramientas, que van antes): igual durante horas y entre turnos.
//   2. El último mensaje de CADA ronda: la ronda siguiente de un turno con herramientas reenvía todo lo anterior.
// DeepSeek y otros cachean el prefijo solos, sin marcas. Función pura: no cambia lo que recibe.

const MARCA = { type: 'ephemeral' } as const;

type Parte = { type: 'text'; text: string; cache_control: typeof MARCA };
type MensajeConMarca = Omit<MensajeDeModelo, 'content'> & { content: string | null | Parte[] };

const conMarca = (m: MensajeDeModelo): MensajeConMarca =>
  typeof m.content === 'string' && m.content !== '' ? { ...m, content: [{ type: 'text', text: m.content, cache_control: MARCA }] } : m;

/** Los mensajes listos para el proveedor. Solo los modelos `anthropic/…` llevan marcas. */
export function conMarcasDeCache(modelo: string, mensajes: readonly MensajeDeModelo[]): readonly (MensajeDeModelo | MensajeConMarca)[] {
  if (!modelo.startsWith('anthropic/') || mensajes.length === 0) return mensajes;
  const primero = mensajes.findIndex((m) => m.role === 'system');
  const ultimo = mensajes.length - 1;
  return mensajes.map((m, i) => (i === primero || i === ultimo ? conMarca(m) : m));
}
