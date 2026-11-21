import type { ReactNode } from 'react';

type Props = { numero?: number; titulo: string; /** Para llevar el foco aquí cuando algo falta. */ campo?: string; children: ReactNode };

/** Un bloque de la hoja con su pregunta numerada («1 ¿Quién es el cliente?»): mismo encabezado y mismo espacio en todas. */
export function SeccionDeHoja({ numero, titulo, campo, children }: Props) {
  return (
    <section data-campo={campo} className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 font-titulo text-base font-semibold text-texto">
        {numero ? <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border border-borde-fuerte bg-superficie-alta text-xs font-semibold">{numero}</span> : null}
        {titulo}
      </h3>
      {children}
    </section>
  );
}
