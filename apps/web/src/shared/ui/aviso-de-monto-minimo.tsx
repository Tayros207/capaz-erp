import { faltaParaElMinimo, formatearSoles } from '@capaz/shared';
import { useMontoMinimo } from '../api/use-monto-minimo.ts';

/**
 * Aviso (nunca bloquea) cuando un trabajo suma menos del mínimo por trabajo. Se calla con total en cero (aún no hay trabajo),
 * cuando ya llega al mínimo o cuando el mínimo es 0 (aviso apagado). El total va con IGV incluido.
 */
export function AvisoDeMontoMinimoFijo({ totalCentimos, minimoCentimos }: { totalCentimos: number; minimoCentimos: number }) {
  if (minimoCentimos <= 0 || faltaParaElMinimo(totalCentimos, minimoCentimos) === 0) return null;
  const minimo = formatearSoles(minimoCentimos);
  return (
    <p role="status" className="rounded-control border border-borde bg-superficie-alta px-3 py-2 text-sm text-texto">
      Este trabajo suma {formatearSoles(totalCentimos)}, menos que el mínimo de {minimo} por trabajo. Los trabajos chicos ocupan el taller igual: considera cobrar al menos {minimo}.
    </p>
  );
}

/** Lee el mínimo de la empresa (con caché) y avisa si el trabajo no lo alcanza. Mientras carga, no avisa. */
export function AvisoDeMontoMinimo({ totalCentimos }: { totalCentimos: number }) {
  const minimoCentimos = useMontoMinimo();
  if (minimoCentimos === null) return null;
  return <AvisoDeMontoMinimoFijo totalCentimos={totalCentimos} minimoCentimos={minimoCentimos} />;
}
