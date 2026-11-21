import type { Centimos, LineaDeMovimientoDto } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';

/** Los productos de un movimiento: qué, cuánto, a qué precio y cuánto suma cada uno. En móvil cada producto es una tarjeta. */
export function ProductosDelMovimiento({ lineas }: { lineas: readonly LineaDeMovimientoDto[] }) {
  if (lineas.length === 0) return null;
  const total = lineas.reduce((suma, l) => suma + l.subtotalCentimos, 0);
  return (
    <section aria-label="Productos" className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-texto">Productos</h2>
      <ul className="flex flex-col divide-y divide-borde rounded-control border border-borde">
        {lineas.map((l) => (
          <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
            <span className="min-w-0 font-medium">{l.descripcion}</span>
            <span className="text-sm tabular-nums text-texto-suave">
              {formatearCantidad(l.cantidadMilesimas, l.unidad)} × S/ {milesimasATexto(l.precioUnitarioMilesimas)}
            </span>
            <span className="font-medium tabular-nums">{formatearSoles(l.subtotalCentimos as Centimos)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-4 bg-superficie-alta px-3 py-2">
          <span className="text-sm text-texto-suave">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatearSoles(total as Centimos)}</span>
        </li>
      </ul>
    </section>
  );
}
