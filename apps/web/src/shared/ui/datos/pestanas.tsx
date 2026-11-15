import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { unir } from '../unir.ts';
import { pestanaSegunTecla } from './logica-navegacion.ts';

export type Pestana = { id: string; etiqueta: string; contenido: ReactNode; deshabilitada?: boolean };

type Props = { pestanas: Pestana[]; activa: string; onCambio: (id: string) => void; etiqueta: string };

export function Pestanas({ pestanas, activa, onCambio, etiqueta }: Props) {
  const base = useId();
  const botones = useRef<Array<HTMLButtonElement | null>>([]);
  const seleccionada = pestanas.find((p) => p.id === activa) ?? pestanas[0];

  function alTeclear(e: KeyboardEvent, indice: number) {
    const destino = pestanaSegunTecla(e.key, indice, pestanas.map((p) => !!p.deshabilitada));
    if (destino === null) return;
    e.preventDefault();
    botones.current[destino]?.focus();
    onCambio(pestanas[destino]!.id);
  }

  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label={etiqueta} className="flex overflow-x-auto border-b border-borde-fuerte">
        {pestanas.map((p, i) => {
          const esta = p.id === seleccionada?.id;
          return (
            <button
              key={p.id}
              ref={(el) => void (botones.current[i] = el)}
              type="button"
              role="tab"
              id={`${base}-t-${p.id}`}
              aria-selected={esta}
              aria-controls={`${base}-p-${p.id}`}
              tabIndex={esta ? 0 : -1}
              disabled={p.deshabilitada}
              onClick={() => onCambio(p.id)}
              onKeyDown={(e) => alTeclear(e, i)}
              className={unir(
                '-mb-px min-h-(--alto-control) cursor-pointer border-b-2 px-4 font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50',
                esta ? 'border-accion text-texto' : 'border-transparent text-texto-suave hover:text-texto',
              )}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>
      {seleccionada ? (
        <div role="tabpanel" id={`${base}-p-${seleccionada.id}`} aria-labelledby={`${base}-t-${seleccionada.id}`} tabIndex={0} className="py-4">
          {seleccionada.contenido}
        </div>
      ) : null}
    </div>
  );
}
