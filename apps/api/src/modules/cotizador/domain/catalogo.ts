// Del precio del catálogo (con IGV, D17) al precio del Cotizador (sin IGV). Puro; es la única conversión que existe.

/** Si el producto no está afecto, el precio es el mismo; si lo está, `round(milesimas × 100 / (100 + igv))` (mitad hacia arriba). */
export function precioDeCatalogoSinIgv(milesimas: number, afectoIgv: boolean, igvPorcentaje: number): number {
  if (!Number.isSafeInteger(milesimas) || milesimas < 0) throw new RangeError('El precio no es un entero seguro no negativo.');
  if (!Number.isInteger(igvPorcentaje) || igvPorcentaje < 0 || igvPorcentaje > 100) throw new RangeError('El IGV debe ser un entero de 0 a 100.');
  if (!afectoIgv) return milesimas;
  const divisor = BigInt(100 + igvPorcentaje);
  return Number((BigInt(milesimas) * 100n + divisor / 2n) / divisor);
}
