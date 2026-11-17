import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { SolicitudDeCompraDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { usePermisosDeCompras } from './acciones.ts';
import { listarSolicitudes, POR_PAGINA_DE_OPERACIONES } from './api-operaciones.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { HojaDeSolicitud } from './hoja-solicitud.tsx';
import { ETIQUETA_DE_SOLICITUD, FILTROS_DE_SOLICITUD, TONO_DE_SOLICITUD } from './logica-operaciones.ts';
import { Cargando } from './marco.tsx';

type Filtro = keyof typeof FILTROS_DE_SOLICITUD;

const COLUMNAS: Array<Columna<SolicitudDeCompraDto>> = [
  { id: 'codigo', titulo: 'Solicitud', principal: true, celda: (s) => s.codigo ?? 'Borrador' },
  { id: 'estado', titulo: 'Estado', celda: (s) => <Insignia tono={TONO_DE_SOLICITUD[s.estado]}>{ETIQUETA_DE_SOLICITUD[s.estado]}</Insignia> },
  { id: 'area', titulo: 'Área', celda: (s) => s.area ?? '' },
  { id: 'lineas', titulo: 'Líneas', alinear: 'derecha', celda: (s) => String(s.lineas.length) },
  { id: 'necesaria', titulo: 'Necesaria para', celda: (s) => s.necesariaEl ?? '' },
  { id: 'creada', titulo: 'Creada', celda: (s) => formatearFechaHora(s.creadoEn) },
];

/** Solicitudes de compra: lo que cada área pide, a la espera de aprobación; por defecto, las abiertas. */
export function PantallaSolicitudes() {
  const navegar = useNavigate();
  const { editar } = usePermisosDeCompras();
  const [filtro, setFiltro] = useState<Filtro>('abiertas');
  const [hoja, setHoja] = useState(false);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_COMPRAS, 'solicitudes', filtro],
    queryFn: async ({ pageParam }) => datosOError(await listarSolicitudes({ estado: filtro, limite: POR_PAGINA_DE_OPERACIONES, ...(pageParam && { cursor: pageParam }) })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const nueva = editar ? <Boton variante="primario" icono="mas" onClick={() => setHoja(true)}>Nueva solicitud</Boton> : undefined;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Solicitudes de compra" accionPrincipal={nueva} />
      <div className="grid gap-3 sm:grid-cols-[14rem]">
        <CampoSelect etiqueta="Mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          {Object.entries(FILTROS_DE_SOLICITUD).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <Cargando etiqueta="Cargando solicitudes de compra" />
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar las solicitudes" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista etiqueta="Solicitudes de compra" columnas={COLUMNAS} filas={filas} clave={(s) => s.id} onAbrir={(s) => void navegar(`/m/compras/solicitudes/${s.id}`)} vacio={<EstadoVacio titulo="No hay solicitudes con ese estado" descripcion="Lo que pidan las áreas para comprar aparecerá aquí, antes de convertirse en orden." icono="caja" accion={nueva} />} />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
      <HojaDeSolicitud abierto={hoja} alCerrar={() => setHoja(false)} alCrear={(id) => void navegar(`/m/compras/solicitudes/${id}`)} />
    </div>
  );
}
