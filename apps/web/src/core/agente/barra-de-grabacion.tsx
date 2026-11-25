import type { ReactNode } from 'react';
import { unir } from '../../shared/ui/unir.ts';
import { SEGUNDOS_MAXIMOS_DE_GRABACION } from '../captura/logica-audio.ts';
import { formatoDeTiempo } from '../captura/logica-reconocedor.ts';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';

const BOTON = 'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[transform,background-color] duration-150 active:scale-95';

function IconoDePausa({ pausado }: { pausado: boolean }): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
      {pausado ? <path d="M8 5.5v13l11-6.5z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
    </svg>
  );
}

/**
 * Los controles mientras se graba con la vía de audio: el contador (sin contar las pausas), una barra que avanza hacia el tope de tiempo,
 * y los botones para pausar, seguir o cancelar. Terminar y enviar a transcribir se hace con el micrófono de la caja.
 */
export function BarraDeGrabacion({ voz }: { voz: ReconocedorDeVoz }): ReactNode {
  if (voz.estado === 'transcribiendo') {
    return (
      <p role="status" className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-asistente-2">
        <span aria-hidden="true" className="size-3.5 rounded-full border-2 border-asistente-2/30 border-t-asistente-2 motion-safe:animate-spin" />
        Transcribiendo el audio…
      </p>
    );
  }
  const pausado = voz.pausado === true;
  const segundos = voz.segundos ?? 0;
  const avance = Math.min(1, segundos / SEGUNDOS_MAXIMOS_DE_GRABACION);
  return (
    <div role="group" aria-label="Controles de la grabación" className="relative flex flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden rounded-[1.25rem] border border-peligro/30 bg-peligro/10 px-3 py-1.5">
      <span aria-hidden="true" className={unir('size-2.5 shrink-0 rounded-full bg-peligro', !pausado && 'motion-safe:animate-pulse')} />
      <span role="status" className="text-sm font-medium text-texto">{pausado ? 'En pausa' : 'Grabando'}</span>
      <span className="text-sm text-texto-suave tabular-nums" aria-label={`${formatoDeTiempo(segundos)} de ${formatoDeTiempo(SEGUNDOS_MAXIMOS_DE_GRABACION)}`}>{`${formatoDeTiempo(segundos)} / ${formatoDeTiempo(SEGUNDOS_MAXIMOS_DE_GRABACION)}`}</span>
      <span className="ml-auto flex items-center gap-1">
        {voz.pausar && voz.reanudar ? (
          <button type="button" onClick={pausado ? voz.reanudar : voz.pausar} className={unir(BOTON, 'bg-superficie text-texto hover:bg-superficie-alta')} aria-label={pausado ? 'Reanudar la grabación' : 'Pausar la grabación'}>
            <IconoDePausa pausado={pausado} />
            {pausado ? 'Seguir' : 'Pausar'}
          </button>
        ) : null}
        {voz.cancelar ? (
          <button type="button" onClick={voz.cancelar} className={unir(BOTON, 'text-texto-suave hover:bg-superficie hover:text-peligro')} aria-label="Cancelar la grabación">Cancelar</button>
        ) : null}
      </span>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-peligro/70 transition-transform duration-300" style={{ transform: `scaleX(${avance})` }} />
    </div>
  );
}
