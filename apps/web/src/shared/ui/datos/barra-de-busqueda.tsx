import { useId, type InputHTMLAttributes } from 'react';
import { Boton } from '../boton.tsx';
import { Icono } from '../icono.tsx';
import { CLASES_DE_CONTROL } from '../campo-comun.ts';
import { unir } from '../unir.ts';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  valor: string;
  onCambio: (valor: string) => void;
  /** Etiqueta para lectores de pantalla; el campo no muestra texto visible. */
  etiqueta?: string;
};

export function BarraDeBusqueda({ valor, onCambio, etiqueta = 'Buscar', placeholder = 'Buscar…', className, id, ...resto }: Props) {
  const propio = useId();
  const idCampo = id ?? propio;
  return (
    <div role="search" className={unir('relative flex w-full items-center', className)}>
      <label htmlFor={idCampo} className="sr-only">
        {etiqueta}
      </label>
      <Icono nombre="buscar" className="pointer-events-none absolute left-3 text-texto-suave" />
      <input
        id={idCampo}
        type="search"
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onCambio(e.target.value)}
        className={unir(CLASES_DE_CONTROL, 'border-borde-fuerte pl-10', valor && 'pr-12')}
        {...resto}
      />
      {valor ? (
        <Boton variante="fantasma" icono="cerrar" aria-label="Borrar búsqueda" className="absolute right-0" onClick={() => onCambio('')} />
      ) : null}
    </div>
  );
}
