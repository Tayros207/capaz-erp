// Cómo se encuentra y se ordena una fila del cuadro: por id, por número («fila 3») o por texto, sin adivinar entre varias.
import type { Candidata, ReferenciaDeFila } from '@capaz/shared';
import { normalizarTexto } from './motor/base/texto.js';
import { ETIQUETA_DE_FACTOR } from './motor/costeo/constantes/factores.js';
import { FACTORES, type Factor } from './motor/base/dominio.js';
import type { Cuadro, Linea } from './cuadro-tipos.js';
import { avisoComercial, rechazarCuadro } from './cuadro-tipos.js';

type Coincidencia<T> = { tipo: 'unica'; item: T } | { tipo: 'ninguna' } | { tipo: 'ambigua'; candidatas: T[] };

/** Si un solo elemento tiene exactamente ese nombre, es ese; si no, cuentan los que lo contienen. Varios: no elige. */
function buscarPorTexto<T>(items: readonly T[], texto: string, textosDe: (item: T) => string[]): Coincidencia<T> {
  const buscado = normalizarTexto(texto);
  const exactas = items.filter((i) => normalizarTexto(textosDe(i)[0] ?? '') === buscado);
  const conjunto = exactas.length > 0 ? exactas : items.filter((i) => textosDe(i).some((t) => normalizarTexto(t).includes(buscado)));
  if (conjunto.length === 0) return { tipo: 'ninguna' };
  const [primera] = conjunto;
  return conjunto.length === 1 && primera ? { tipo: 'unica', item: primera } : { tipo: 'ambigua', candidatas: conjunto };
}

/** Una fila para elegir entre varias: su número es su posición en el cuadro. Nunca lleva el costo. */
export const candidataDeLinea = (l: Linea, numero: number): Candidata => ({ id: l.id, numero, nombre: l.descripcion, detalle: ETIQUETA_DE_FACTOR[l.factor] });

export type LineaResuelta = { ok: true; linea: Linea; indice: number } | ReturnType<typeof rechazarCuadro>;

/** Resuelve una fila por id, por número o por texto de su descripción (o del nombre de su factor). */
export function resolverLinea(lineas: readonly Linea[], ref: ReferenciaDeFila): LineaResuelta {
  const NO = rechazarCuadro('no_encontrado', 'No encontré esa fila en el cuadro.');
  if ('id' in ref) {
    const indice = lineas.findIndex((l) => l.id === ref.id);
    const linea = lineas[indice];
    return linea ? { ok: true, linea, indice } : NO;
  }
  if ('numero' in ref) {
    const linea = lineas[ref.numero - 1];
    return linea ? { ok: true, linea, indice: ref.numero - 1 } : NO;
  }
  const c = buscarPorTexto(lineas, ref.texto, (l) => [l.descripcion, ETIQUETA_DE_FACTOR[l.factor]]);
  if (c.tipo === 'ninguna') return NO;
  if (c.tipo === 'unica') return { ok: true, linea: c.item, indice: lineas.indexOf(c.item) };
  const candidatas = c.candidatas.map((l) => candidataDeLinea(l, lineas.indexOf(l) + 1));
  return rechazarCuadro('conflicto', `Hay ${candidatas.length} filas que coinciden: indica cuál, por su número.`, candidatas);
}

/** Inserta la fila al final de su factor: el cuadro va agrupado por factor y «fila 3» es la tercera de la lista. */
export function insertarLinea(lineas: readonly Linea[], nueva: Linea): Linea[] {
  const orden = (f: Factor) => FACTORES.indexOf(f);
  let posicion = 0;
  lineas.forEach((l, i) => {
    if (orden(l.factor) <= orden(nueva.factor)) posicion = i + 1;
  });
  return [...lineas.slice(0, posicion), nueva, ...lineas.slice(posicion)];
}

/** Si la fila la mantenía el motor (papel o planchas), la suelta: desde ahora es manual. */
export function soltarSiEsAutomatica(cuadro: Cuadro, id: string): 'papel' | 'planchas' | null {
  if (cuadro.automaticas.papel === id) {
    cuadro.automaticas.papel = null;
    return 'papel';
  }
  if (cuadro.automaticas.planchas === id) {
    cuadro.automaticas.planchas = null;
    return 'planchas';
  }
  return null;
}

export const avisoDeFilaManual = (descripcion: string, cual: 'papel' | 'planchas') =>
  avisoComercial(
    'fila_manual',
    cual === 'papel' ? `La fila «${descripcion}» ahora es manual: ya no sigue a la imposición.` : `La fila «${descripcion}» ahora es manual: ya no sigue a tintas × caras.`,
  );
