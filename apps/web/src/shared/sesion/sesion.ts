import { yoSchema, type Respuesta, type Yo } from '@capaz/shared';
import { pedir } from '../api/cliente.ts';

/** Identificador de la ruta raíz, cuyo cargador trae `yo` (lo lee `useYo`). */
export const ID_RUTA_RAIZ = 'raiz';

export function cargarYo(): Promise<Respuesta<Yo>> {
  return pedir('GET', '/api/v1/yo', yoSchema);
}

export function puede(yo: Yo, permiso: string): boolean {
  return yo.permisos.includes(permiso);
}
