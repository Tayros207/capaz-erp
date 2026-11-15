import type { ReactNode } from 'react';
import { useTema } from '../shared/estilos/use-tema.ts';
import { Avisos } from '../shared/ui/avisos.tsx';
import { Confirmaciones } from '../shared/ui/confirmaciones.tsx';

/** Todo lo que debe existir una sola vez: tema, avisos y confirmaciones. */
export function Proveedores({ children }: { children: ReactNode }) {
  useTema(); // enlaza el tema con el sistema y el almacenamiento desde el primer montaje
  return (
    <>
      {children}
      <Avisos />
      <Confirmaciones />
    </>
  );
}
