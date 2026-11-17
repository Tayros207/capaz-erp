import type { ReactNode } from 'react';

/** Un bloque de la pantalla del cuadro: título, acciones opcionales y contenido. */
export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-titulo text-base font-semibold text-texto">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}
