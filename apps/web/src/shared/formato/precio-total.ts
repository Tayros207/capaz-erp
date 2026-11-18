import { importe } from '@capaz/shared';

/** Lo que resulta de repartir un precio total entre una cantidad. */
export type UnitarioDeTotal = {
  /** Precio de una unidad en milésimas de sol, entero (regla 9). */
  precioUnitarioMilesimas: number;
  /** Lo que da cantidad × ese unitario, en céntimos, con la misma cuenta del servidor. */
  importeCentimos: number;
  /** `false` cuando el unitario, que solo guarda tres decimales, no reproduce el total tecleado al céntimo. */
  exacto: boolean;
};

/**
 * El precio total de un trabajo y su cantidad → el precio unitario (milésimas, mitad hacia arriba). La cuenta es
 * unitario = total × 10 000 ÷ cantidad, la inversa de `importe`. Nulo si falta un dato, la cantidad no es positiva
 * o el resultado no cabe.
 */
export function unitarioDeTotal(totalCentimos: number | null, cantidadMilesimas: number | null): UnitarioDeTotal | null {
  if (totalCentimos === null || cantidadMilesimas === null) return null;
  if (!Number.isSafeInteger(totalCentimos) || !Number.isSafeInteger(cantidadMilesimas) || totalCentimos < 0 || cantidadMilesimas <= 0) return null;
  const cantidad = BigInt(cantidadMilesimas);
  const unitario = (2n * BigInt(totalCentimos) * 10_000n + cantidad) / (2n * cantidad);
  if (unitario > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const precioUnitarioMilesimas = Number(unitario);
  try {
    const importeCentimos = importe(cantidadMilesimas, precioUnitarioMilesimas);
    return { precioUnitarioMilesimas, importeCentimos, exacto: importeCentimos === totalCentimos };
  } catch {
    return null;
  }
}

/** Qué resulta de una fila donde se puede escribir el precio unitario o el importe: lo último escrito manda. */
export type PrecioEImporte = {
  /** Unitario en milésimas (el que se guarda); nulo si todavía no hay con qué calcularlo. */
  precioUnitarioMilesimas: number | null;
  /** Lo que da cantidad × unitario, en céntimos, con la cuenta del servidor; nulo si falta un dato. */
  importeCentimos: number | null;
  /** `false` cuando el unitario (tres decimales) no reproduce el importe escrito al céntimo. */
  exacto: boolean;
};

/**
 * Precio unitario e importe de una fila. Si manda el precio, el importe es cantidad × precio; si manda el importe,
 * el unitario sale de repartirlo entre la cantidad (`unitarioDeTotal`) y el importe mostrado es el que da ese unitario.
 */
export function resolverPrecioEImporte(
  cantidadMilesimas: number | null,
  precioUnitarioMilesimas: number | null,
  importeEscritoCentimos: number | null,
  manda: 'precio' | 'importe',
): PrecioEImporte {
  if (manda === 'importe') {
    const r = unitarioDeTotal(importeEscritoCentimos, cantidadMilesimas);
    if (r) return { precioUnitarioMilesimas: r.precioUnitarioMilesimas, importeCentimos: r.importeCentimos, exacto: r.exacto };
    return { precioUnitarioMilesimas: null, importeCentimos: importeEscritoCentimos, exacto: true };
  }
  if (precioUnitarioMilesimas === null || cantidadMilesimas === null || cantidadMilesimas <= 0) return { precioUnitarioMilesimas, importeCentimos: null, exacto: true };
  try {
    return { precioUnitarioMilesimas, importeCentimos: importe(cantidadMilesimas, precioUnitarioMilesimas), exacto: true };
  } catch {
    return { precioUnitarioMilesimas, importeCentimos: null, exacto: true };
  }
}
