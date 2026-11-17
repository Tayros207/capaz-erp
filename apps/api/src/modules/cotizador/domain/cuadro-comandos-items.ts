// Ítems adicionales de UNA cotización (R6 del PRP-007): filas con nombre propio que suman a un factor y se pintan tras otra fila base.
import { normalizarTexto } from './motor/base/texto.js';
import { MAX_ITEMS_DEL_CUADRO, directoVacio, columnaDe, type Directo, type ItemDelCuadro } from './motor/costeo/tipos/cuadro-directo.js';
import type { Cuadro, ResultadoDeComando } from './cuadro-tipos.js';
import { rechazarCuadro } from './cuadro-tipos.js';

type Factor = ItemDelCuadro['factor'];
export type DatosDeItemDeCuadro = { nombre?: string | undefined; factor?: Factor | undefined; despuesDe?: Factor | undefined; fija?: boolean | undefined };

const directoDe = (c: Cuadro): Directo => (c.directo ??= directoVacio(columnaDe(c.trabajo.cantidad)));
const repetido = (d: Directo, nombre: string, salvo?: string) => d.items.some((i) => i.id !== salvo && normalizarTexto(i.nombre) === normalizarTexto(nombre));
const candidata = (i: ItemDelCuadro) => ({ id: i.id, nombre: i.nombre, detalle: i.factor });

export function aplicarAgregarItem(cuadro: Cuadro, a: DatosDeItemDeCuadro & { nombre: string; factor: Factor }): ResultadoDeComando {
  const d = directoDe(cuadro);
  if (d.items.length >= MAX_ITEMS_DEL_CUADRO) return rechazarCuadro('conflicto', `Una cotización admite hasta ${MAX_ITEMS_DEL_CUADRO} ítems adicionales: quita alguno.`);
  if (repetido(d, a.nombre)) return rechazarCuadro('conflicto', `Ya hay un ítem llamado «${a.nombre}» en este cuadro.`);
  const item: ItemDelCuadro = { id: `i${d.siguienteItem}`, nombre: a.nombre, factor: a.factor, despuesDe: a.despuesDe ?? a.factor, celdas: {}, fija: a.fija ?? false };
  d.items.push(item);
  d.siguienteItem += 1;
  return { ok: true, cuadro, avisos: [], linea: candidata(item) };
}

function buscar(d: Directo, ref: string): ItemDelCuadro | ReturnType<typeof rechazarCuadro> {
  const i = d.items.find((x) => x.id === ref) ?? d.items.find((x) => normalizarTexto(x.nombre) === normalizarTexto(ref));
  return i ?? rechazarCuadro('no_encontrado', `No hay un ítem «${ref}» en este cuadro.`);
}

export function aplicarEditarItem(cuadro: Cuadro, ref: string, a: DatosDeItemDeCuadro): ResultadoDeComando {
  const d = directoDe(cuadro);
  const i = buscar(d, ref);
  if ('ok' in i) return i;
  if (a.nombre !== undefined && repetido(d, a.nombre, i.id)) return rechazarCuadro('conflicto', `Ya hay un ítem llamado «${a.nombre}» en este cuadro.`);
  Object.assign(i, { ...(a.nombre !== undefined && { nombre: a.nombre }), ...(a.factor && { factor: a.factor }), ...(a.despuesDe && { despuesDe: a.despuesDe }), ...(a.fija !== undefined && { fija: a.fija }) });
  return { ok: true, cuadro, avisos: [], linea: candidata(i) };
}

export function aplicarQuitarItem(cuadro: Cuadro, ref: string): ResultadoDeComando {
  const d = directoDe(cuadro);
  const i = buscar(d, ref);
  if ('ok' in i) return i;
  d.items = d.items.filter((x) => x.id !== i.id);
  return { ok: true, cuadro, avisos: [], linea: candidata(i) };
}
