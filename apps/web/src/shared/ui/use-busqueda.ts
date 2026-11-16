import { useEffect, useRef, useState } from 'react';
import { useRetardo } from './use-retardo.ts';

export type EstadoDeBusqueda<O> = { cargando: boolean; falla: boolean; opciones: O[] };

/** Busca con retardo y descarta respuestas viejas. Sin `activa`, no consulta. */
export function useBusqueda<O>(texto: string, activa: boolean, buscar: (t: string) => Promise<O[]>, ms = 300): EstadoDeBusqueda<O> {
  const retrasado = useRetardo(texto.trim(), ms);
  const [estado, setEstado] = useState<EstadoDeBusqueda<O>>({ cargando: false, falla: false, opciones: [] });
  const ultima = useRef(buscar);
  useEffect(() => {
    ultima.current = buscar;
  });
  useEffect(() => {
    if (!activa) return;
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, falla: false }));
    ultima.current(retrasado).then(
      (opciones) => vigente && setEstado({ cargando: false, falla: false, opciones }),
      () => vigente && setEstado({ cargando: false, falla: true, opciones: [] }),
    );
    return () => {
      vigente = false;
    };
  }, [retrasado, activa]);
  return estado;
}
