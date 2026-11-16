import { Toaster } from 'sonner';
import { useTema } from '../estilos/use-tema.ts';

/** Zona de avisos (Sonner): se monta una sola vez, en `Proveedores`. Sigue el tema de la app. */
export function Avisos() {
  const { tema } = useTema();
  return (
    <Toaster
      theme={tema === 'oscuro' ? 'dark' : 'light'}
      position="bottom-center"
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast: '!rounded-tarjeta !border !border-borde !bg-superficie !text-texto !shadow-elevada !font-sans',
          description: '!text-texto-suave',
        },
      }}
    />
  );
}
