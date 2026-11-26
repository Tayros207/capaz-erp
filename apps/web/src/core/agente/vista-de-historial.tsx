import type { ReactNode } from 'react';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { TEXTO_DEL_HISTORIAL_VACIO } from './logica-panel.ts';
import { EncabezadoDeVista } from './piezas-de-vista.tsx';

/**
 * El historial de conversaciones. Con el asistente apagado no se guardan conversaciones y solo se ve el estado vacío; con el
 * asistente activo el panel pasa la lista real como `contenido`.
 */
export function VistaDeHistorial({ alVolver, contenido }: { alVolver: () => void; contenido?: ReactNode }): ReactNode {
  return (
    <section aria-label="Historial de conversaciones" className="flex flex-col gap-3">
      <EncabezadoDeVista titulo="Historial" alVolver={alVolver} />
      {contenido ?? (
        <EstadoVacio icono="historial" titulo="Sin conversaciones todavía" descripcion={TEXTO_DEL_HISTORIAL_VACIO} />
      )}
    </section>
  );
}
