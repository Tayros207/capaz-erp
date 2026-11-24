import { useEffect, useRef, type ReactNode } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { TarjetaDeBorrador } from '../captura/tarjeta-de-borrador.tsx';
import type { ElementoDeHilo, Resolucion, TonoDeAviso } from './logica-hilo.ts';
import { ETIQUETA_DE_RESOLUCION, SALUDO_VACIO } from './logica-panel.ts';
import { idDelError } from './logica-turno.ts';

type Props = {
  elementos: readonly ElementoDeHilo[];
  alResolver: (borradorId: string, resolucion: Resolucion) => void;
  /** Rellena la caja con la frase de ejemplo; no la envía. */
  alElegirSugerencia: (frase: string) => void;
  alNavegar: (ruta: string) => void;
  sugerencias: readonly string[];
  /** El saludo del hilo vacío. */
  saludo?: string;
  /** El `turnoId` del turno que se puede reintentar: su aviso de error o de corte ofrece el botón. */
  reintentable?: string | null;
  alReintentar?: () => void;
};

const TONOS: Record<TonoDeAviso, string> = {
  info: 'border-info/30 bg-info/10',
  aviso: 'border-aviso/40 bg-aviso/10',
  error: 'border-peligro/40 bg-peligro/10',
};

// Todo texto del hilo (el de la persona y el del asistente) se pinta como texto, nunca como HTML: puede traer cualquier cosa.
type PropsDeElemento = { e: ElementoDeHilo; alResolver: Props['alResolver']; alNavegar: Props['alNavegar']; conReintento: boolean; alReintentar?: () => void };

function Elemento({ e, alResolver, alNavegar, conReintento, alReintentar }: PropsDeElemento): ReactNode {
  switch (e.tipo) {
    case 'persona':
      return <p className="ml-auto max-w-[85%] rounded-tarjeta bg-accion px-3 py-2 text-sm break-words whitespace-pre-wrap text-accion-texto">{e.texto}</p>;
    case 'agente':
      return (
        <div className={unir('max-w-[92%] rounded-tarjeta border px-3 py-2 text-sm break-words whitespace-pre-wrap', e.estado === 'error' ? 'border-peligro/40 bg-peligro/10' : 'border-borde bg-superficie-alta')}>
          <p role={e.estado === 'error' ? 'alert' : undefined}>{e.texto || (e.estado === 'escribiendo' ? '…' : '')}</p>
          {e.estado === 'interrumpido' ? <p className="mt-1 text-texto-suave">La respuesta se interrumpió.</p> : null}
        </div>
      );
    case 'borrador':
      return e.resuelto ? (
        <p className="text-sm text-texto-suave">{`${e.propuesta.resumen} · ${ETIQUETA_DE_RESOLUCION[e.resuelto]}`}</p>
      ) : (
        <TarjetaDeBorrador propuesta={e.propuesta} alResolver={alResolver} />
      );
    case 'herramienta':
      return (
        <p className="text-xs text-texto-suave" aria-live="off">
          {e.estado === 'en_curso' ? `${e.titulo}…` : e.estado === 'listo' ? `${e.titulo}${e.nota ? ` · ${e.nota}` : ''}` : `${e.titulo} · ${e.nota ?? 'no se pudo'}`}
        </p>
      );
    case 'aviso':
      return (
        <div role={e.tono === 'error' ? 'alert' : 'status'} className={unir('rounded-control border px-3 py-2 text-sm text-texto', TONOS[e.tono])}>
          <p className="break-words whitespace-pre-wrap">{e.texto}</p>
          {e.enlace ? (
            <button type="button" className="mt-1 cursor-pointer font-semibold text-accion underline underline-offset-2" onClick={() => alNavegar(e.enlace!.ruta)}>
              {e.enlace.texto}
            </button>
          ) : null}
          {conReintento && alReintentar ? (
            <Boton variante="secundario" icono="nueva" className="mt-2" onClick={alReintentar}>Reintentar</Boton>
          ) : null}
        </div>
      );
  }
}

/** La conversación: una lista que solo crece, con aviso de lectura para quien usa lector de pantalla. */
export function Hilo({ elementos, alResolver, alElegirSugerencia, alNavegar, sugerencias, saludo = SALUDO_VACIO, reintentable = null, alReintentar }: Props): ReactNode {
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [elementos.length]);

  return (
    <div role="log" aria-live="polite" aria-label="Conversación con el asistente" className="flex flex-col gap-3">
      {elementos.length === 0 ? (
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm text-texto-suave">{saludo}</p>
          <ul className="flex flex-col gap-2">
            {sugerencias.map((frase) => (
              <li key={frase}>
                <button
                  type="button"
                  className="min-h-(--alto-control) w-full cursor-pointer rounded-control border border-borde bg-superficie px-3 py-2 text-left text-sm text-texto hover:border-borde-fuerte hover:bg-superficie-alta"
                  onClick={() => alElegirSugerencia(frase)}
                >
                  {frase}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        elementos.map((e) => (
          <Elemento key={e.id} e={e} alResolver={alResolver} alNavegar={alNavegar} conReintento={reintentable !== null && (e.id === idDelError(reintentable) || e.id === `cortada-${reintentable}`)} alReintentar={alReintentar} />
        ))
      )}
      <div ref={fin} />
    </div>
  );
}
