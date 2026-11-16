import type { ReactNode } from 'react';
import { unir } from './unir.ts';

export type TonoDeInsignia = 'neutro' | 'exito' | 'aviso' | 'peligro' | 'info';

// Siempre lleva texto: el color solo nunca comunica un estado.
const TONOS: Record<TonoDeInsignia, string> = {
  neutro: 'bg-superficie-alta text-texto-suave border-borde',
  exito: 'bg-exito/10 text-exito border-exito/25',
  aviso: 'bg-aviso/10 text-aviso border-aviso/25',
  peligro: 'bg-peligro/10 text-peligro border-peligro/25',
  info: 'bg-info/10 text-info border-info/25',
};

export function Insignia({ tono = 'neutro', children }: { tono?: TonoDeInsignia; children: ReactNode }) {
  return (
    <span
      className={unir(
        'inline-flex items-center rounded-chip border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONOS[tono],
      )}
    >
      {children}
    </span>
  );
}
