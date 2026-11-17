import type { CotizacionCompletaDto } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { filaDeHistorial } from './logica-cotizaciones.ts';

/** Lo que le pasó a la cotización, lo más reciente primero: qué, por dónde (el enlace) y su detalle (nota, opciones elegidas). */
export function HistorialDeCotizacion({ historial }: { historial: CotizacionCompletaDto['historial'] }) {
  return (
    <section aria-label="Historial de la cotización" className="flex flex-col gap-2">
      <h2 className="font-titulo font-semibold text-texto">Historial</h2>
      <ol className="flex flex-col gap-3">
        {historial.map((e, i) => {
          const f = filaDeHistorial(e);
          return (
            <li key={`${e.creadoEn}-${i}`} className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 break-words text-texto">
                {f.titulo}
                {f.canal ? <Insignia tono="info">{f.canal}</Insignia> : null}
              </span>
              {f.detalle.map((d) => <span key={d} className="break-words text-sm text-texto">{d}</span>)}
              <span className="text-sm text-texto-suave">{formatearFechaHora(e.creadoEn)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
