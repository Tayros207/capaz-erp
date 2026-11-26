import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { TarjetaDeBorrador } from '../captura/tarjeta-de-borrador.tsx';
import { respuestasRapidas } from './logica-acciones.ts';
import type { ElementoDeHilo, Resolucion, TonoDeAviso } from './logica-hilo.ts';
import { ETIQUETA_DE_RESOLUCION, SALUDO_VACIO } from './logica-panel.ts';
import { idDelError } from './logica-turno.ts';
import { OrbeDelAsistente } from './orbe-del-asistente.tsx';
import { ENTRA, PantallaVacia } from './pantalla-vacia.tsx';
import { TextoDelAgente } from './texto-del-agente.tsx';

type Props = {
  elementos: readonly ElementoDeHilo[];
  alResolver: (borradorId: string, resolucion: Resolucion) => void;
  /** Rellena la caja con la frase de ejemplo; no la envía. */
  alElegirSugerencia: (frase: string) => void;
  /** Envía una frase de un toque («Sí», «No»). Sin esto no se ofrecen respuestas rápidas. */
  alRespuestaRapida?: (frase: string) => void;
  alNavegar: (ruta: string) => void;
  /** Hay una respuesta en curso. */
  ocupado?: boolean;
  /** Con el asistente activo la pantalla vacía ofrece atajos; sin él, solo las frases de ejemplo del dictado. */
  conAsistente?: boolean;
  sugerencias: readonly string[];
  /** El saludo del hilo vacío. */
  saludo?: string;
  /** El `turnoId` del turno que se puede reintentar: su aviso de error o de corte ofrece el botón. */
  reintentable?: string | null;
  alReintentar?: () => void;
  /** La hora de la persona, para el saludo; se inyecta para probar. */
  hora?: number;
};

const TONOS: Record<TonoDeAviso, string> = {
  info: 'border-info/30 bg-info/10',
  aviso: 'border-aviso/40 bg-aviso/10',
  error: 'border-peligro/40 bg-peligro/10',
};

/** Tres puntos que saltan: «está pensando», antes de que llegue la primera palabra. */
function Escribiendo(): ReactNode {
  return (
    <span role="status" aria-label="El asistente está pensando" className="inline-flex items-center gap-1 py-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 rounded-full bg-asistente-2 motion-safe:animate-[asistente-punto_1.1s_ease-in-out_infinite]" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}

type Paso = Extract<ElementoDeHilo, { tipo: 'herramienta' }>;

function IndicadorDePaso({ estado }: { estado: Paso['estado'] }): ReactNode {
  if (estado === 'en_curso') return <span aria-hidden="true" className="size-3 rounded-full border-2 border-asistente-2/30 border-t-asistente-2 motion-safe:animate-spin" />;
  if (estado === 'listo') return <Icono nombre="check" className="size-3.5 text-exito" />;
  return <Icono nombre="aviso" className="size-3.5 text-aviso" />;
}

function Ficha({ p }: { p: Paso }): ReactNode {
  return (
    <li className={unir('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', p.estado === 'fallo' ? 'border-aviso/40 bg-aviso/10 text-texto' : 'border-borde bg-superficie-alta text-texto-suave')}>
      <IndicadorDePaso estado={p.estado} />
      <span className="truncate">{p.estado === 'en_curso' ? `${p.titulo}…` : p.nota ? `${p.titulo} · ${p.nota}` : p.titulo}</span>
    </li>
  );
}

/**
 * Lo que el asistente consultó o intentó, como fichas pequeñas que se completan solas (nunca llevan datos, solo una nota corta). Las de
 * orientación interna no se muestran (salvo que fallen). Terminado el trabajo, si son muchas se pliegan en una línea que se puede abrir.
 */
function Pasos({ pasos }: { pasos: readonly Paso[] }): ReactNode {
  const visibles = pasos.filter((p) => !p.interna || p.estado === 'fallo');
  if (visibles.length === 0) return null;
  const terminado = visibles.every((p) => p.estado !== 'en_curso');
  const lista = <ul aria-label="Lo que el asistente está revisando" className="flex flex-wrap gap-1.5">{visibles.map((p) => <Ficha key={p.id} p={p} />)}</ul>;
  if (terminado && visibles.length > 2) {
    return (
      <details className={unir('group ml-9', ENTRA)}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-borde bg-superficie-alta px-2.5 py-1 text-xs text-texto-suave select-none hover:border-borde-fuerte">
          <Icono nombre="check" className="size-3.5 text-exito" />
          {`Revisó ${visibles.length} cosas`}
        </summary>
        <div className="mt-1.5">{lista}</div>
      </details>
    );
  }
  return <div className={unir('ml-9', ENTRA)}>{lista}</div>;
}

type PropsDeElemento = { e: ElementoDeHilo; alResolver: Props['alResolver']; alNavegar: Props['alNavegar']; conReintento: boolean; alReintentar?: () => void };

function Elemento({ e, alResolver, alNavegar, conReintento, alReintentar }: PropsDeElemento): ReactNode {
  switch (e.tipo) {
    case 'persona':
      return <p className={unir('ml-auto max-w-[85%] rounded-[1.4rem] rounded-br-md bg-linear-135 from-asistente-hondo-1 to-asistente-hondo-2 px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-white shadow-tarjeta', ENTRA)}>{e.texto}</p>;
    case 'agente':
      return (
        <div className={unir('flex items-start gap-2.5', ENTRA)}>
          <OrbeDelAsistente tamano="size-7" className="mt-0.5" nivel={e.estado === 'escribiendo' ? 'pensando' : 'reposo'} />
          <div className={unir('min-w-0 flex-1 text-[0.9375rem] leading-relaxed text-texto', e.estado === 'error' && 'rounded-control border border-peligro/40 bg-peligro/10 px-3 py-2')}>
            {e.texto === '' && e.estado === 'escribiendo' ? <Escribiendo /> : <div role={e.estado === 'error' ? 'alert' : undefined}><TextoDelAgente texto={e.texto} escribiendo={e.estado === 'escribiendo'} /></div>}
            {e.estado === 'interrumpido' ? <p className="mt-1 text-sm text-texto-suave">La respuesta se interrumpió.</p> : null}
          </div>
        </div>
      );
    case 'accion':
      return (
        <div className={unir('ml-9 flex items-center gap-3 rounded-2xl border border-exito/30 bg-exito/10 px-3 py-2.5', ENTRA)}>
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-exito text-texto-inverso"><Icono nombre="check" className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-exito">Hecho</p>
            <p className="truncate text-sm font-medium text-texto">{e.titulo}</p>
          </div>
          {e.ruta ? <Boton variante="secundario" onClick={() => alNavegar(e.ruta!)} aria-label={`Abrir: ${e.titulo}`}>Abrir</Boton> : null}
        </div>
      );
    case 'borrador':
      return e.resuelto ? (
        <p className="ml-9 text-sm text-texto-suave">{`${e.propuesta.resumen} · ${ETIQUETA_DE_RESOLUCION[e.resuelto]}`}</p>
      ) : (
        <div className={unir('ml-9', ENTRA)}><TarjetaDeBorrador propuesta={e.propuesta} alResolver={alResolver} /></div>
      );
    case 'herramienta':
      return null;
    case 'aviso':
      return (
        <div role={e.tono === 'error' ? 'alert' : 'status'} className={unir('ml-9 rounded-2xl border px-3.5 py-2.5 text-sm text-texto', TONOS[e.tono], ENTRA)}>
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

type Grupo = { clave: string; elemento: ElementoDeHilo } | { clave: string; pasos: Paso[] };

/** Las herramientas seguidas se juntan en UNA fila de fichas; lo demás se queda como está. */
function agrupar(elementos: readonly ElementoDeHilo[]): Grupo[] {
  const salida: Grupo[] = [];
  for (const e of elementos) {
    if (e.tipo !== 'herramienta') {
      salida.push({ clave: e.id, elemento: e });
      continue;
    }
    const previo = salida.at(-1);
    if (previo && 'pasos' in previo) previo.pasos.push(e);
    else salida.push({ clave: `pasos-${e.id}`, pasos: [e] });
  }
  return salida;
}

/** La conversación: una lista que solo crece, con aviso de lectura para quien usa lector de pantalla. */
export function Hilo({ elementos, alResolver, alElegirSugerencia, alRespuestaRapida, alNavegar, ocupado = false, conAsistente = false, sugerencias, saludo = SALUDO_VACIO, reintentable = null, alReintentar, hora }: Props): ReactNode {
  const [horaActual] = useState(() => hora ?? new Date().getHours());
  const fin = useRef<HTMLDivElement>(null);
  const grupos = useMemo(() => agrupar(elementos), [elementos]);
  const rapidas = alRespuestaRapida ? respuestasRapidas(elementos, ocupado) : [];
  useEffect(() => {
    // La pantalla vacía se lee desde arriba: solo una conversación se sigue hasta el final.
    if (elementos.length > 0) fin.current?.scrollIntoView({ block: 'end' });
  }, [elementos]);

  return (
    <div role="log" aria-live="polite" aria-label="Conversación con el asistente" className="flex flex-col gap-3">
      {elementos.length === 0 ? (
        <PantallaVacia saludo={saludo} hora={horaActual} conAsistente={conAsistente} sugerencias={sugerencias} alElegir={alElegirSugerencia} />
      ) : (
        grupos.map((g) =>
          'pasos' in g ? (
            <Pasos key={g.clave} pasos={g.pasos} />
          ) : (
            <Elemento key={g.clave} e={g.elemento} alResolver={alResolver} alNavegar={alNavegar} conReintento={reintentable !== null && (g.elemento.id === idDelError(reintentable) || g.elemento.id === `cortada-${reintentable}`)} alReintentar={alReintentar} />
          ),
        )
      )}
      {rapidas.length > 0 && alRespuestaRapida ? (
        <div className={unir('ml-9 flex flex-wrap gap-2', ENTRA)}>
          {rapidas.map((r) => (
            <button key={r} type="button" onClick={() => alRespuestaRapida(r)} className="min-h-9 cursor-pointer rounded-full border border-asistente-2/40 bg-asistente-2/10 px-4 text-sm font-medium text-texto transition-[transform,background-color] duration-150 hover:bg-asistente-2/20 active:scale-95">
              {r}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={fin} />
    </div>
  );
}
