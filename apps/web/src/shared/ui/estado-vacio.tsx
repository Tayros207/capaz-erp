import type { ReactNode } from 'react';
import { Icono } from './icono.tsx';
import type { NombreDeIcono } from './iconos.tsx';
import { Insignia } from './insignia.tsx';

type Props = {
  titulo: string;
  descripcion?: string;
  icono?: NombreDeIcono;
  /** Botón o enlace con el siguiente paso. */
  accion?: ReactNode;
  /** Marca el contenido como dato de muestra. */
  ejemplo?: boolean;
};

export function EstadoVacio({ titulo, descripcion, icono = 'carpeta', accion, ejemplo }: Props) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-tarjeta border border-borde bg-superficie text-texto-suave shadow-tarjeta">
        <Icono nombre={icono} className="size-7" />
      </span>
      {ejemplo ? <Insignia tono="info">Ejemplo</Insignia> : null}
      <h2 className="font-titulo text-base font-semibold tracking-tight text-texto">{titulo}</h2>
      {descripcion ? <p className="text-texto-suave">{descripcion}</p> : null}
      {accion ? <div className="mt-2">{accion}</div> : null}
    </div>
  );
}
