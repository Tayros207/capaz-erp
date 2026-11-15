import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { IconoDeDatos } from './iconos-datos.tsx';

export type Miga = { texto: string; a?: string };

type Props = {
  titulo: string;
  migas?: Miga[];
  /** La acción más importante de la pantalla (un solo botón primario). */
  accionPrincipal?: ReactNode;
  accionesSecundarias?: ReactNode;
};

export function EncabezadoDePagina({ titulo, migas, accionPrincipal, accionesSecundarias }: Props) {
  return (
    <header className="flex flex-col gap-2 border-b border-borde pb-3">
      {migas?.length ? (
        <nav aria-label="Ruta de navegación">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-texto-suave">
            {migas.map((m, i) => {
              const ultima = i === migas.length - 1;
              return (
                <li key={`${i}-${m.texto}`} className="flex items-center gap-1">
                  {m.a && !ultima ? (
                    <Link to={m.a} className="rounded-control underline-offset-2 hover:underline">
                      {m.texto}
                    </Link>
                  ) : (
                    <span aria-current={ultima ? 'page' : undefined}>{m.texto}</span>
                  )}
                  {ultima ? null : <IconoDeDatos nombre="derecha" />}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 font-titulo text-2xl font-semibold text-texto">{titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {accionesSecundarias}
          {accionPrincipal}
        </div>
      </div>
    </header>
  );
}
