import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTema } from '../shared/estilos/use-tema.ts';
import { clienteDeConsultas } from '../shared/api/cliente-de-consultas.ts';
import { Avisos } from '../shared/ui/avisos.tsx';
import { Confirmaciones } from '../shared/ui/confirmaciones.tsx';

/** Todo lo que debe existir una sola vez: tema, consultas, avisos y confirmaciones. */
export function Proveedores({ children }: { children: ReactNode }) {
  useTema(); // enlaza el tema con el sistema y el almacenamiento desde el primer montaje
  return (
    <QueryClientProvider client={clienteDeConsultas}>
      {children}
      <Avisos />
      <Confirmaciones />
    </QueryClientProvider>
  );
}
