import { ICONOS, type NombreDeIcono } from './iconos.tsx';
import { unir } from './unir.ts';

type Props = {
  nombre: NombreDeIcono;
  /** Texto para lectores de pantalla. Sin él, el icono es decorativo y se oculta. */
  etiqueta?: string;
  className?: string;
};

export function Icono({ nombre, etiqueta, className }: Props) {
  const Glifo = ICONOS[nombre];
  return (
    <Glifo
      strokeWidth={1.75}
      className={unir('size-[1.125rem] shrink-0', className)}
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      focusable="false"
    />
  );
}
