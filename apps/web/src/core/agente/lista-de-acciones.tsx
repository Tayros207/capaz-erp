import type { ReactNode } from 'react';
import type { AccionDelAgente } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import type { NombreDeIcono } from '../../shared/ui/iconos.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { etiquetaDePolitica, etiquetaDeResultado, fechaCorta, resumenDeArgumentos } from './logica-control.ts';
import { CargandoLista, ErrorConReintento, SinNada, TARJETA } from './piezas-de-vista.tsx';

type Props = {
  estado: 'cargando' | 'error' | 'listo';
  mensajeDeError?: string;
  acciones: readonly AccionDelAgente[];
  titulo: (herramienta: string) => string;
  hayMas: boolean;
  alVerMas: () => void;
  alReintentar: () => void;
};

const MARCA: Record<AccionDelAgente['resultado'], { icono: NombreDeIcono; color: string }> = {
  ok: { icono: 'check', color: 'bg-exito/12 text-exito' },
  rechazada: { icono: 'error', color: 'bg-peligro/12 text-peligro' },
  pendiente_confirmacion: { icono: 'aviso', color: 'bg-aviso/12 text-aviso' },
  propuesta: { icono: 'editar', color: 'bg-info/12 text-info' },
};

/** Los datos técnicos de una acción, plegados: están para quien quiera auditar, sin tapar lo que pasó. */
function Detalles({ a }: { a: AccionDelAgente }): ReactNode {
  const args = resumenDeArgumentos(a.args);
  return (
    <details className="text-xs text-texto-suave">
      <summary className="w-fit cursor-pointer font-medium text-asistente-tinta-2 select-none">Ver detalles</summary>
      <div className="mt-1.5 flex flex-col gap-1 rounded-xl bg-superficie-alta p-2.5 break-words">
        {args ? <p>{args}</p> : null}
        {a.resumenConfirmado ? <p>{a.resumenConfirmado}</p> : null}
        <p>{`Modelo: ${a.modelo}`}</p>
      </div>
    </details>
  );
}

function Fila({ a, titulo }: { a: AccionDelAgente; titulo: string }): ReactNode {
  const marca = MARCA[a.resultado];
  return (
    <li className="flex items-start gap-3 border-t border-borde/70 p-3.5 first:border-t-0">
      <span className={unir('grid size-8 shrink-0 place-items-center rounded-full', marca.color)}><Icono nombre={marca.icono} className="size-4" /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-snug font-semibold text-texto">{titulo}</p>
          <span className="shrink-0 text-xs text-texto-suave tabular-nums">{fechaCorta(a.creadoEn)}</span>
        </div>
        <p className="text-xs text-texto-suave">{`${etiquetaDeResultado(a.resultado)} · ${etiquetaDePolitica(a.politica)}${a.codigo ? ` · ${a.codigo}` : ''}`}</p>
        <Detalles a={a} />
      </div>
    </li>
  );
}

/** Lo que hizo, propuso o intentó el asistente: la huella para que una persona evalúe si actuó bien. */
export function ListaDeAcciones({ estado, mensajeDeError, acciones, titulo, hayMas, alVerMas, alReintentar }: Props): ReactNode {
  if (estado === 'cargando') return <CargandoLista etiqueta="Cargando lo que hizo el asistente" />;
  if (estado === 'error') return <ErrorConReintento mensaje={mensajeDeError ?? 'No se pudo cargar.'} alReintentar={alReintentar} />;
  if (acciones.length === 0) return <SinNada icono="historial" texto="Todavía no hizo nada." />;
  return (
    <div className="flex flex-col gap-2">
      <ul className={unir(TARJETA, 'overflow-hidden')}>{acciones.map((a) => <Fila key={a.id} a={a} titulo={titulo(a.herramienta)} />)}</ul>
      {hayMas ? <Boton variante="secundario" className="rounded-full" onClick={alVerMas}>Ver más</Boton> : null}
    </div>
  );
}
