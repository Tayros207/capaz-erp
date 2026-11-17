// Cursor opaco del listado de listas: por (nombre normalizado, id) ascendente. Puro.
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type CursorDeLista = { nombreNormalizado: string; id: string };

export const codificarCursorDeLista = (c: CursorDeLista): string => Buffer.from(`${c.nombreNormalizado}|${c.id}`).toString('base64url');

export function decodificarCursorDeLista(cursor: string): CursorDeLista | null {
  const texto = Buffer.from(cursor, 'base64url').toString('utf8');
  const corte = texto.lastIndexOf('|');
  if (corte < 0) return null;
  const id = texto.slice(corte + 1);
  return ID.test(id) ? { nombreNormalizado: texto.slice(0, corte), id } : null;
}
