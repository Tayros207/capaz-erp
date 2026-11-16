// Cursores opacos de los listados del módulo. Puros.
// Artículos y existencias: por (nombre normalizado, id) ascendente. Movimientos: por (instante, id) descendente;
// el instante viaja como el texto de PostgreSQL para no perder microsegundos (modelo: core/borradores/repositorio.ts).

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const codificar = (a: string, id: string): string => Buffer.from(JSON.stringify([a, id])).toString('base64url');

function partes(cursor: string): [string, string] | null {
  try {
    const v: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [a, id] = v as unknown[];
    return typeof a === 'string' && typeof id === 'string' && ID.test(id) ? [a, id] : null;
  } catch {
    return null;
  }
}

export type CursorPorNombre = { nombre: string; id: string };
export const codificarCursorPorNombre = (c: CursorPorNombre): string => codificar(c.nombre, c.id);
export function decodificarCursorPorNombre(cursor: string): CursorPorNombre | null {
  const p = partes(cursor);
  return p ? { nombre: p[0], id: p[1] } : null;
}

export type CursorPorInstante = { instante: string; id: string };
export const codificarCursorPorInstante = (c: CursorPorInstante): string => codificar(c.instante, c.id);
export function decodificarCursorPorInstante(cursor: string): CursorPorInstante | null {
  const p = partes(cursor);
  return p && !Number.isNaN(Date.parse(p[0])) ? { instante: p[0], id: p[1] } : null;
}
