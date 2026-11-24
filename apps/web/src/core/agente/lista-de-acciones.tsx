import type { ReactNode } from 'react';
import type { AccionDelAgente } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { etiquetaDePolitica, etiquetaDeResultado, fechaCorta, resumenDeArgumentos } from './logica-control.ts';

type Props = {
  estado: 'cargando' | 'error' | 'listo';
  mensajeDeError?: string;
  acciones: readonly AccionDelAgente[];
  titulo: (herramienta: string) => string;
  hayMas: boolean;
  alVerMas: () => void;
  alReintentar: () => void;
};

function Fila({ a, titulo }: { a: AccionDelAgente; titulo: string }): ReactNode {
  const args = resumenDeArgumentos(a.args);
  return (
    <li className="flex flex-col gap-1 rounded-control border border-borde p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-texto">{titulo}</p>
        <span className="shrink-0 text-xs text-texto-suave">{fechaCorta(a.creadoEn)}</span>
      </div>
      <p className="text-xs text-texto-suave">{`${etiquetaDeResultado(a.resultado)} · ${etiquetaDePolitica(a.politica)}${a.codigo ? ` · ${a.codigo}` : ''}`}</p>
      {args ? <p className="break-words text-xs text-texto-suave">{args}</p> : null}
      {a.resumenConfirmado ? <p className="text-xs text-texto-suave">{a.resumenConfirmado}</p> : null}
      <p className="text-xs text-texto-suave">{`Modelo: ${a.modelo}`}</p>
    </li>
  );
}

/** Lo que hizo, propuso o intentó el asistente: la huella para que una persona evalúe si actuó bien. */
export function ListaDeAcciones({ estado, mensajeDeError, acciones, titulo, hayMas, alVerMas, alReintentar }: Props): ReactNode {
  if (estado === 'cargando') return <div aria-busy="true" aria-label="Cargando lo que hizo el asistente" className="flex flex-col gap-2">{[0, 1].map((i) => <Esqueleto key={i} className="h-16 w-full" />)}</div>;
  if (estado === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-control border border-peligro/40 bg-peligro/10 p-3 text-sm">
        <p>{mensajeDeError ?? 'No se pudo cargar.'}</p>
        <Boton variante="secundario" onClick={alReintentar}>Reintentar</Boton>
      </div>
    );
  }
  if (acciones.length === 0) return <p className="text-sm text-texto-suave">Todavía no hizo nada.</p>;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">{acciones.map((a) => <Fila key={a.id} a={a} titulo={titulo(a.herramienta)} />)}</ul>
      {hayMas ? <Boton variante="fantasma" onClick={alVerMas}>Ver más</Boton> : null}
    </div>
  );
}
