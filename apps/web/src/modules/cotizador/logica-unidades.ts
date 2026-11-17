// Edición de la lista de unidades de la empresa (tarjeta «Unidades» de la configuración). Puro; el servidor valida de nuevo.
export const MAXIMO_DE_UNIDADES = 40;
export const MAXIMO_DE_CARACTERES_DE_UNIDAD = 20;

export const normalizarUnidad = (t: string): string => t.normalize('NFC').trim().replace(/\s+/g, ' ');
/** Sin mayúsculas ni tildes: «Millar» y «millár» son la misma unidad. */
export const claveDeUnidad = (t: string): string => normalizarUnidad(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Agrega al final. Con error devuelve el texto para mostrar junto al campo; la lista no cambia. */
export function agregarUnidad(lista: readonly string[], texto: string): { lista: string[] } | { error: string } {
  const u = normalizarUnidad(texto);
  if (u === '') return { error: 'Escribe la unidad.' };
  if (u.length > MAXIMO_DE_CARACTERES_DE_UNIDAD) return { error: `Hasta ${MAXIMO_DE_CARACTERES_DE_UNIDAD} caracteres.` };
  if (lista.some((x) => claveDeUnidad(x) === claveDeUnidad(u))) return { error: 'Esa unidad ya está en la lista.' };
  if (lista.length >= MAXIMO_DE_UNIDADES) return { error: `Hasta ${MAXIMO_DE_UNIDADES} unidades.` };
  return { lista: [...lista, u] };
}

/** Quita una; siempre queda al menos una (si es la única, la lista no cambia). */
export const quitarUnidad = (lista: readonly string[], indice: number): string[] => (lista.length <= 1 ? [...lista] : lista.filter((_, i) => i !== indice));

/** Mueve una posición (`-1` sube, `1` baja); en los bordes no cambia. */
export function moverUnidad(lista: readonly string[], indice: number, paso: -1 | 1): string[] {
  const destino = indice + paso;
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return [...lista];
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
  return copia;
}
