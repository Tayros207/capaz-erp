import { useId, type ReactNode } from 'react';
import { Boton } from './boton.tsx';
import { useDialogo } from './use-dialogo.ts';

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
  /** Botones de la parte baja (el de cerrar no hace falta: está arriba). */
  acciones?: ReactNode;
};

export function Dialogo({ abierto, alCerrar, titulo, children, acciones }: Props) {
  const ref = useDialogo(abierto, alCerrar);
  const idTitulo = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-tarjeta border border-borde bg-superficie p-0 text-texto shadow-elevada backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[aparecer_160ms_ease-out]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-borde px-5 py-3">
        <h2 id={idTitulo} className="font-titulo text-base font-semibold tracking-tight">
          {titulo}
        </h2>
        <Boton variante="fantasma" icono="cerrar" aria-label="Cerrar" onClick={alCerrar} />
      </div>
      <div className="px-5 py-5">{children}</div>
      {acciones ? <div className="flex flex-wrap justify-end gap-2 border-t border-borde bg-superficie-alta/60 px-5 py-3">{acciones}</div> : null}
    </dialog>
  );
}
