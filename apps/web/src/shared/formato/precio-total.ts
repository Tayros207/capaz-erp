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
