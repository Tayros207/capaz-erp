import { useRouteLoaderData } from 'react-router';
import type { Yo } from '@capaz/shared';
import { ID_RUTA_RAIZ } from './sesion.ts';

/** `yo` de la sesión actual (lo carga la ruta raíz), o nulo si no hay sesión. */
export function useYo(): Yo | null {
  return (useRouteLoaderData(ID_RUTA_RAIZ) as Yo | null | undefined) ?? null;
}
