import type { ReactNode, Ref } from 'react';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { lineaDeEstadoDeVoz } from '../captura/logica-reconocedor.ts';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
import { BarraDeGrabacion } from './barra-de-grabacion.tsx';
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

const BOTON_REDONDO = 'relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-full transition-[transform,background-color,opacity,filter] duration-150 active:scale-90 disabled:cursor-not-allowed';

/** Lo que dice el botón del micrófono a quien no lo ve, según el momento. */
function etiquetaDelMicrofono(voz: ReconocedorDeVoz): string {
  if (voz.estado === 'transcribiendo') return 'Transcribiendo el audio';
  if (voz.estado !== 'escuchando') return 'Dictar con el micrófono';
  return voz.via === 'audio' ? 'Terminar la grabación' : 'Dejar de escuchar';
}

/** El micrófono de la caja, con ondas mientras escucha. */
function BotonDeMicrofono({ voz, alAlternar }: { voz: ReconocedorDeVoz; alAlternar: () => void }): ReactNode {
  const escuchando = voz.estado === 'escuchando';
  const transcribiendo = voz.estado === 'transcribiendo';
  return (
    <button type="button" aria-label={etiquetaDelMicrofono(voz)} aria-pressed={escuchando} aria-busy={transcribiendo || undefined} disabled={transcribiendo} onClick={alAlternar} className={unir(BOTON_REDONDO, escuchando ? 'bg-peligro text-texto-inverso' : 'bg-asistente-2/10 text-asistente-tinta-2 hover:bg-asistente-2/18')}>
      {escuchando ? <span aria-hidden="true" className="absolute inset-0 rounded-full bg-peligro motion-safe:animate-[asistente-onda_1.4s_ease-out_infinite]" /> : null}
      <Icono nombre="microfono" className={unir('relative size-5', transcribiendo && 'motion-safe:animate-pulse')} />
    </button>
  );
}

/**
 * La caja de escribir: un campo que crece con el texto, con el micrófono debajo y un botón que cambia de
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
      {voz.via === 'audio' && (escuchando || transcribiendo) ? (
        <BarraDeGrabacion voz={voz} />
      ) : lineaDeVoz ? <p role="status" className={unir('px-1 text-xs font-medium', escuchando ? 'text-peligro' : 'text-texto-suave')}>{lineaDeVoz}</p> : null}
      <div className={unir('flex flex-col rounded-3xl border bg-superficie p-2 shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--color-asistente-2)_45%,transparent)] transition-[border-color,box-shadow] duration-150', 'focus-within:border-asistente-2/70 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-asistente-2)_16%,transparent)]', escuchando ? 'border-peligro/50' : 'border-borde')}>
        <textarea
          ref={refTexto}
          value={valor}
          rows={1}
          maxLength={maximo}
          placeholder={marcador}
          aria-label="Mensaje para el asistente"
          className="foco-en-contenedor field-sizing-content max-h-40 min-h-10 w-full resize-none bg-transparent px-2 py-2 text-[0.9375rem] leading-snug text-texto placeholder:text-texto-suave/75 focus:outline-none"
          onChange={(e) => alCambiar(e.target.value)}
          onKeyDown={(e) => {
            if (teclaDeEnvio({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing }) === 'enviar') {
              e.preventDefault();
              if (sePuedeEnviar) alEnviar();
            }
          }}
        />
        <div className="flex items-center gap-2">
          {hayMicrofono ? <BotonDeMicrofono voz={voz} alAlternar={alAlternarVoz} /> : null}
          <span className="ml-auto hidden text-xs text-texto-suave md:block">Enter para enviar</span>
          <span className="ml-auto flex md:ml-0">
            {ocupado && alDetener ? (
              <button type="button" aria-label="Detener la respuesta" onClick={alDetener} className={unir(BOTON_REDONDO, 'bg-texto text-texto-inverso hover:brightness-110')}>
                <Icono nombre="detener" className="size-4" />
              </button>
            ) : (
              <button type="button" aria-label="Enviar" disabled={!sePuedeEnviar} onClick={alEnviar} className={unir(BOTON_REDONDO, 'bg-linear-135 from-asistente-hondo-1 to-asistente-hondo-2 text-white shadow-sutil hover:brightness-110 disabled:bg-none disabled:bg-superficie-alta disabled:text-texto-suave/60 disabled:shadow-none')}>
                <Icono nombre="enviar" className="size-5" />
              </button>
            )}
          </span>
        </div>
      </div>
      {!hayMicrofono && voz.aviso ? <p role="note" className="px-3 text-xs text-texto-suave">{voz.aviso}</p> : null}
      {cercaDelLimite ? <p className="text-right text-xs text-texto-suave">{`${valor.length} de ${maximo}`}</p> : null}
    </div>
  );
}
