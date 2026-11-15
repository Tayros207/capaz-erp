import { alternarOrden, alternarSeleccion, alternarTodas, ariaSort, estadoDeSeleccion, type Orden } from './logica-lista.ts';
import { CasillaDeSeleccion } from './casilla-de-seleccion.tsx';
import { IconoDeDatos } from './iconos-datos.tsx';
import type { Columna, PropsDeLista } from './lista-tipos.ts';
import { unir } from '../unir.ts';

function Cabecera<T>({ c, orden, onOrden }: { c: Columna<T>; orden: Orden; onOrden?: (o: Orden) => void }) {
  const icono = orden?.columna !== c.id ? 'ordenable' : orden.direccion === 'asc' ? 'arriba' : 'abajo';
  return (
    <th scope="col" aria-sort={c.valorDeOrden ? ariaSort(orden, c.id) : undefined} className={unir('border-b border-borde-fuerte px-3 font-semibold', c.alinear === 'derecha' && 'text-right')}>
      {c.valorDeOrden && onOrden ? (
        <button type="button" onClick={() => onOrden(alternarOrden(orden, c.id))} className={unir('inline-flex min-h-(--alto-control) cursor-pointer items-center gap-1 font-semibold hover:text-texto', c.alinear === 'derecha' && 'flex-row-reverse')}>
          {c.titulo}
          <IconoDeDatos nombre={icono} />
        </button>
      ) : (
        c.titulo
      )}
    </th>
  );
}

function Fila<T>({ fila, columnas, id, marcada, onAbrir, onMarcar }: { fila: T; columnas: Array<Columna<T>>; id: string; marcada: boolean; onAbrir?: (f: T) => void; onMarcar?: () => void }) {
  return (
    <tr aria-selected={onMarcar ? marcada : undefined} onClick={onAbrir ? () => onAbrir(fila) : undefined} className={unir('border-b border-borde last:border-b-0 hover:bg-superficie-alta', marcada && 'bg-info/10', onAbrir && 'cursor-pointer')}>
      {onMarcar ? (
        <td className="px-1" onClick={(e) => e.stopPropagation()}>
          <CasillaDeSeleccion etiqueta={`Seleccionar fila ${id}`} marcada={marcada} onCambio={onMarcar} />
        </td>
      ) : null}
      {columnas.map((c) =>
        c.principal ? (
          <th key={c.id} scope="row" className={unir('px-3 py-2 font-medium text-texto', c.alinear === 'derecha' && 'text-right')}>
            {c.celda(fila)}
          </th>
        ) : (
          <td key={c.id} className={unir('px-3 py-2', c.alinear === 'derecha' && 'text-right tabular-nums')}>
            {c.celda(fila)}
          </td>
        ),
      )}
    </tr>
  );
}

/** Vista de escritorio de `Lista`: tabla con cabeceras `scope` y `aria-sort`. */
export function ListaTabla<T>({ columnas, filas, clave, etiqueta, orden = null, onOrden, seleccion, onSeleccion, onAbrir }: PropsDeLista<T>) {
  const ids = filas.map(clave);
  const estado = seleccion ? estadoDeSeleccion(seleccion, ids) : 'ninguna';
  return (
    <div className="hidden overflow-x-auto rounded-tarjeta border border-borde bg-superficie sm:block">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{etiqueta}</caption>
        <thead className="bg-superficie-alta text-sm text-texto-suave">
          <tr>
            {seleccion && onSeleccion ? (
              <th scope="col" className="w-12 px-1">
                <CasillaDeSeleccion etiqueta="Seleccionar todas las filas" marcada={estado === 'todas'} parcial={estado === 'algunas'} onCambio={() => onSeleccion(alternarTodas(seleccion, ids))} />
              </th>
            ) : null}
            {columnas.map((c) => (
              <Cabecera key={c.id} c={c} orden={orden} onOrden={onOrden} />
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <Fila key={ids[i]} fila={fila} columnas={columnas} id={ids[i]!} marcada={!!seleccion?.has(ids[i]!)} onAbrir={onAbrir} onMarcar={seleccion && onSeleccion ? () => onSeleccion(alternarSeleccion(seleccion, ids[i]!)) : undefined} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
