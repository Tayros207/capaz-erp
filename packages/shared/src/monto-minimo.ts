// Monto mínimo por trabajo: solo un aviso, nunca bloquea. Dinero en céntimos enteros, IGV incluido.

/** S/ 40.00 por pedido o cotización completa. */
export const MONTO_MINIMO_POR_TRABAJO_CENTIMOS = 4000;

/** Tope configurable: S/ 100,000.00 (igual que la restricción de `core.empresa_config`). */
export const MAXIMO_MONTO_MINIMO_CENTIMOS = 10_000_000;

/** Mínimo vigente: `null` = el de fábrica; `0` = aviso apagado. */
export function montoMinimoEfectivo(valorConfigurado: number | null | undefined): number {
  return valorConfigurado ?? MONTO_MINIMO_POR_TRABAJO_CENTIMOS;
}

/** Lo que falta para llegar al mínimo; 0 si el total es cero o negativo (aún no hay trabajo) o ya llega. */
export function faltaParaElMinimo(totalCentimos: number, minimoCentimos: number = MONTO_MINIMO_POR_TRABAJO_CENTIMOS): number {
  if (totalCentimos <= 0 || totalCentimos >= minimoCentimos) return 0;
  return minimoCentimos - totalCentimos;
}
