// Cursores opacos de los listados del módulo. Puros.
// Colaboradores: por (nombre normalizado, id) ascendente. Adelantos y asistencias: por (fecha, id) descendente.

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

export type CursorPorNombre = { nombre: string; id: string };
export const codificarCursorPorNombre = (c: CursorPorNombre): string => codificar(c.nombre, c.id);
export function decodificarCursorPorNombre(cursor: string): CursorPorNombre | null {
  const p = partes(cursor);
  return p ? { nombre: p[0], id: p[1] } : null;
}

export type CursorPorFecha = { fecha: string; id: string };
export const codificarCursorPorFecha = (c: CursorPorFecha): string => codificar(c.fecha, c.id);
export function decodificarCursorPorFecha(cursor: string): CursorPorFecha | null {
  const p = partes(cursor);
  return p && DIA.test(p[0]) && !Number.isNaN(Date.parse(p[0])) ? { fecha: p[0], id: p[1] } : null;
}
