// Cursor opaco de los listados por instante (R11): `(creado_en, id)` en base64url. El instante viaja como
// texto de PostgreSQL para no perder microsegundos.

const FORMA = /^(.+)\|([0-9a-f-]{36})$/;

export const codificarCursor = (instante: string, id: string): string => Buffer.from(`${instante}|${id}`).toString('base64url');

/** Nulo si el cursor no tiene la forma esperada o el instante no es una fecha. */
export function decodificarCursor(cursor: string): { instante: string; id: string } | null {
  const m = FORMA.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}
