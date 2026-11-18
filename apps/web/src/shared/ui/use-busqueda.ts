import { useEffect, useRef, useState } from 'react';
import { useRetardo } from './use-retardo.ts';

export type EstadoDeBusqueda<O> = { cargando: boolean; falla: boolean; opciones: O[] };

/**
 * Busca con retardo y descarta respuestas viejas. Sin `activa`, no consulta. Con el texto vacío no llama a `buscar`
 * (el servidor pide al menos una letra): usa `vacio` para mostrar los primeros resultados, o no muestra nada.
 */
export function useBusqueda<O>(texto: string, activa: boolean, buscar: (t: string) => Promise<O[]>, ms = 300, vacio?: () => Promise<O[]>): EstadoDeBusqueda<O> {
  const retrasado = useRetardo(texto.trim(), ms);
  const [estado, setEstado] = useState<EstadoDeBusqueda<O>>({ cargando: false, falla: false, opciones: [] });
  const ultima = useRef(buscar);
  const ultimaVacia = useRef(vacio);
  useEffect(() => {
    ultima.current = buscar;
    ultimaVacia.current = vacio;
  });
  useEffect(() => {
    if (!activa) return;
    const vacia = ultimaVacia.current;
    if (retrasado === '' && !vacia) {
      setEstado({ cargando: false, falla: false, opciones: [] });
      return;
    }
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, falla: false }));
    (retrasado === '' && vacia ? vacia() : ultima.current(retrasado)).then(
      (opciones) => vigente && setEstado({ cargando: false, falla: false, opciones }),
      () => vigente && setEstado({ cargando: false, falla: true, opciones: [] }),
    );
    return () => {
      vigente = false;
    };
  }, [retrasado, activa]);
  return estado;
}
