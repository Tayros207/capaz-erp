// Reglas puras de las etapas del embudo (FICHAS-OLA-2 §5.2, reglas 2, 3 y 6). Sin base ni framework.

export type TipoDeEtapa = 'abierta' | 'ganada' | 'perdida';
export type EtapaViva = { id: string; tipo: TipoDeEtapa; orden: number; archivada: boolean };

/** Etapas con las que empieza toda empresa. Las dos de cierre van siempre al final. */
export const ETAPAS_POR_DEFECTO: ReadonlyArray<{ nombre: string; orden: number; tipo: TipoDeEtapa }> = [
  { nombre: 'Nuevo', orden: 0, tipo: 'abierta' },
  { nombre: 'Contactado', orden: 1, tipo: 'abierta' },
  { nombre: 'Propuesta enviada', orden: 2, tipo: 'abierta' },
  { nombre: 'Negociación', orden: 3, tipo: 'abierta' },
  { nombre: 'Ganada', orden: 4, tipo: 'ganada' },
  { nombre: 'Perdida', orden: 5, tipo: 'perdida' },
];

const porOrden = (a: EtapaViva, b: EtapaViva) => a.orden - b.orden || a.id.localeCompare(b.id);

/** Las abiertas sin archivar, en su orden. */
export const abiertasVivas = (etapas: readonly EtapaViva[]): EtapaViva[] => etapas.filter((e) => e.tipo === 'abierta' && !e.archivada).sort(porOrden);

/** Donde entra una oportunidad nueva o reabierta: la primera abierta por `orden`. */
export const primeraAbierta = (etapas: readonly EtapaViva[]): EtapaViva | null => abiertasVivas(etapas)[0] ?? null;

/**
 * Orden completo a guardar: las abiertas en el orden dado (0, 1, …) y después las de cierre vivas
 * (ganada, luego perdida). Las archivadas no se tocan.
 */
export function numerar(abiertasEnOrden: readonly string[], etapas: readonly EtapaViva[]): Array<{ id: string; orden: number }> {
  const cierre = etapas
    .filter((e) => e.tipo !== 'abierta' && !e.archivada)
    .sort((a, b) => (a.tipo === b.tipo ? porOrden(a, b) : a.tipo === 'ganada' ? -1 : 1));
  return [...abiertasEnOrden, ...cierre.map((e) => e.id)].map((id, orden) => ({ id, orden }));
}

/** `etapas_ordenar` recibe exactamente las abiertas vivas, sin repetir. Devuelve el problema o `null`. */
export function problemaDeOrden(ids: readonly string[], etapas: readonly EtapaViva[]): string | null {
  const esperadas = new Set(abiertasVivas(etapas).map((e) => e.id));
  if (new Set(ids).size !== ids.length) return 'Una etapa aparece dos veces.';
  const falta = [...esperadas].some((id) => !ids.includes(id));
  const sobra = ids.some((id) => !esperadas.has(id));
  if (falta || sobra) return 'Envía todas las etapas abiertas, cada una una vez y sin las de cierre ni las archivadas.';
  return null;
}

/** Por qué no se puede archivar una etapa, o `null` si se puede. */
export function problemaParaArchivar(etapa: EtapaViva, etapas: readonly EtapaViva[], oportunidadesAbiertas: number): string | null {
  if (etapa.tipo !== 'abierta') return 'Las etapas de cierre («ganada» y «perdida») no se archivan; sí se pueden renombrar.';
  if (oportunidadesAbiertas > 0) {
    return oportunidadesAbiertas === 1
      ? 'Queda 1 oportunidad abierta en esta etapa: muévela antes de archivarla.'
      : `Quedan ${oportunidadesAbiertas} oportunidades abiertas en esta etapa: muévelas antes de archivarla.`;
  }
  if (abiertasVivas(etapas).length <= 1) return 'Es la única etapa abierta: crea otra antes de archivarla.';
  return null;
}
