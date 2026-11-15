import type { ReactNode } from 'react';
import { unir } from './unir.ts';

export type TonoDeInsignia = 'neutro' | 'exito' | 'aviso' | 'peligro' | 'info';

// Siempre lleva texto: el color solo nunca comunica un estado.
const TONOS: Record<TonoDeInsignia, string> = {
  neutro: 'bg-superficie-alta text-texto border-borde-fuerte',
  exito: 'bg-exito/15 text-exito border-exito/40',
  aviso: 'bg-aviso/15 text-aviso border-aviso/40',
  peligro: 'bg-peligro/15 text-peligro border-peligro/40',
  info: 'bg-info/15 text-info border-info/40',
};

export function Insignia({ tono = 'neutro', children }: { tono?: TonoDeInsignia; children: ReactNode }) {
  return (
    <span
      className={unir(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONOS[tono],
      )}
    >
      {children}
    </span>
  );
}
