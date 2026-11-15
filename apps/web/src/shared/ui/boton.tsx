import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icono } from './icono.tsx';
import type { NombreDeIcono } from './iconos.tsx';
import { unir } from './unir.ts';

export type VarianteDeBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro';

const VARIANTES: Record<VarianteDeBoton, string> = {
  primario: 'bg-accion text-accion-texto border-transparent hover:brightness-110',
  secundario: 'bg-superficie text-texto border-borde-fuerte hover:bg-superficie-alta',
  fantasma: 'bg-transparent text-texto border-transparent hover:bg-superficie-alta',
  peligro: 'bg-peligro text-texto-inverso border-transparent hover:brightness-110',
};

const TAMANOS = { normal: 'px-4 text-[0.9375rem]', grande: 'px-6 text-base' } as const;

type Comun = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variante?: VarianteDeBoton;
  tamano?: keyof typeof TAMANOS;
  /** Muestra un indicador y bloquea el botón mientras la acción corre. */
  cargando?: boolean;
  icono?: NombreDeIcono;
};

// Un botón con texto, o un botón solo de icono (que exige `aria-label` en español).
type Props = Comun & ({ children: ReactNode } | { children?: undefined; icono: NombreDeIcono; 'aria-label': string });

export function Boton({ variante = 'secundario', tamano = 'normal', cargando, icono, children, className, disabled, type = 'button', ...resto }: Props) {
  const soloIcono = children === undefined;
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={unir(
        'inline-flex min-h-(--alto-control) items-center justify-center gap-2 rounded-control border font-medium',
        'cursor-pointer select-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        soloIcono ? 'min-w-(--alto-control) px-2' : TAMANOS[tamano],
        VARIANTES[variante],
        className,
      )}
      {...resto}
    >
      {cargando ? <Rueda /> : icono ? <Icono nombre={icono} /> : null}
      {children}
    </button>
  );
}

function Rueda() {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
