import { useEffect, useRef } from 'react';

type Props = { etiqueta: string; marcada: boolean; parcial?: boolean; onCambio: () => void };

/** Casilla nativa con área táctil de 44 px; `parcial` la deja en estado indeterminado. */
export function CasillaDeSeleccion({ etiqueta, marcada, parcial, onCambio }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!parcial;
  }, [parcial]);
  return (
    <label className="inline-grid min-h-(--alto-control) min-w-(--alto-control) cursor-pointer place-items-center">
      <input ref={ref} type="checkbox" checked={marcada} onChange={onCambio} aria-label={etiqueta} className="size-5 cursor-pointer accent-accion" />
    </label>
  );
}
