import { useId, useState, type ReactNode } from 'react';
import { CampoSelect } from './campo-select.tsx';
import { columnaVisible } from './logica-tablero.ts';
import { unir } from './unir.ts';

export type ColumnaDeTablero<T> = { id: string; titulo: string; resumen?: string; filas: readonly T[] };

type Props<T> = {
  etiqueta: string;
  columnas: Array<ColumnaDeTablero<T>>;
  clave: (f: T) => string;
  tarjeta: (f: T) => ReactNode;
  vacio?: ReactNode;
};

/** Columnas de tarjetas. Desde 640 px se ven lado a lado con desplazamiento horizontal; antes, una a la vez. Sin arrastre. */
export function Tablero<T>({ etiqueta, columnas, clave, tarjeta, vacio }: Props<T>) {
  const idBase = useId();
  const [elegida, setElegida] = useState<string | null>(null);
  const visible = columnaVisible(columnas, elegida);
  return (
    <section aria-label={etiqueta} className="flex flex-col gap-3">
      <div className="sm:hidden">
        <CampoSelect etiqueta="Columna" value={visible} onChange={(e) => setElegida(e.target.value)}>
          {columnas.map((c) => (
            <option key={c.id} value={c.id}>{c.titulo} ({c.filas.length})</option>
          ))}
        </CampoSelect>
      </div>
      <div className="flex gap-3 sm:overflow-x-auto sm:pb-2">
        {columnas.map((c) => (
          <div key={c.id} role="group" aria-labelledby={`${idBase}-${c.id}`}
            className={unir('min-w-0 flex-1 flex-col gap-2 rounded-control bg-superficie-alta p-2 sm:flex sm:w-72 sm:min-w-72 sm:flex-none', c.id === visible ? 'flex' : 'hidden')}>
            <header className="px-1 pt-1">
              <h3 id={`${idBase}-${c.id}`} className="font-titulo font-semibold text-texto">{c.titulo} <span className="font-normal text-texto-suave">({c.filas.length})</span></h3>
              {c.resumen ? <p className="text-sm text-texto-suave">{c.resumen}</p> : null}
            </header>
            {c.filas.length === 0 ? (
              <div className="px-1 py-3 text-sm text-texto-suave">{vacio ?? 'Sin elementos'}</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {c.filas.map((f) => (
                  <li key={clave(f)} className="rounded-control border border-borde bg-superficie p-3">{tarjeta(f)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
