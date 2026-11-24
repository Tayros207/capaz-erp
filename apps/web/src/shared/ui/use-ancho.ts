import { useSyncExternalStore } from 'react';

// `md` de Tailwind: a partir de aquí hay sitio para un panel flotante en vez de una hoja que sube desde abajo.
const CONSULTA_ANCHO = '(min-width: 48rem)';

function suscribirse(alCambiar: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const lista = window.matchMedia(CONSULTA_ANCHO);
  lista.addEventListener('change', alCambiar);
  return () => lista.removeEventListener('change', alCambiar);
}

const leer = (): boolean => typeof window !== 'undefined' && window.matchMedia(CONSULTA_ANCHO).matches;

/** ¿La pantalla es ancha (tableta o escritorio)? Falso sin `window`, así que también sirve al pintar en el servidor o en pruebas. */
export function useEsAncho(): boolean {
  return useSyncExternalStore(suscribirse, leer, () => false);
}
