import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from './boton.tsx';
import { useDialogo } from './use-dialogo.ts';

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
};

/** Panel que sube desde abajo (pensado para el móvil); en pantallas anchas queda centrado y acotado. */
export function HojaInferior({ abierto, alCerrar, titulo, children }: Props) {
  const ref = useDialogo(abierto, alCerrar);
  const idTitulo = useId();
  // Va a `document.body`: si la hoja se abre desde dentro de un formulario, su propio <form> no queda anidado en el de la
  // pantalla (un <form> dentro de otro es HTML inválido y el navegador no envía el interno). Y como los eventos de un portal
  // suben por el árbol de React, el envío se corta aquí para que no active el formulario de la pantalla.
  return createPortal(
    <dialog
      onSubmit={(e) => e.stopPropagation()}
      ref={ref}
      aria-labelledby={idTitulo}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
      className="mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-xl rounded-t-tarjeta border border-borde bg-superficie p-0 text-texto shadow-elevada backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[subir_200ms_cubic-bezier(0.22,1,0.36,1)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-borde px-5 py-3">
        <h2 id={idTitulo} className="font-titulo text-base font-semibold tracking-tight">
          {titulo}
        </h2>
        <Boton variante="fantasma" icono="cerrar" aria-label="Cerrar" onClick={alCerrar} />
      </div>
      <div className="overflow-y-auto px-5 py-5 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>,
    document.body,
  );
}
