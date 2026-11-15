import { alternarSeleccion } from './logica-lista.ts';
import { CasillaDeSeleccion } from './casilla-de-seleccion.tsx';
import type { PropsDeLista } from './lista-tipos.ts';
import { unir } from '../unir.ts';

/** Vista móvil de `Lista` (menos de 640 px): una tarjeta por fila con los datos en el mismo orden que las columnas. */
export function ListaTarjetas<T>({ columnas, filas, clave, etiqueta, seleccion, onSeleccion, onAbrir }: PropsDeLista<T>) {
  const principal = columnas.find((c) => c.principal);
  const resto = columnas.filter((c) => c !== principal);
  return (
    <ul aria-label={etiqueta} className="flex flex-col gap-2 sm:hidden">
      {filas.map((fila) => {
        const id = clave(fila);
        const marcada = !!seleccion?.has(id);
        return (
          <li key={id} className={unir('flex items-start gap-1 rounded-tarjeta border bg-superficie p-3', marcada ? 'border-info bg-info/10' : 'border-borde')}>
            {seleccion && onSeleccion ? (
              <div className="-ml-2 -mt-1">
                <CasillaDeSeleccion etiqueta={`Seleccionar fila ${id}`} marcada={marcada} onCambio={() => onSeleccion(alternarSeleccion(seleccion, id))} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              {principal ? (
                <div className="mb-2 font-semibold text-texto">
                  {onAbrir ? (
                    <button type="button" onClick={() => onAbrir(fila)} className="min-h-(--alto-control) w-full cursor-pointer text-left font-semibold">
                      {principal.celda(fila)}
                    </button>
                  ) : (
                    principal.celda(fila)
                  )}
                </div>
              ) : null}
              <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1 text-sm">
                {resto.map((c) => (
                  <div key={c.id} className="col-span-2 grid grid-cols-subgrid">
                    <dt className="text-texto-suave">{c.titulo}</dt>
                    <dd className={unir('min-w-0 break-words text-texto', c.alinear === 'derecha' && 'text-right tabular-nums')}>{c.celda(fila)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
