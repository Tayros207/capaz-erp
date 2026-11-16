import { NavLink } from 'react-router';
import { unir } from './unir.ts';

export type EnlaceDeSeccion = { a: string; texto: string; fin?: boolean };

/** Fila de enlaces entre las secciones de un módulo; en móvil se desplaza en horizontal. */
export function NavegacionDeSeccion({ etiqueta, secciones }: { etiqueta: string; secciones: EnlaceDeSeccion[] }) {
  return (
    <nav aria-label={etiqueta} className="flex gap-1 overflow-x-auto border-b border-borde-fuerte">
      {secciones.map((s) => (
        <NavLink
          key={s.a}
          to={s.a}
          end={s.fin}
          className={({ isActive }) =>
            unir(
              '-mb-px inline-flex min-h-(--alto-control) shrink-0 items-center border-b-2 px-4 font-medium whitespace-nowrap',
              isActive ? 'border-accion text-texto' : 'border-transparent text-texto-suave hover:text-texto',
            )
          }
        >
          {s.texto}
        </NavLink>
      ))}
    </nav>
  );
}
