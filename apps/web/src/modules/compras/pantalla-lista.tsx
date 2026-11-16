import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { usePermisosDeCompras } from './acciones.ts';
import { listarCompras, type FiltroDeEstado } from './api.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { COLUMNAS_DE_COMPRAS } from './columnas.tsx';
import { FILTROS, etiquetaDeFiltro } from './logica.ts';
import { Cargando } from './marco.tsx';

/** Órdenes de compra, de la más nueva a la más antigua; por defecto las abiertas. */
export function PantallaCompras() {
  const navegar = useNavigate();
  const { editar } = usePermisosDeCompras();
  const [estado, setEstado] = useState<FiltroDeEstado>('abiertas');
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_COMPRAS, 'lista', estado],
    queryFn: async ({ pageParam }) => datosOError(await listarCompras({ estado }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const nueva = editar ? <Boton variante="primario" icono="mas" onClick={() => void navegar('/m/compras/nueva')}>Nueva orden</Boton> : undefined;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Órdenes de compra" accionPrincipal={nueva} />
      <div className="grid gap-3 sm:grid-cols-[14rem]">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as FiltroDeEstado)}>
          {FILTROS.map((f) => (
            <option key={f} value={f}>{etiquetaDeFiltro(f)}</option>
          ))}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <Cargando etiqueta="Cargando órdenes de compra" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las órdenes" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista
            etiqueta="Órdenes de compra"
            columnas={COLUMNAS_DE_COMPRAS}
            filas={filas}
            clave={(c) => c.id}
            onAbrir={(c) => void navegar(`/m/compras/${c.id}`)}
            vacio={<EstadoVacio titulo={estado === 'abiertas' ? 'No hay órdenes abiertas' : 'Ninguna orden con ese estado'} descripcion="Las órdenes que hagas a tus proveedores aparecerán aquí." icono="caja" accion={nueva} />}
          />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
    </div>
  );
}
