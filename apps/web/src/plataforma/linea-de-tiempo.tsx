import { formatearFechaHora } from '../shared/formato/fechas.ts';
import { unir } from '../shared/ui/unir.ts';
import { CodigoDeModulo } from './chip-modulo.tsx';
import { etiquetaDeActor, nombreDeModulo } from './logica.ts';

export type EventoDeContrato = { modulo: string; evento: string; estadoAnterior: string | null; estadoNuevo: string; motivo: string | null; actor: string | null; creadoEn: string };

const PUNTO: Record<string, string> = { activo: 'bg-exito', prueba: 'bg-info', suspendido: 'bg-aviso', baja: 'bg-peligro' };
const TITULO: Record<string, string> = { alta: 'Alta', prueba: 'Prueba', suspension: 'Suspensión', baja: 'Baja', reactivacion: 'Reactivación', cambio: 'Cambio de contrato' };

/** Historial como línea de tiempo: lo más reciente arriba. */
export function LineaDeTiempo({ eventos }: { eventos: readonly EventoDeContrato[] }) {
  return (
    <ol className="relative flex list-none flex-col gap-0 p-0">
      {eventos.map((v, i) => (
        <li key={`${v.creadoEn}-${v.modulo}-${v.evento}-${i}`} className="relative flex gap-4 pb-5 last:pb-0">
          {i < eventos.length - 1 ? <span aria-hidden className="absolute top-4 bottom-0 left-[0.4375rem] w-px bg-borde" /> : null}
          <span aria-hidden className={unir('relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2 border-superficie shadow-sutil', PUNTO[v.estadoNuevo] ?? 'bg-borde-fuerte')} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-texto">{TITULO[v.evento] ?? v.evento}</span>
              <span className="text-sm text-texto-suave">{nombreDeModulo(v.modulo)}</span>
              <CodigoDeModulo codigo={v.modulo} />
              <time dateTime={v.creadoEn} className="ml-auto text-xs text-texto-suave tabular-nums">{formatearFechaHora(v.creadoEn)}</time>
            </div>
            <p className="text-sm text-texto-suave">
              {v.estadoAnterior ?? '—'} → <span className="font-medium text-texto">{v.estadoNuevo}</span>
              {v.motivo ? ` · ${v.motivo}` : ''}
              <span className="text-xs"> · {etiquetaDeActor(v.actor)}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
