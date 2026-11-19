import { Toaster } from 'sonner';
import { useTema } from '../estilos/use-tema.ts';
import { registrarZonaDeAvisos } from './notificar.ts';

// El contenedor es un «popover» manual: así vive en la capa superior del navegador, igual que los cuadros modales
// (`showModal`). Sin eso, los avisos (errores incluidos) quedaban tapados mientras una hoja o un diálogo estaba abierto.
const ESTILO_DE_LA_ZONA = { position: 'fixed', inset: 0, width: '100%', height: '100%', margin: 0, padding: 0, border: 0, background: 'transparent', overflow: 'visible', pointerEvents: 'none' } as const;

/** Zona de avisos (Sonner): se monta una sola vez, en `Proveedores`. Sigue el tema de la app. */
export function Avisos() {
  const { tema } = useTema();
  return (
    <div ref={registrarZonaDeAvisos} popover="manual" style={ESTILO_DE_LA_ZONA}>
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
    </div>
  );
}
