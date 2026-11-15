import { ICONOS, type NombreDeIcono } from './iconos.tsx';
import { unir } from './unir.ts';

type Props = {
  nombre: NombreDeIcono;
  /** Texto para lectores de pantalla. Sin él, el icono es decorativo y se oculta. */
  etiqueta?: string;
  className?: string;
};

export function Icono({ nombre, etiqueta, className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={unir('size-5 shrink-0', className)}
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      focusable="false"
    >
      {ICONOS[nombre]}
    </svg>
  );
}
