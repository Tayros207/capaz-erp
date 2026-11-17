import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CANTIDADES_RAPIDAS } from './logica-precio.ts';

type Props = { unidad: string; cantidad: number | null; error: string | undefined; sePuedeFijar: boolean; alCambiar: (milesimas: number | null) => void; alEnter: () => void };

/** La cantidad y tres atajos (100, 1.000, 5.000: las referencias de la lista) que la fijan de un toque. */
export function CantidadRapida({ unidad, cantidad, error, sePuedeFijar, alCambiar, alEnter }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-64">
        <CampoCantidad etiqueta="Cantidad" valor={cantidad} unidad={unidad} error={error} alCambiar={alCambiar} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); alEnter(); } }} />
      </div>
      {sePuedeFijar ? (
        <div role="group" aria-label="Cantidades de referencia" className="flex gap-2">
          {CANTIDADES_RAPIDAS.map((c) => (
            <Boton key={c} variante={cantidad === c * 1000 ? 'primario' : 'secundario'} aria-pressed={cantidad === c * 1000} onClick={() => alCambiar(c * 1000)}>
              {formatearCantidad(c * 1000)}
            </Boton>
          ))}
        </div>
      ) : null}
    </div>
  );
}
