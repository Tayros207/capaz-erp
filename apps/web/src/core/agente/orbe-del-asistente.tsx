import type { ReactNode } from 'react';
import { unir } from '../../shared/ui/unir.ts';

type Nivel = 'reposo' | 'pensando' | 'trabajando' | 'escribiendo';

type Props = {
  nivel?: Nivel;
  /** Clases de tamaño, por ejemplo `size-9`. */
  tamano?: string;
  className?: string;
  /** Resplandor y un anillo alrededor, para cuando el orbe es el protagonista de la pantalla. */
  aura?: boolean;
};

const COLORES = 'bg-[conic-gradient(from_0deg,var(--color-asistente-1),var(--color-asistente-2),var(--color-asistente-3),var(--color-asistente-1))]';
const VETAS = 'bg-[conic-gradient(from_90deg,transparent,var(--color-asistente-3),transparent_35%,var(--color-asistente-1),transparent_70%)]';

function Aura(): ReactNode {
  return (
    <>
      <span className={unir('absolute -inset-3 rounded-full opacity-45 blur-xl motion-safe:animate-[asistente-piensa_20s_linear_infinite]', COLORES)} />
      <span className="absolute -inset-3 rounded-full border border-asistente-2/20" />
    </>
  );
}

/**
 * El «rostro» del asistente: un orbe de colores que respira en reposo y gira más rápido cuando piensa o trabaja. Es decorativo
 * (`aria-hidden`): lo que está haciendo se dice con texto. Solo anima transform y opacidad, y «reducir movimiento» lo deja quieto.
 */
export function OrbeDelAsistente({ nivel = 'reposo', tamano = 'size-9', className, aura = false }: Props): ReactNode {
  const activo = nivel !== 'reposo';
  return (
    <span aria-hidden="true" className={unir('relative inline-grid shrink-0 place-items-center rounded-full', tamano, className)}>
      {aura ? <Aura /> : null}
      <span className="absolute inset-0 rounded-full shadow-orbe motion-safe:animate-[asistente-respira_4.5s_ease-in-out_infinite]">
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <span className={unir('absolute -inset-1', COLORES, activo ? 'motion-safe:animate-[asistente-piensa_1.4s_linear_infinite]' : 'motion-safe:animate-[asistente-piensa_16s_linear_infinite]')} />
          <span className={unir('absolute -inset-1 opacity-80 blur-[3px]', VETAS, activo ? 'motion-safe:animate-[asistente-piensa_2.2s_linear_infinite_reverse]' : 'motion-safe:animate-[asistente-piensa_11s_linear_infinite_reverse]')} />
          <span className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_32%_28%,rgb(255_255_255/0.95),rgb(255_255_255/0.18)_45%,transparent_68%)]" />
          <span className="absolute inset-0 rounded-full shadow-[inset_0_-6px_14px_rgb(40_20_120/0.28),inset_0_1px_3px_rgb(255_255_255/0.7)]" />
        </span>
      </span>
    </span>
  );
}
