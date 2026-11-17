import { useInfiniteQuery } from '@tanstack/react-query';
import type { HistorialDeListaDto, ListaDePrecioDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFecha } from '../../shared/formato/fechas.ts';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EnlaceDeEntidad } from '../../shared/ui/entidades.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { historialDeLista } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { InsigniaDeCotizacion } from './insignia-cotizacion.tsx';
import { soles } from './logica.ts';
import { Cargando } from './marco.tsx';

type Item = HistorialDeListaDto['items'][number];

/** «Su precio salió de la cotización por partes N.º COT-2026-0001 (versión 2)»; nada si la lista no tiene origen. */
export function LineaDeOrigen({ origen }: { origen: ListaDePrecioDto['origen'] }) {
  if (!origen) return null;
  return (
    <p className="text-texto">
      Su precio salió de la cotización por partes N.º{' '}
      <EnlaceDeEntidad tipo="cotizacion" id={origen.cotizacionId}>{origen.codigo}</EnlaceDeEntidad> (versión {origen.version}).
    </p>
  );
}

function Contenido({ lista }: { lista: ListaDePrecioDto }) {
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_COTIZADOR, 'historial-lista', lista.id],
    queryFn: async ({ pageParam }) => datosOError(await historialDeLista(lista.id, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const items: Item[] = consulta.data?.pages.flatMap((p) => p.items) ?? [];
  // El origen puede haber cambiado desde que se cargó la lista: manda lo que devuelve el historial.
  const origen = consulta.data?.pages[0]?.origen ?? lista.origen;
  return (
    <div className="flex flex-col gap-4">
      <LineaDeOrigen origen={origen} />
      <h3 className="font-titulo text-base font-semibold text-texto">Cotizaciones de este producto</h3>
      {consulta.isPending ? (
        <Cargando etiqueta="Cargando el historial" />
      ) : consulta.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm font-medium text-peligro">
          {consulta.error.message}
          <Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>
        </div>
      ) : items.length === 0 ? (
        <p className="text-texto-suave">Todavía no se hizo ninguna cotización de este producto.</p>
      ) : (
        <>
          <ul aria-label="Cotizaciones de este producto" className="flex flex-col gap-2">
            {items.map((i) => (
              <li key={`${i.cotizacionId}-${i.version}-${i.fecha}-${i.cantidadMilesimas}`} className="flex flex-col gap-1 rounded-tarjeta border border-borde bg-superficie px-3 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <EnlaceDeEntidad tipo="cotizacion" id={i.cotizacionId}>{i.codigo}</EnlaceDeEntidad>
                  <InsigniaDeCotizacion estado={i.estado} />
                </span>
                <span className="text-sm text-texto-suave">{i.clienteNombre ?? 'Sin cliente'} · {formatearFecha(i.fecha)} · versión {i.version}</span>
                <span className="text-sm text-texto">{milesimasATexto(i.cantidadMilesimas)} {lista.unidad} · S/ {milesimasATexto(i.precioUnitarioMilesimas)} c/u · {soles(i.importeCentimos)} sin IGV</span>
              </li>
            ))}
          </ul>
          <CargarMas cursor={consulta.hasNextPage ? (consulta.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={consulta.isFetchingNextPage} onCargar={() => void consulta.fetchNextPage()} resumen={`Mostrando ${items.length}`} />
        </>
      )}
    </div>
  );
}

/** Ficha de historial de un producto de la lista: de dónde salió su precio y en qué cotizaciones se usó. */
export function HojaHistorialDeLista({ lista, alCerrar }: { lista: ListaDePrecioDto | null; alCerrar: () => void }) {
  return (
    <HojaInferior abierto={lista !== null} alCerrar={alCerrar} titulo={lista ? `Historial de ${lista.nombre}` : 'Historial'}>
      {lista ? <Contenido key={lista.id} lista={lista} /> : null}
    </HojaInferior>
  );
}
