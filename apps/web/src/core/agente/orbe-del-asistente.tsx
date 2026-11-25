import type { ReactNode } from 'react';
import { unir } from '../../shared/ui/unir.ts';

type Nivel = 'reposo' | 'pensando' | 'trabajando' | 'escribiendo';

type Props = {
  nivel?: Nivel;
  /** Clases de tamaño, por ejemplo `size-9`. */
  tamano?: string;
  className?: string;
};

/**
 * El «rostro» del asistente: un orbe de colores que respira en reposo y gira más rápido cuando piensa o trabaja. Es decorativo
 * (`aria-hidden`): lo que está haciendo se dice con texto. Solo anima transform y opacidad, y «reducir movimiento» lo deja quieto.
 */
export function OrbeDelAsistente({ nivel = 'reposo', tamano = 'size-9', className }: Props): ReactNode {
  const activo = nivel !== 'reposo';
  return (
    <span aria-hidden="true" className={unir('relative inline-grid shrink-0 place-items-center rounded-full shadow-orbe', tamano, 'motion-safe:animate-[asistente-respira_4.5s_ease-in-out_infinite]', className)}>
      <span className="absolute inset-0 overflow-hidden rounded-full">
        <span
          className={unir(
            'absolute -inset-1 bg-[conic-gradient(from_0deg,var(--color-asistente-1),var(--color-asistente-2),var(--color-asistente-3),var(--color-asistente-1))]',
            activo ? 'motion-safe:animate-[asistente-piensa_1.4s_linear_infinite]' : 'motion-safe:animate-[asistente-piensa_16s_linear_infinite]',
          )}
        />
        <span className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle_at_32%_28%,rgb(255_255_255/0.95),rgb(255_255_255/0.15)_55%,transparent_70%)]" />
      </span>
    </span>
  );
}
