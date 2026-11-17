import type { Request } from 'express';

// Lectura del formulario `application/x-www-form-urlencoded` del enlace público. El servidor solo registra el analizador
// de JSON, así que el cuerpo del formulario se lee aquí, con tope de tamaño.

export const TOPE_DE_FORMULARIO_BYTES = 8 * 1024;
export const LARGO_MAXIMO_DE_NOTA = 300;

export type Formulario = { posiciones: number[]; nota: string | null };

async function leerCuerpo(req: Request): Promise<string | null> {
  const tipo = String(req.headers['content-type'] ?? '').toLowerCase();
  if (!tipo.startsWith('application/x-www-form-urlencoded')) return null;
  const partes: Buffer[] = [];
  let total = 0;
  for await (const trozo of req as AsyncIterable<Buffer | string>) {
    const b = typeof trozo === 'string' ? Buffer.from(trozo) : trozo;
    total += b.length;
    if (total > TOPE_DE_FORMULARIO_BYTES) return null;
    partes.push(b);
  }
  return Buffer.concat(partes).toString('utf8');
}

const esControl = (c: string): boolean => {
  const n = c.charCodeAt(0);
  return (n < 32 && n !== 9 && n !== 10 && n !== 13) || n === 127;
};

/** Una nota sin caracteres de control, recortada; vacía → `null`. */
export function limpiarNota(v: string | null | undefined): string | null {
  const t = (v ?? '').split('').filter((c) => !esControl(c)).join('').replace(/\r\n?/g, '\n').trim().slice(0, LARGO_MAXIMO_DE_NOTA).trim();
  return t === '' ? null : t;
}

/** Las posiciones marcadas (enteros pequeños, sin repetir) y la nota. Un cuerpo ilegible da un formulario vacío. */
export async function leerFormulario(req: Request): Promise<Formulario> {
  const texto = await leerCuerpo(req);
  if (texto === null) return { posiciones: [], nota: null };
  const p = new URLSearchParams(texto);
  const posiciones = [...new Set(p.getAll('posicion').filter((x) => /^\d{1,3}$/.test(x)).map(Number))];
  return { posiciones, nota: limpiarNota(p.get('nota')) };
}
