// Entradas de varias líneas con origen (`existencias_recibir`) y lo que propone el consumidor de `compra.recibida`.
// Puras. La base admite UN movimiento por artículo y origen (único parcial): una recepción no suma dos veces.

/** El tipo de origen con el que una entrada recuerda la recepción de compra que la trajo (par blando, R6). */
export const ORIGEN_RECEPCION = 'recepcion';

export type LineaDeRecepcion = { articuloId: string; cantidadMilesimas: number; costoUnitarioMilesimas?: number };

/**
 * Junta las líneas del mismo artículo en una sola, en el orden en que aparece cada artículo por primera vez:
 * suma las cantidades y, como el costo solo es informativo (P3-2), conserva el de la última línea que lo trae.
 */
export function agruparLineas(lineas: readonly LineaDeRecepcion[]): LineaDeRecepcion[] {
  const porArticulo = new Map<string, LineaDeRecepcion>();
  for (const l of lineas) {
    const previa = porArticulo.get(l.articuloId);
    const costo = l.costoUnitarioMilesimas ?? previa?.costoUnitarioMilesimas;
    porArticulo.set(l.articuloId, {
      articuloId: l.articuloId,
      cantidadMilesimas: (previa?.cantidadMilesimas ?? 0) + l.cantidadMilesimas,
      ...(costo !== undefined && { costoUnitarioMilesimas: costo }),
    });
  }
  return [...porArticulo.values()];
}

export type LineaDeCompra = { productoId: string | null; cantidadMilesimas: number; costoUnitarioMilesimas: number };

/**
 * Las líneas de una compra recibida que entran al inventario: solo las de productos con artículo activo
 * (`articulos`: producto → artículo). Sin producto (un gasto) o sin artículo, no entran. Cantidades no positivas, tampoco.
 */
export function lineasParaRecibir(lineas: readonly LineaDeCompra[], articulos: ReadonlyMap<string, string>): LineaDeRecepcion[] {
  const utiles = lineas.flatMap((l) => {
    const articuloId = l.productoId ? articulos.get(l.productoId) : undefined;
    if (!articuloId || l.cantidadMilesimas <= 0) return [];
    return [{ articuloId, cantidadMilesimas: l.cantidadMilesimas, ...(l.costoUnitarioMilesimas >= 0 && { costoUnitarioMilesimas: l.costoUnitarioMilesimas }) }];
  });
  return agruparLineas(utiles);
}

/** Texto de la bandeja para el borrador que propone el consumidor. */
export const resumenDeRecepcion = (lineas: number, numeroDeCompra: string): string =>
  `Entrada al inventario de ${lineas} ${lineas === 1 ? 'artículo' : 'artículos'} por la compra ${numeroDeCompra}`;
