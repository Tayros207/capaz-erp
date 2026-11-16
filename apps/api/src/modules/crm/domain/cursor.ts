// Cursor opaco por instante (orden `(instante, id)` descendente). El instante viaja como el texto que
// devuelve PostgreSQL para no perder microsegundos (modelo: core/borradores/repositorio.ts).

const FORMA = /^(.+)\|([0-9a-f-]{36})$/;

export type PosicionPorInstante = { instante: string; id: string };

export const codificarCursor = (p: PosicionPorInstante): string => Buffer.from(`${p.instante}|${p.id}`).toString('base64url');

/** `null` si no es un cursor de este formato. */
export function decodificarCursor(cursor: string): PosicionPorInstante | null {
  const m = FORMA.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}
