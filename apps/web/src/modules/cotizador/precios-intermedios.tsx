import { useState } from 'react';
import type { FilaDePrecioDto } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { soles } from './logica.ts';

/** Los precios del lote a las cantidades frecuentes (con el ajuste del cliente y el redondeo). Plegable: se lee de un vistazo. */
export function PreciosIntermedios({ tabla, cantidadActual, conIgv }: { tabla: readonly FilaDePrecioDto[]; cantidadActual: number; conIgv: boolean }) {
  const [abierta, setAbierta] = useState(false);
  if (tabla.length === 0) return null;
  return (
    <section aria-label="Precios por cantidad" className="flex flex-col gap-2">
      <button type="button" aria-expanded={abierta} onClick={() => setAbierta((a) => !a)} className="w-fit cursor-pointer text-sm font-medium text-accion underline-offset-2 hover:underline">
        {abierta ? 'Ocultar precios por cantidad' : 'Ver precios por cantidad'}
      </button>
      {abierta ? (
        <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
          <table className="w-full min-w-96 text-sm">
            <caption className="sr-only">{conIgv ? 'Precios del lote por cantidad, sin IGV y con IGV' : 'Precios del lote por cantidad'}</caption>
            <thead>
              <tr className="text-left text-texto-suave">
                <th scope="col" className="px-3 py-2 font-medium">Cantidad</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{conIgv ? 'Sin IGV' : 'Precio'}</th>
                {conIgv ? <th scope="col" className="px-3 py-2 text-right font-medium">Con IGV</th> : null}
                <th scope="col" className="px-3 py-2 text-right font-medium">Cada una</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {tabla.map((f) => (
                <tr key={f.cantidadMilesimas} aria-current={f.cantidadMilesimas === cantidadActual ? 'true' : undefined} className={f.cantidadMilesimas === cantidadActual ? 'bg-superficie-alta' : undefined}>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-texto-suave">{formatearCantidad(f.cantidadMilesimas)}</th>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-texto">{soles(f.importeCentimos)}</td>
                  {conIgv ? <td className="px-3 py-2 text-right tabular-nums text-texto">{soles(f.totalCentimos)}</td> : null}
                  <td className="px-3 py-2 text-right tabular-nums text-texto-suave">S/ {milesimasATexto(f.precioUnitarioMilesimas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
