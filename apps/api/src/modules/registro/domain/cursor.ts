// Cursores opacos de los listados del módulo. Puros.
// Movimientos: por (fecha, id) descendente. Deudas: por (instante de creación, id) descendente; el instante viaja
// como texto de PostgreSQL para no perder microsegundos.

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

const codificar = (a: string, id: string): string => Buffer.from(`${a}|${id}`).toString('base64url');

function partes(cursor: string): [string, string] | null {
  const texto = Buffer.from(cursor, 'base64url').toString('utf8');
  const corte = texto.lastIndexOf('|');
  if (corte <= 0) return null;
  const id = texto.slice(corte + 1);
  return ID.test(id) ? [texto.slice(0, corte), id] : null;
}

export type CursorPorFecha = { fecha: string; id: string };
export const codificarCursorPorFecha = (c: CursorPorFecha): string => codificar(c.fecha, c.id);
export function decodificarCursorPorFecha(cursor: string): CursorPorFecha | null {
  const p = partes(cursor);
  return p && DIA.test(p[0]) && !Number.isNaN(Date.parse(p[0])) ? { fecha: p[0], id: p[1] } : null;
}

export type CursorPorInstante = { instante: string; id: string };
export const codificarCursorPorInstante = (c: CursorPorInstante): string => codificar(c.instante, c.id);
export function decodificarCursorPorInstante(cursor: string): CursorPorInstante | null {
  const p = partes(cursor);
  return p && !Number.isNaN(Date.parse(p[0])) ? { instante: p[0], id: p[1] } : null;
}
