import type { Candidata } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';

type Props = { titulo: string; candidatas: Candidata[]; alElegir: (c: Candidata) => void };

/** Clientes que se parecen a lo que se está escribiendo; cada uno se puede abrir en vez de crear un duplicado. */
export function ListaDeCandidatas({ titulo, candidatas, alElegir }: Props) {
  if (candidatas.length === 0) return null;
  return (
    <section aria-label={titulo} role="status" className="flex flex-col gap-2 rounded-tarjeta border border-aviso/40 bg-aviso/10 p-3">
      <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
      <ul className="flex flex-col gap-2">
        {candidatas.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate font-medium text-texto">{c.nombre}</span>
              {c.detalle ? <span className="block truncate text-sm text-texto-suave">{c.detalle}</span> : null}
            </span>
            <Boton onClick={() => alElegir(c)}>Usar este</Boton>
          </li>
        ))}
      </ul>
    </section>
  );
}
