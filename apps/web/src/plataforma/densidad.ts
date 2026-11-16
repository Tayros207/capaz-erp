import { useCallback, useState } from 'react';

export type DensidadDeLista = 'comoda' | 'compacta';
const CLAVE = 'capaz.consola.densidad';

function leer(): DensidadDeLista {
  try {
    return localStorage.getItem(CLAVE) === 'compacta' ? 'compacta' : 'comoda';
  } catch {
    return 'comoda';
  }
}

/** Densidad de la lista de empresas, recordada en este navegador (conveniencia: si falla, vuelve a «cómoda»). */
export function useDensidad(): [DensidadDeLista, (d: DensidadDeLista) => void] {
  const [d, setD] = useState<DensidadDeLista>(leer);
  const cambiar = useCallback((nueva: DensidadDeLista) => {
    setD(nueva);
    try {
      localStorage.setItem(CLAVE, nueva);
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, []);
  return [d, cambiar];
}
