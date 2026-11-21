import type { ReactNode } from 'react';

/**
 * `lazy` de una ruta: descarga el módulo de pantallas al entrar a la ruta y arma el elemento con lo que exporta.
 * Se devuelve `element` (y no `Component`) porque varias rutas pasan props a la pantalla. El `loader` de la ruta
 * se declara aparte, de forma estática, para que corra en paralelo con la descarga.
 */
export function perezosa<M>(cargar: () => Promise<M>, armar: (modulo: M) => ReactNode) {
  return async (): Promise<{ element: ReactNode }> => ({ element: armar(await cargar()) });
}
