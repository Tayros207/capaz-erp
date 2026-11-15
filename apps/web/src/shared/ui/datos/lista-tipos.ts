import type { ReactNode } from 'react';
import { ordenarFilas, type Comparable, type Orden } from './logica-lista.ts';

export type Columna<T> = {
  id: string;
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Con este valor la columna se puede ordenar. */
  valorDeOrden?: (fila: T) => Comparable;
  alinear?: 'izquierda' | 'derecha';
  /** Identifica la fila: cabecera de fila en la tabla y título de la tarjeta. Una sola por lista. */
  principal?: boolean;
};

export type PropsDeLista<T> = {
  columnas: Array<Columna<T>>;
  filas: readonly T[];
  clave: (fila: T) => string;
  /** Nombre de la lista para lectores de pantalla. */
  etiqueta: string;
  orden?: Orden;
  onOrden?: (orden: Orden) => void;
  seleccion?: ReadonlySet<string>;
  onSeleccion?: (seleccion: Set<string>) => void;
  onAbrir?: (fila: T) => void;
  /** Se muestra cuando no hay filas. */
  vacio?: ReactNode;
};

/** Ordena las filas según la columna activa; sin orden, las deja como llegan. */
export function ordenarSegunColumna<T>(filas: readonly T[], columnas: ReadonlyArray<Columna<T>>, orden: Orden): readonly T[] {
  const valor = orden && columnas.find((c) => c.id === orden.columna)?.valorDeOrden;
  return orden && valor ? ordenarFilas(filas, valor, orden.direccion) : filas;
}
