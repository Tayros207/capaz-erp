import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { CLAVE_CRM, listarActividades, POR_PAGINA } from './api.ts';
import { FilaActividad } from './fila-actividad.tsx';
import { MarcoCrm } from './marco.tsx';
import { usePermisosCrm } from './permisos.ts';

type Filtro = 'pendientes' | 'vencidas' | 'hechas' | 'todas';

/** Actividades de todas las oportunidades: pendientes y vencidas primero, con «Hecha». */
export function PantallaActividades() {
  const { editar } = usePermisosCrm();
  const [estado, setEstado] = useState<Filtro>('pendientes');
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_CRM, 'actividades', estado],
    queryFn: async ({ pageParam }) => datosOError(await listarActividades({ estado, limite: POR_PAGINA, ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <MarcoCrm>
      <EncabezadoDePagina titulo="Actividades de seguimiento" />
      <div className="sm:w-56">
        <CampoSelect etiqueta="Mostrar" value={estado} onChange={(e) => setEstado(e.target.value as Filtro)}>
          <option value="pendientes">Pendientes</option>
          <option value="vencidas">Vencidas</option>
          <option value="hechas">Hechas</option>
          <option value="todas">Todas</option>
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <div aria-busy="true" aria-label="Cargando actividades" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las actividades" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : filas.length === 0 ? (
        <EstadoVacio titulo="Nada por aquí" descripcion="Las llamadas, reuniones y tareas que anotes en tus oportunidades aparecerán en esta lista." icono="check" />
      ) : (
        <>
          <ul aria-label="Actividades" className="flex flex-col divide-y divide-borde">
            {filas.map((a) => <FilaActividad key={a.id} a={a} editar={editar} conOportunidad />)}
          </ul>
          <CargarMas cursor={lista.hasNextPage ? (lista.data.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
    </MarcoCrm>
  );
}
