import { toast } from 'sonner';

export type TipoDeAviso = 'exito' | 'info' | 'aviso' | 'error';

/**
 * Muestra un aviso breve. Fachada de Sonner: es el único sistema de avisos de la app, así que los
 * módulos solo llaman a `notificar` (no a `toast`). Lo dibuja `<Avisos />`, montado una vez en `Proveedores`.
 */
export function notificar(mensaje: string, tipo: TipoDeAviso = 'info'): void {
  if (tipo === 'exito') toast.success(mensaje);
  else if (tipo === 'error') toast.error(mensaje);
  else if (tipo === 'aviso') toast.warning(mensaje);
  else toast.info(mensaje);
}
