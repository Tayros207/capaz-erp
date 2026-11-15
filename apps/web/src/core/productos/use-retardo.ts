import { useEffect, useState } from 'react';

/** El valor, pero solo después de `ms` sin cambiar: evita una consulta por cada tecla. */
export function useRetardo<T>(valor: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}
