// Unidades de medida que ofrece cada empresa. Puras.
import type { Rechazo } from './precios.js';

export const MAXIMO_DE_UNIDADES = 40;
export const MAXIMO_DE_CARACTERES_DE_UNIDAD = 20;

/** Sin espacios de más (los internos se reducen a uno). Se conservan mayúsculas y tildes que escribió la persona. */
export const normalizarUnidad = (t: string): string => t.normalize('NFC').trim().replace(/\s+/g, ' ');

/** La clave con que se comparan: sin mayúsculas ni tildes. «Millar» y «millár» son la misma unidad. */
export const claveDeUnidad = (t: string): string =>
  normalizarUnidad(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Normaliza cada unidad y valida cantidad, vacíos, largo y repetidos (se conserva el orden y la primera escritura). */
export function validarUnidades(entrada: readonly string[]): { ok: true; unidades: string[] } | Rechazo {
  const mal = (mensaje: string): Rechazo => ({ ok: false, codigo: 'argumentos_invalidos', mensaje });
  const unidades = entrada.map(normalizarUnidad);
  if (unidades.length < 1) return mal('Deja al menos una unidad.');
  if (unidades.length > MAXIMO_DE_UNIDADES) return mal(`Se admiten hasta ${MAXIMO_DE_UNIDADES} unidades.`);
  const vistas = new Set<string>();
  for (const u of unidades) {
    if (u === '') return mal('Una unidad no puede estar vacía.');
    if (u.length > MAXIMO_DE_CARACTERES_DE_UNIDAD) return mal(`La unidad «${u}» pasa de ${MAXIMO_DE_CARACTERES_DE_UNIDAD} caracteres.`);
    const k = claveDeUnidad(u);
    if (vistas.has(k)) return mal(`La unidad «${u}» está repetida.`);
    vistas.add(k);
  }
  return { ok: true, unidades };
}
