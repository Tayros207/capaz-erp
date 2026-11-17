import { useId } from 'react';
import { unir } from '../../shared/ui/unir.ts';

type Props<T extends string> = {
  etiqueta: string;
  valor: T;
  opciones: ReadonlyArray<{ valor: T; etiqueta: string }>;
  alCambiar: (valor: T) => void;
  disabled?: boolean;
};

/** Varias opciones excluyentes en una fila: una sola está elegida y se mueve con las flechas. */
export function ControlSegmentado<T extends string>({ etiqueta, valor, opciones, alCambiar, disabled }: Props<T>) {
  const id = useId();
  function mover(ev: React.KeyboardEvent, i: number) {
    const paso = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
    if (paso === 0) return;
    ev.preventDefault();
    const destino = opciones[(i + paso + opciones.length) % opciones.length];
    if (destino) alCambiar(destino.valor);
  }
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex w-full flex-wrap gap-1 rounded-control border border-borde bg-superficie-alta p-1 sm:w-auto">
      {opciones.map((o, i) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            id={`${id}-${o.valor}`}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            disabled={disabled}
            onClick={() => alCambiar(o.valor)}
            onKeyDown={(ev) => mover(ev, i)}
            className={unir(
              'min-h-9 flex-1 cursor-pointer rounded-control px-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
              activo ? 'bg-accion text-accion-texto shadow-sutil' : 'text-texto-suave hover:bg-superficie hover:text-texto',
            )}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
