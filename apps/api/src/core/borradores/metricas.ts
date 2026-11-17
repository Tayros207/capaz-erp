/** `sinCorregir / (sinCorregir + corregidos + descartados) × 100` con un decimal; `null` sin resueltos. Los pendientes no cuentan. */
export function porcentajeSinCorregir(c: { sinCorregir: number; corregidos: number; descartados: number }): number | null {
  const total = c.sinCorregir + c.corregidos + c.descartados;
  if (total === 0) return null;
  return Math.round((c.sinCorregir / total) * 1000) / 10;
}
