/** Columna que se muestra en pantalla angosta: la elegida si existe, si no la primera con filas, si no la primera. */
export function columnaVisible(columnas: ReadonlyArray<{ id: string; filas: readonly unknown[] }>, elegida: string | null): string {
  if (elegida !== null && columnas.some((c) => c.id === elegida)) return elegida;
  return (columnas.find((c) => c.filas.length > 0) ?? columnas[0])?.id ?? '';
}
