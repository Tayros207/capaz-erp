import { sumarDias, type CostoPorArticuloDto, type CostoPorProveedorDto } from '@capaz/shared';

// Comparador de costos (F2-5): agrupa las líneas de órdenes ya enviadas por artículo y calcula último costo,
// mediana, mínimo, máximo y variación. Funciones puras; los costos son milésimas de sol por unidad, con IGV.

export const MAXIMO_DE_LINEAS_DE_COSTOS = 5_000;
export const MAXIMO_DE_ARTICULOS_DE_COSTOS = 200;
export const DIAS_POR_DEFECTO_DE_COSTOS = 365;
export const MAXIMO_DE_DIAS_DE_COSTOS = 730;

/** Una línea de una orden enviada o recibida; `fecha` es la de la orden. */
export type LineaDeCosto = {
  productoId: string | null;
  descripcion: string;
  unidad: string;
  costoUnitarioMilesimas: number;
  fecha: string;
  proveedorId: string;
  proveedorNombre: string;
};

/** Minúsculas, sin tildes y con los espacios colapsados: «Papel  BOND» y «papel bond» son el mismo artículo. */
export const normalizarDescripcion = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const claveDeArticulo = (l: Pick<LineaDeCosto, 'productoId' | 'descripcion' | 'unidad'>): string =>
  `${l.productoId ? `p:${l.productoId}` : `d:${normalizarDescripcion(l.descripcion)}`}|${normalizarDescripcion(l.unidad)}`;

/** Mediana entera: con cantidad par, el promedio de los dos del medio, mitad hacia arriba. */
export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) throw new RangeError('No hay valores.');
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 1 ? orden[medio]! : Math.round((orden[medio - 1]! + orden[medio]!) / 2);
}

/** (último − mediana) × 100 / mediana, redondeado; `null` si la mediana es cero. */
export function variacionPorcentaje(ultimo: number, medianaDelArticulo: number): number | null {
  if (medianaDelArticulo <= 0) return null;
  return Math.round(((ultimo - medianaDelArticulo) * 100) / medianaDelArticulo);
}

export type PeriodoDeCostos = { desde: string; hasta: string };

/** Completa el período (por defecto, los últimos 365 días) o devuelve el motivo del rechazo. */
export function resolverPeriodoDeCostos(entrada: { desde?: string; hasta?: string }, hoy: string): PeriodoDeCostos | { error: string } {
  const hasta = entrada.hasta ?? hoy;
  const desde = entrada.desde ?? sumarDias(hasta, -DIAS_POR_DEFECTO_DE_COSTOS);
  if (desde > hasta) return { error: 'El período empieza antes de terminar.' };
  if (sumarDias(desde, MAXIMO_DE_DIAS_DE_COSTOS) < hasta) return { error: 'El período abarca como máximo 2 años.' };
  return { desde, hasta };
}

/** A igual fecha gana la que llegó después (las líneas llegan de la más antigua a la más nueva). */
const masNueva = (a: LineaDeCosto, b: LineaDeCosto): boolean => a.fecha >= b.fecha;

function porProveedor(lineas: readonly LineaDeCosto[]): CostoPorProveedorDto[] {
  const grupos = new Map<string, LineaDeCosto[]>();
  for (const l of lineas) grupos.set(l.proveedorId, [...(grupos.get(l.proveedorId) ?? []), l]);
  return [...grupos.values()]
    .map((g) => {
      const ultima = g.reduce((u, l) => (masNueva(l, u) ? l : u));
      const costos = g.map((l) => l.costoUnitarioMilesimas);
      return {
        proveedorId: ultima.proveedorId,
        proveedorNombre: ultima.proveedorNombre,
        compras: g.length,
        ultimoCostoMilesimas: ultima.costoUnitarioMilesimas,
        ultimaFecha: ultima.fecha,
        medianaMilesimas: mediana(costos),
        minimoMilesimas: Math.min(...costos),
      };
    })
    .sort((a, b) => a.ultimoCostoMilesimas - b.ultimoCostoMilesimas || (a.ultimaFecha < b.ultimaFecha ? 1 : -1));
}

/**
 * Se queda con los `tope` artículos de compra más reciente (no con los primeros del orden alfabético) y los devuelve en
 * orden alfabético. `truncado` es verdadero si había más.
 */
export function recortarArticulos(articulos: readonly CostoPorArticuloDto[], tope = MAXIMO_DE_ARTICULOS_DE_COSTOS): { articulos: CostoPorArticuloDto[]; truncado: boolean } {
  if (articulos.length <= tope) return { articulos: [...articulos], truncado: false };
  const recientes = [...articulos].sort((a, b) => (a.ultimaFecha < b.ultimaFecha ? 1 : a.ultimaFecha > b.ultimaFecha ? -1 : 0) || a.descripcion.localeCompare(b.descripcion, 'es') || a.clave.localeCompare(b.clave)).slice(0, tope);
  return { articulos: recientes.sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es') || a.clave.localeCompare(b.clave)), truncado: true };
}

/**
 * Agrupa por producto y unidad o, sin producto, por descripción normalizada y unidad. `lineas` llega de la más
 * antigua a la más nueva (a igual fecha, manda el orden de llegada). El más barato es el proveedor con menor
 * último costo; con un solo proveedor no hay con quién comparar y es `null`. Salida ordenada por descripción.
 */
export function agruparCostos(lineas: readonly LineaDeCosto[]): CostoPorArticuloDto[] {
  const grupos = new Map<string, LineaDeCosto[]>();
  for (const l of lineas) {
    const clave = claveDeArticulo(l);
    grupos.set(clave, [...(grupos.get(clave) ?? []), l]);
  }
  return [...grupos.entries()]
    .map(([clave, g]) => {
      const ultima = g.reduce((u, l) => (masNueva(l, u) ? l : u));
      const costos = g.map((l) => l.costoUnitarioMilesimas);
      const med = mediana(costos);
      const proveedores = porProveedor(g);
      return {
        clave,
        productoId: ultima.productoId,
        descripcion: ultima.descripcion,
        unidad: ultima.unidad,
        compras: g.length,
        ultimoCostoMilesimas: ultima.costoUnitarioMilesimas,
        ultimaFecha: ultima.fecha,
        ultimoProveedorId: ultima.proveedorId,
        ultimoProveedorNombre: ultima.proveedorNombre,
        medianaMilesimas: med,
        minimoMilesimas: Math.min(...costos),
        maximoMilesimas: Math.max(...costos),
        variacionPorcentaje: variacionPorcentaje(ultima.costoUnitarioMilesimas, med),
        masBaratoProveedorId: proveedores.length > 1 ? proveedores[0]!.proveedorId : null,
        porProveedor: proveedores,
      };
    })
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es') || a.clave.localeCompare(b.clave));
}
