import type { ReactNode } from 'react';
import type { Leccion } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { etiquetaDeEstadoDeLeccion, etiquetaDeOrigenDeLeccion } from './logica-control.ts';
import { CargandoLista, ErrorConReintento, SinNada, TARJETA } from './piezas-de-vista.tsx';

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

const PUNTO: Record<Leccion['estado'], string> = { por_revisar: 'bg-aviso', vigente: 'bg-exito', archivada: 'bg-borde-fuerte' };

function Fila({ l, puedeCompartir, ocupado, alAprobar, alArchivar }: { l: Leccion } & Pick<Props, 'puedeCompartir' | 'ocupado' | 'alAprobar' | 'alArchivar'>): ReactNode {
  return (
    <li className={unir(TARJETA, 'flex flex-col gap-2 p-4', l.estado === 'por_revisar' && 'border-aviso/45!', l.estado === 'archivada' && 'opacity-70')}>
      <p className="text-sm leading-relaxed font-medium break-words text-texto">{l.texto}</p>
      <p className="flex items-start gap-2 text-xs text-texto-suave">
        <span aria-hidden="true" className={unir('mt-1 size-2 shrink-0 rounded-full', PUNTO[l.estado])} />
        <span>{`${etiquetaDeEstadoDeLeccion(l.estado)} · ${etiquetaDeOrigenDeLeccion(l.origen)} · ${l.alcance === 'empresa' ? 'De toda la empresa' : 'Solo tuya'} · usada ${l.usos} ${l.usos === 1 ? 'vez' : 'veces'}`}</span>
      </p>
      {l.estado === 'archivada' ? null : (
        <div className="flex flex-wrap gap-2">
          {l.estado === 'por_revisar' ? <Boton variante="primario" className="rounded-full" disabled={ocupado} onClick={() => alAprobar(l.id)}>Aprobar</Boton> : null}
          {l.estado === 'vigente' && l.alcance === 'persona' && puedeCompartir ? <Boton variante="secundario" className="rounded-full" disabled={ocupado} onClick={() => alAprobar(l.id, 'empresa')}>Compartir con la empresa</Boton> : null}
          <Boton variante="fantasma" className="rounded-full" disabled={ocupado} onClick={() => alArchivar(l.id)}>Archivar</Boton>
        </div>
      )}
    </li>
  );
}

/** Lo que el asistente aprendió. Las lecciones que él propone esperan aquí a que una persona las apruebe: hasta entonces no las usa. */
export function ListaDeLecciones({ estado, mensajeDeError, lecciones, puedeCompartir, ocupado, alAprobar, alArchivar, alReintentar }: Props): ReactNode {
  if (estado === 'cargando') return <CargandoLista etiqueta="Cargando lo que aprendió" />;
  if (estado === 'error') return <ErrorConReintento mensaje={mensajeDeError ?? 'No se pudo cargar.'} alReintentar={alReintentar} />;
  if (lecciones.length === 0) return <SinNada icono="asistente" texto="Todavía no aprendió nada. Cuando lo corrijas, lo anotará aquí." />;
  return <ul className="flex flex-col gap-2">{lecciones.map((l) => <Fila key={l.id} l={l} puedeCompartir={puedeCompartir} ocupado={ocupado} alAprobar={alAprobar} alArchivar={alArchivar} />)}</ul>;
}
