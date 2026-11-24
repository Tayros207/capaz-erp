import type { ReactNode } from 'react';
import type { Leccion } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { etiquetaDeEstadoDeLeccion, etiquetaDeOrigenDeLeccion } from './logica-control.ts';

type Props = {
  estado: 'cargando' | 'error' | 'listo';
  mensajeDeError?: string;
  lecciones: readonly Leccion[];
  /** Compartir una lección con toda la empresa pide poder configurarla. */
  puedeCompartir: boolean;
  ocupado: boolean;
  alAprobar: (id: string, alcance?: 'persona' | 'empresa') => void;
  alArchivar: (id: string) => void;
  alReintentar: () => void;
};

function Fila({ l, puedeCompartir, ocupado, alAprobar, alArchivar }: { l: Leccion } & Pick<Props, 'puedeCompartir' | 'ocupado' | 'alAprobar' | 'alArchivar'>): ReactNode {
  return (
    <li className="flex flex-col gap-2 rounded-control border border-borde p-3 text-sm">
      <p className="text-texto">{l.texto}</p>
      <p className="text-xs text-texto-suave">{`${etiquetaDeEstadoDeLeccion(l.estado)} · ${etiquetaDeOrigenDeLeccion(l.origen)} · ${l.alcance === 'empresa' ? 'De toda la empresa' : 'Solo tuya'} · usada ${l.usos} ${l.usos === 1 ? 'vez' : 'veces'}`}</p>
      {l.estado === 'archivada' ? null : (
        <div className="flex flex-wrap gap-2">
          {l.estado === 'por_revisar' ? <Boton variante="secundario" disabled={ocupado} onClick={() => alAprobar(l.id)}>Aprobar</Boton> : null}
          {l.estado === 'vigente' && l.alcance === 'persona' && puedeCompartir ? <Boton variante="fantasma" disabled={ocupado} onClick={() => alAprobar(l.id, 'empresa')}>Compartir con la empresa</Boton> : null}
          <Boton variante="fantasma" disabled={ocupado} onClick={() => alArchivar(l.id)}>Archivar</Boton>
        </div>
      )}
    </li>
  );
}

/** Lo que el asistente aprendió. Las lecciones que él propone esperan aquí a que una persona las apruebe: hasta entonces no las usa. */
export function ListaDeLecciones({ estado, mensajeDeError, lecciones, puedeCompartir, ocupado, alAprobar, alArchivar, alReintentar }: Props): ReactNode {
  if (estado === 'cargando') return <div aria-busy="true" aria-label="Cargando lo que aprendió" className="flex flex-col gap-2">{[0, 1].map((i) => <Esqueleto key={i} className="h-16 w-full" />)}</div>;
  if (estado === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-control border border-peligro/40 bg-peligro/10 p-3 text-sm">
        <p>{mensajeDeError ?? 'No se pudo cargar.'}</p>
        <Boton variante="secundario" onClick={alReintentar}>Reintentar</Boton>
      </div>
    );
  }
  if (lecciones.length === 0) return <p className="text-sm text-texto-suave">Todavía no aprendió nada. Cuando lo corrijas, lo anotará aquí.</p>;
  return <ul className="flex flex-col gap-2">{lecciones.map((l) => <Fila key={l.id} l={l} puedeCompartir={puedeCompartir} ocupado={ocupado} alAprobar={alAprobar} alArchivar={alArchivar} />)}</ul>;
}
