import { notificar } from '../../shared/ui/notificar.ts';

/** Copia un texto; si el navegador no deja, el campo de solo lectura permite copiarlo a mano. */
export async function copiarTexto(texto: string, mensaje: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    notificar(mensaje, 'exito');
  } catch {
    notificar('No se pudo copiar solo: selecciona el texto y cópialo.', 'aviso');
  }
}

/** Entrega un texto como archivo descargable (con BOM para que Excel lea bien las tildes). */
export function descargarTexto(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
