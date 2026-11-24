import type { ReactNode, Ref } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
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

/** Área de texto con micrófono y botón de enviar. Lo dictado se suma al texto y se puede corregir: nunca se envía solo. */
export function CajaDeMensaje({ valor, alCambiar, alEnviar, alAlternarVoz, voz, ocupado, maximo, marcador, refTexto, alDetener }: Props): ReactNode {
  const escuchando = voz.estado === 'escuchando';
  const hayMicrofono = !SIN_MICROFONO.has(voz.estado);
  return (
    <div className="flex flex-col gap-2">
      {voz.aviso ? (
        <p role="status" className="rounded-control border border-aviso/40 bg-aviso/10 p-2 text-sm text-texto">{voz.aviso}</p>
      ) : null}
      <div className="flex items-end gap-2">
        <textarea
          ref={refTexto}
          value={valor}
          rows={2}
          maxLength={maximo}
          placeholder={marcador}
          aria-label="Mensaje para el asistente"
          className="max-h-40 min-h-(--alto-control) w-full resize-none rounded-control border border-borde-fuerte bg-superficie px-3 py-2 text-sm text-texto shadow-sutil placeholder:text-texto-suave/80"
          onChange={(e) => alCambiar(e.target.value)}
          onKeyDown={(e) => {
            if (teclaDeEnvio({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing }) === 'enviar') {
              e.preventDefault();
              if (puedeEnviar(valor, ocupado)) alEnviar();
            }
          }}
        />
        {hayMicrofono ? (
          <Boton
            variante={escuchando ? 'peligro' : 'secundario'}
            icono="microfono"
            aria-label={escuchando ? 'Dejar de escuchar' : 'Dictar con el micrófono'}
            aria-pressed={escuchando}
            onClick={alAlternarVoz}
          />
        ) : null}
        {ocupado && alDetener ? (
          <Boton variante="peligro" icono="detener" aria-label="Detener la respuesta" onClick={alDetener} />
        ) : (
          <Boton variante="primario" icono="enviar" aria-label="Enviar" disabled={!puedeEnviar(valor, ocupado)} onClick={alEnviar} />
        )}
      </div>
      <p className="text-right text-xs text-texto-suave">{`${valor.length} de ${maximo}`}</p>
    </div>
  );
}
