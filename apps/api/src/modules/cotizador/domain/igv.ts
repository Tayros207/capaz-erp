// IGV de un importe (céntimos), con BigInt y mitad hacia arriba (lejos de cero). Puro.

/** `igv = redondear(importe × igvPorcentaje / 100)`. El IGV se calcula por línea (nunca sobre la suma). */
export function igvDeImporte(importeCentimos: number, igvPorcentaje: number): number {
  if (!Number.isSafeInteger(importeCentimos)) throw new RangeError('El importe no es un entero seguro.');
  if (!Number.isInteger(igvPorcentaje) || igvPorcentaje < 0 || igvPorcentaje > 100) throw new RangeError('El IGV debe ser un entero de 0 a 100.');
  const negativo = importeCentimos < 0;
  const bruto = BigInt(Math.abs(importeCentimos)) * BigInt(igvPorcentaje);
  const redondeado = (bruto + 50n) / 100n;
  return Number(negativo ? -redondeado : redondeado);
}

/** El total de una línea: importe más su IGV. */
export const totalConIgv = (importeCentimos: number, igvPorcentaje: number): number =>
  importeCentimos + igvDeImporte(importeCentimos, igvPorcentaje);
