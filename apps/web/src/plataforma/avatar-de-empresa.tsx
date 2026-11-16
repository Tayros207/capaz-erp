import { unir } from '../shared/ui/unir.ts';
import { inicialesDeEmpresa } from './logica.ts';

const COLORES = ['bg-acento-esmeralda', 'bg-acento-cian', 'bg-acento-ambar', 'bg-acento-rosa', 'bg-acento-gris'] as const;

/** Color estable por nombre: la misma empresa se ve igual en la lista, la ficha y la paleta. */
function colorDe(nombre: string): string {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length]!;
}

export function AvatarDeEmpresa({ nombre, tamano = 'normal' }: { nombre: string; tamano?: 'normal' | 'grande' }) {
  return (
    <span
      aria-hidden
      className={unir(
        'grid shrink-0 place-items-center font-semibold text-texto-inverso shadow-sutil',
        colorDe(nombre),
        tamano === 'grande' ? 'size-14 rounded-tarjeta text-xl' : 'size-9 rounded-control text-sm',
      )}
    >
      {inicialesDeEmpresa(nombre)}
    </span>
  );
}
