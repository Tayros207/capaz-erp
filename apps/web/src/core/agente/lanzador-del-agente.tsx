import type { ReactNode } from 'react';
import { OrbeDelAsistente } from './orbe-del-asistente.tsx';

// El botón flotante del asistente: su orbe, vivo y con un destello al pasar el cursor. Va en el paquete principal: tiene que ser mínimo,
// el panel se carga después. Móvil: encima de la barra inferior (56 px de barra + 12 px de aire). Escritorio: abajo a la derecha.
const CLASES = [
  'fixed right-4 z-30 grid size-14 cursor-pointer place-items-center rounded-full',
  'bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] md:right-6 md:bottom-6',
  'transition-transform duration-150 hover:scale-105 active:scale-95 print:hidden',
  'motion-safe:animate-[asistente-entra_320ms_cubic-bezier(0.2,0.8,0.2,1)_both]',
].join(' ');

export function LanzadorDelAgente({ abierto, alAbrir }: { abierto: boolean; alAbrir: () => void }): ReactNode {
  if (abierto) return null;
  return (
    <button type="button" onClick={alAbrir} className={CLASES} aria-label="Abrir el asistente" aria-haspopup="dialog" aria-expanded={abierto} title="Asistente (Ctrl+J)">
      <OrbeDelAsistente tamano="size-14" />
    </button>
  );
}
