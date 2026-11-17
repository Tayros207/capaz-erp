import type { ComponentType } from 'react';

// Puntos de extensión: una pantalla del núcleo (por ejemplo la ficha del cliente) deja un hueco con nombre, y un
// módulo registra ahí sus piezas al cargar sus rutas. Así `core` no importa de `modules` (regla de capas) y
// cada módulo decide qué muestra. El registro vive en memoria y se llena al arrancar la aplicación.

export type PuntoDeExtension = 'ficha-cliente' | 'ficha-producto';
type Pieza = ComponentType<Record<string, unknown>>;

const registro = new Map<PuntoDeExtension, Pieza[]>();

/** Un módulo registra una pieza para un punto. Registrar dos veces la misma no la duplica. */
export function registrarExtension(punto: PuntoDeExtension, pieza: Pieza): void {
  const lista = registro.get(punto) ?? [];
  if (!lista.includes(pieza)) registro.set(punto, [...lista, pieza]);
}

/** Las piezas registradas en un punto, en orden de registro. */
export const extensionesDe = (punto: PuntoDeExtension): readonly Pieza[] => registro.get(punto) ?? [];

/** Solo para pruebas. */
export const vaciarExtensiones = (): void => registro.clear();

/** Dibuja todas las piezas registradas en `punto`, pasándoles el resto de las props. */
export function Extensiones({ punto, ...props }: { punto: PuntoDeExtension } & Record<string, unknown>) {
  const piezas = extensionesDe(punto);
  if (piezas.length === 0) return null;
  return (
    <>
      {piezas.map((Pieza, i) => (
        <Pieza key={i} {...props} />
      ))}
    </>
  );
}
