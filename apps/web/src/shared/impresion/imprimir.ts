/** Abre el diálogo de impresión del navegador («Guardar como PDF» está ahí). Devuelve si se pudo abrir. */
export function imprimirDocumento(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.print !== 'function') return false;
    window.print();
    return true;
  } catch {
    return false;
  }
}
