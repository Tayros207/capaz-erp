import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from './boton.tsx';
import { useDialogo } from './use-dialogo.ts';

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  /** Más ancha en pantallas grandes, para contenido en tabla (p. ej. las filas de un pedido). */
  ancha?: boolean;
  /** Barra fija al pie, fuera del desplazamiento (p. ej. el total y los botones de un formulario largo). */
  pie?: ReactNode;
  /** Casi toda la altura de la pantalla, con el contenido desplazándose por dentro. Pensada para formularios largos en el móvil. */
  alta?: boolean;
  children: ReactNode;
};

/** Panel que sube desde abajo (pensado para el móvil); en pantallas anchas queda centrado y acotado. */
export function HojaInferior({ abierto, alCerrar, titulo, ancha = false, pie, alta = false, children }: Props) {
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
      className={`mx-auto mt-auto mb-0 ${alta ? 'h-[94dvh] max-h-[94dvh] open:flex open:flex-col' : pie ? 'max-h-[90dvh] open:flex open:flex-col' : 'max-h-[85dvh]'} w-full ${ancha ? 'max-w-5xl' : 'max-w-xl'} rounded-t-tarjeta border border-borde bg-superficie p-0 text-texto shadow-elevada backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[subir_200ms_cubic-bezier(0.22,1,0.36,1)]`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-borde px-5 py-3">
        <h2 id={idTitulo} className="font-titulo text-base font-semibold tracking-tight">
          {titulo}
        </h2>
        <Boton variante="fantasma" icono="cerrar" aria-label="Cerrar" onClick={alCerrar} />
      </div>
      <div className={pie ? 'min-h-0 flex-1 overflow-y-auto px-5 py-4' : 'overflow-y-auto px-5 py-5 pb-[max(1rem,env(safe-area-inset-bottom))]'}>{children}</div>
      {pie ? <div className="border-t border-borde bg-superficie px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{pie}</div> : null}
    </dialog>,
    document.body,
  );
}
