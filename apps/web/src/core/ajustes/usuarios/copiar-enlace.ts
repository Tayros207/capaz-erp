import { notificar } from '../../../shared/ui/notificar.ts';

/** Copia el enlace; si el navegador no deja, el campo de solo lectura permite copiarlo a mano. */
export async function copiarEnlace(enlace: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(enlace);
    notificar('Enlace copiado.', 'exito');
  } catch {
    notificar('No se pudo copiar solo: selecciona el enlace y cópialo.', 'aviso');
  }
}
