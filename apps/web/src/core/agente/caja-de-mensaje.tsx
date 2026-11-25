import type { ReactNode, Ref } from 'react';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { lineaDeEstadoDeVoz } from '../captura/logica-reconocedor.ts';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
import { puedeEnviar, teclaDeEnvio } from './logica-caja.ts';

type Props = {
  valor: string;
  alCambiar: (valor: string) => void;
  alEnviar: () => void;
  alAlternarVoz: () => void;
  /** El reconocedor entra por props: así la caja se prueba sin navegador. */
  voz: ReconocedorDeVoz;
  /** Hay una respuesta en curso: no se puede enviar otra. */
  ocupado: boolean;
  maximo: number;
  /** Texto de ayuda dentro de la caja vacía. */
  marcador: string;
  /** Para llevar el foco a la caja al abrir el panel. */
  refTexto?: Ref<HTMLTextAreaElement>;
  /** Con una respuesta en curso, el botón de enviar pasa a ser «Detener». Sin esto no hay forma de detener (modo sin modelo). */
  alDetener?: () => void;
};

const SIN_MICROFONO = new Set<ReconocedorDeVoz['estado']>(['no_disponible', 'sin_contexto_seguro']);
/** Desde este punto del límite se muestra el contador; antes sobra y estorba. */
const AVISAR_DESDE = 0.8;

const BOTON_REDONDO = 'relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-full transition-[transform,background-color,opacity,filter] duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40';

/** Lo que dice el botón del micrófono a quien no lo ve, según el momento. */
function etiquetaDelMicrofono(voz: ReconocedorDeVoz): string {
  if (voz.estado === 'transcribiendo') return 'Transcribiendo el audio';
  if (voz.estado !== 'escuchando') return 'Dictar con el micrófono';
  return voz.via === 'audio' ? 'Terminar la grabación' : 'Dejar de escuchar';
}

/**
 * La caja de escribir: una píldora que crece con el texto, con el micrófono dentro (con ondas mientras escucha) y un botón que cambia de
 * «Enviar» a «Detener». Lo dictado se suma al texto y se puede corregir: nunca se envía solo. Mientras se transcribe un audio no se
 * envía: el texto todavía no llegó a la caja.
 */
export function CajaDeMensaje({ valor, alCambiar, alEnviar, alAlternarVoz, voz, ocupado, maximo, marcador, refTexto, alDetener }: Props): ReactNode {
  const escuchando = voz.estado === 'escuchando';
  const transcribiendo = voz.estado === 'transcribiendo';
  const hayMicrofono = !SIN_MICROFONO.has(voz.estado);
  const lineaDeVoz = lineaDeEstadoDeVoz(voz.estado, voz.via);
  const sePuedeEnviar = puedeEnviar(valor, ocupado || transcribiendo);
  const cercaDelLimite = valor.length >= maximo * AVISAR_DESDE;
  return (
    <div className="flex flex-col gap-1.5">
      {voz.aviso && hayMicrofono ? (
        <p role="status" className="rounded-control border border-aviso/40 bg-aviso/10 p-2 text-sm text-texto">{voz.aviso}</p>
      ) : null}
      {lineaDeVoz ? <p role="status" className={unir('px-1 text-xs font-medium', escuchando ? 'text-peligro' : 'text-texto-suave')}>{lineaDeVoz}</p> : null}
      <div className={unir('flex items-end gap-1.5 rounded-[1.75rem] border bg-superficie/90 p-1.5 pl-4 shadow-tarjeta backdrop-blur transition-[border-color,box-shadow] duration-150', 'focus-within:border-asistente-2/60 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-asistente-2)_22%,transparent)]', escuchando ? 'border-peligro/50' : 'border-borde-fuerte/60')}>
        <textarea
          ref={refTexto}
          value={valor}
          rows={1}
          maxLength={maximo}
          placeholder={marcador}
          aria-label="Mensaje para el asistente"
          className="field-sizing-content max-h-40 min-h-10 w-full resize-none self-center bg-transparent py-2 text-[0.9375rem] leading-snug text-texto placeholder:text-texto-suave/70 focus:outline-none focus-visible:[box-shadow:none]"
          onChange={(e) => alCambiar(e.target.value)}
          onKeyDown={(e) => {
            if (teclaDeEnvio({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing }) === 'enviar') {
              e.preventDefault();
              if (sePuedeEnviar) alEnviar();
            }
          }}
        />
        {hayMicrofono ? (
          <button type="button" aria-label={etiquetaDelMicrofono(voz)} aria-pressed={escuchando} aria-busy={transcribiendo || undefined} disabled={transcribiendo} onClick={alAlternarVoz} className={unir(BOTON_REDONDO, escuchando ? 'bg-peligro text-texto-inverso' : 'text-texto-suave hover:bg-superficie-alta hover:text-texto')}>
            {escuchando ? <span aria-hidden="true" className="absolute inset-0 rounded-full bg-peligro motion-safe:animate-[asistente-onda_1.4s_ease-out_infinite]" /> : null}
            <Icono nombre="microfono" className={unir('relative size-5', transcribiendo && 'motion-safe:animate-pulse')} />
          </button>
        ) : null}
        {ocupado && alDetener ? (
          <button type="button" aria-label="Detener la respuesta" onClick={alDetener} className={unir(BOTON_REDONDO, 'bg-texto text-texto-inverso hover:brightness-110')}>
            <Icono nombre="detener" className="size-4" />
          </button>
        ) : (
          <button type="button" aria-label="Enviar" disabled={!sePuedeEnviar} onClick={alEnviar} className={unir(BOTON_REDONDO, 'bg-accion text-accion-texto shadow-sutil hover:brightness-110')}>
            <Icono nombre="enviar" className="size-5" />
          </button>
        )}
      </div>
      {!hayMicrofono && voz.aviso ? <p role="note" className="px-3 text-xs text-texto-suave">{voz.aviso}</p> : null}
      {cercaDelLimite ? <p className="text-right text-xs text-texto-suave">{`${valor.length} de ${maximo}`}</p> : null}
    </div>
  );
}
