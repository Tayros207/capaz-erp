import { toast } from 'sonner';

let zona: HTMLElement | null = null;

/** La zona de avisos se registra al montarse (`Avisos`); `null` al desmontarse. */
export function registrarZonaDeAvisos(el: HTMLElement | null): void {
  zona = el;
}

/** Sube la zona de avisos a lo más alto de la capa superior: lo último que entra a esa capa queda encima de un diálogo abierto. */
function subirZona(): void {
  if (!zona || typeof zona.showPopover !== 'function') return;
  try {
    if (zona.matches(':popover-open')) zona.hidePopover();
    zona.showPopover();
  } catch {
    // Sin soporte de popover el aviso se muestra como siempre.
  }
}

export type TipoDeAviso = 'exito' | 'info' | 'aviso' | 'error';

/**
 * Muestra un aviso breve. Fachada de Sonner: es el único sistema de avisos de la app, así que los
 * módulos solo llaman a `notificar` (no a `toast`). Lo dibuja `<Avisos />`, montado una vez en `Proveedores`.
 */
export function notificar(mensaje: string, tipo: TipoDeAviso = 'info'): void {
  subirZona();
  if (tipo === 'exito') toast.success(mensaje);
  else if (tipo === 'error') toast.error(mensaje);
  else if (tipo === 'aviso') toast.warning(mensaje);
  else toast.info(mensaje);
}
