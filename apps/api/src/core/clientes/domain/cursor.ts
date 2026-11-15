// Cursor opaco de listados ordenados por (nombre normalizado, id). Puro.

export type PosicionDeCursor = { nombre: string; id: string };

export const codificarCursor = (p: PosicionDeCursor): string => Buffer.from(JSON.stringify([p.nombre, p.id])).toString('base64url');

/** Devuelve `null` si el cursor no es de este formato. */
export function decodificarCursor(cursor: string): PosicionDeCursor | null {
  try {
    const v: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string' && /^[0-9a-f-]{36}$/.test(v[1])) return { nombre: v[0], id: v[1] };
    return null;
  } catch {
    return null;
  }
}
