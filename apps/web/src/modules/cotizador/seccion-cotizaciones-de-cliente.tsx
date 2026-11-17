import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearFecha } from '../../shared/formato/fechas.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { EnlaceDeEntidad } from '../../shared/ui/entidades.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { cotizacionesDeCliente } from './api-lista-cotizaciones.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { InsigniaDeCotizacion } from './insignia-cotizacion.tsx';
import { soles } from './logica.ts';

/**
 * Las últimas cotizaciones de un cliente, en su ficha del ERP. Se oculta sin el permiso `cotizador:ver`
 * (que solo lo tiene quien tiene el módulo activo), igual que `EnlaceAlCotizador`.
 */
export function SeccionCotizacionesDeCliente({ clienteId }: { clienteId: string }) {
  const yo = useYo();
  const visible = !!yo && puede(yo, 'cotizador:ver');
  const consulta = useQuery({
    queryKey: [...CLAVE_COTIZADOR, 'cotizaciones-de-cliente', clienteId],
    queryFn: async () => datosOError(await cotizacionesDeCliente(clienteId)),
    enabled: visible,
  });
  if (!visible) return null;
  const puedeCrear = puede(yo, 'cotizador:editar');
  return (
    <section aria-label="Cotizaciones" className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-texto">Cotizaciones</h2>
        {puedeCrear ? (
          <Link to={`/m/cotizador?cliente=${clienteId}`} className="inline-flex min-h-(--alto-control) items-center rounded-control border border-borde bg-superficie px-3.5 text-sm font-medium text-texto shadow-sutil hover:border-borde-fuerte">
            Nueva cotización
          </Link>
        ) : null}
      </div>
      {consulta.isPending ? (
        <Esqueleto className="h-16" />
      ) : consulta.isError ? (
        <p role="alert" className="text-sm text-peligro">No pudimos cargar las cotizaciones: {consulta.error.message}</p>
      ) : consulta.data.items.length === 0 ? (
        <p className="text-sm text-texto-suave">Todavía no se le cotizó nada.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {consulta.data.items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="flex min-w-0 flex-col">
                <EnlaceDeEntidad tipo="cotizacion" id={c.id}>{c.codigo}</EnlaceDeEntidad>
                <span className="truncate text-sm text-texto-suave">{c.titulo} · {formatearFecha(c.creadoEn)}</span>
              </span>
              <span className="flex items-center gap-3">
                <InsigniaDeCotizacion estado={c.estado} validaHasta={c.validaHasta} />
                <span className="text-sm font-medium text-texto">{c.conOpciones ? 'Con opciones' : soles(c.totalCentimos)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
