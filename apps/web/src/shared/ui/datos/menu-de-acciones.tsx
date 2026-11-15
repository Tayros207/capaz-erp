import { useId, useRef, type KeyboardEvent, type ToggleEvent } from 'react';
import { Boton } from '../boton.tsx';
import { unir } from '../unir.ts';

export type AccionDeMenu = { etiqueta: string; onSeleccionar: () => void; peligro?: boolean; deshabilitada?: boolean };

type Props = { acciones: AccionDeMenu[]; etiqueta: string };

function ItemDeMenu({ accion: a, alElegir }: { accion: AccionDeMenu; alElegir: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={a.deshabilitada}
      onClick={() => {
        alElegir();
        a.onSeleccionar();
      }}
      className={unir(
        'flex min-h-(--alto-control) w-full cursor-pointer items-center rounded-control px-3 text-left hover:bg-superficie-alta disabled:cursor-not-allowed disabled:opacity-50',
        a.peligro && 'text-peligro',
      )}
    >
      {a.etiqueta}
    </button>
  );
}

/** Menú con `popover` nativo: Escape y el clic fuera lo cierran sin código propio. */
export function MenuDeAcciones({ acciones, etiqueta }: Props) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLSpanElement>(null);

  const items = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];

  function alAbrir(e: ToggleEvent<HTMLDivElement>) {
    if (e.newState !== 'open' || !disparador.current) return;
    const r = disparador.current.getBoundingClientRect();
    const ancho = e.currentTarget.offsetWidth;
    e.currentTarget.style.top = `${r.bottom + 4}px`;
    e.currentTarget.style.left = `${Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8))}px`;
    items()[0]?.focus();
  }

  function alTeclear(e: KeyboardEvent) {
    const lista = items();
    const i = lista.indexOf(document.activeElement as HTMLButtonElement);
    const salto = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!salto) return;
    e.preventDefault();
    lista[(i + salto + lista.length) % lista.length]?.focus();
  }

  return (
    <>
      <span ref={disparador} className="inline-flex">
        <Boton variante="secundario" icono="menu" aria-label={etiqueta} aria-haspopup="menu" popoverTarget={id} />
      </span>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="menu"
        aria-label={etiqueta}
        onToggle={alAbrir}
        onKeyDown={alTeclear}
        className="m-0 min-w-48 rounded-tarjeta border border-borde-fuerte bg-superficie p-1 text-texto shadow-elevada"
      >
        {acciones.map((a) => (
          <ItemDeMenu key={a.etiqueta} accion={a} alElegir={() => menu.current?.hidePopover()} />
        ))}
      </div>
    </>
  );
}
