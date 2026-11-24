import type { ReactNode } from 'react';
import { Icono } from '../../shared/ui/icono.tsx';

// El botón flotante del asistente. Va en el paquete principal: tiene que ser mínimo, el panel se carga después.
// Móvil: encima de la barra inferior (56 px de barra + 12 px de aire). Escritorio: abajo a la derecha.
const CLASES = [
  'fixed right-4 z-30 grid size-14 cursor-pointer place-items-center rounded-full',
  'bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] md:right-6 md:bottom-6',
  'bg-accion text-accion-texto shadow-elevada transition-[filter,transform] duration-150',
  'hover:brightness-110 active:scale-95 active:brightness-95 print:hidden',
].join(' ');

export function LanzadorDelAgente({ abierto, alAbrir }: { abierto: boolean; alAbrir: () => void }): ReactNode {
  if (abierto) return null;
  return (
    <button
      type="button"
      onClick={alAbrir}
      className={CLASES}
      aria-label="Abrir el asistente"
      aria-haspopup="dialog"
      aria-expanded={abierto}
      title="Asistente (Ctrl+J)"
    >
      <Icono nombre="asistente" className="size-6" />
    </button>
  );
}
