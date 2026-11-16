import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Cargando } from './marco.tsx';

type Pagina<T> = { items: T[]; siguiente: string | null };

type Props<T> = {
  consulta: UseInfiniteQueryResult<InfiniteData<Pagina<T>, unknown>>;
  /** Nombre de la lista (lectores de pantalla) y de lo que no se pudo cargar. */
  etiqueta: string;
  columnas: Array<Columna<T>>;
  clave: (fila: T) => string;
  onAbrir?: (fila: T) => void;
  vacio: ReactNode;
};

/** Una lista del kit con su carga, su error con «Reintentar» y «Cargar más» por cursor. */
export function ListaPaginada<T>({ consulta, etiqueta, columnas, clave, onAbrir, vacio }: Props<T>) {
  if (consulta.isPending) return <Cargando etiqueta={`Cargando ${etiqueta.toLocaleLowerCase('es')}`} />;
  if (consulta.isError) {
    return <EstadoVacio titulo={`No pudimos cargar ${etiqueta.toLocaleLowerCase('es')}`} descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  }
  const filas = consulta.data.pages.flatMap((p) => p.items);
  return (
    <>
      <Lista etiqueta={etiqueta} columnas={columnas} filas={filas} clave={clave} onAbrir={onAbrir} vacio={vacio} />
      <CargarMas
        cursor={consulta.hasNextPage ? (consulta.data.pages.at(-1)?.siguiente ?? null) : null}
        cargando={consulta.isFetchingNextPage}
        onCargar={() => void consulta.fetchNextPage()}
        resumen={`Mostrando ${filas.length}`}
      />
    </>
  );
}
