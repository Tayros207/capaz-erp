// Lógica pura de las listas: orden, selección y lotes por cursor. Sin React.

export type Direccion = 'asc' | 'desc';
export type Orden = { columna: string; direccion: Direccion } | null;
export type Comparable = string | number | null | undefined;

/** Un clic cambia el orden de la columna: ninguno, ascendente, descendente, ninguno. */
export function alternarOrden(actual: Orden, columna: string): Orden {
  if (!actual || actual.columna !== columna) return { columna, direccion: 'asc' };
  return actual.direccion === 'asc' ? { columna, direccion: 'desc' } : null;
}

/** Valor del atributo `aria-sort` de la cabecera de una columna. */
export function ariaSort(orden: Orden, columna: string): 'ascending' | 'descending' | 'none' {
  if (!orden || orden.columna !== columna) return 'none';
  return orden.direccion === 'asc' ? 'ascending' : 'descending';
}

const COLACION = new Intl.Collator('es-PE', { numeric: true, sensitivity: 'base' });

function comparar(a: Comparable, b: Comparable): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return COLACION.compare(String(a), String(b));
}

/** Copia ordenada y estable. Los valores vacíos van siempre al final, sea cual sea la dirección. */
export function ordenarFilas<T>(filas: readonly T[], valor: (fila: T) => Comparable, direccion: Direccion): T[] {
  const signo = direccion === 'asc' ? 1 : -1;
  return filas
    .map((fila, indice) => ({ fila, indice, v: valor(fila) }))
    .sort((x, y) => {
      const xVacio = x.v === null || x.v === undefined;
      const yVacio = y.v === null || y.v === undefined;
      if (xVacio || yVacio) return xVacio === yVacio ? x.indice - y.indice : xVacio ? 1 : -1;
      return signo * comparar(x.v, y.v) || x.indice - y.indice;
    })
    .map((x) => x.fila);
}

export type EstadoDeSeleccion = 'ninguna' | 'algunas' | 'todas';

export function estadoDeSeleccion(seleccion: ReadonlySet<string>, ids: readonly string[]): EstadoDeSeleccion {
  const marcadas = ids.filter((id) => seleccion.has(id)).length;
  if (marcadas === 0) return 'ninguna';
  return marcadas === ids.length ? 'todas' : 'algunas';
}

export function alternarSeleccion(seleccion: ReadonlySet<string>, id: string): Set<string> {
  const nueva = new Set(seleccion);
  if (!nueva.delete(id)) nueva.add(id);
  return nueva;
}

/** Marca todas las visibles; si ya estaban todas, las desmarca. Respeta lo marcado fuera de `ids`. */
export function alternarTodas(seleccion: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const nueva = new Set(seleccion);
  const quitar = estadoDeSeleccion(seleccion, ids) === 'todas';
  for (const id of ids) {
    if (quitar) nueva.delete(id);
    else nueva.add(id);
  }
  return nueva;
}

export type Lote<T> = { items: T[]; siguiente: string | null };

/** Lote por cursor, con la misma forma que una respuesta de listado: `{ items, siguiente }`. */
export function loteDesde<T>(filas: readonly T[], cursor: string | null, tamano: number): Lote<T> {
  const inicio = cursor === null ? 0 : Math.max(0, Number.parseInt(cursor, 10) || 0);
  const fin = inicio + tamano;
  return { items: filas.slice(inicio, fin), siguiente: fin < filas.length ? String(fin) : null };
}
