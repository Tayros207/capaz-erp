import type { Borrador } from '@capaz/shared';
import { Insignia, type TonoDeInsignia } from '../../shared/ui/insignia.tsx';
import { ETIQUETA_DE_ESTADO, ETIQUETA_DE_ORIGEN } from './logica.ts';

const TONO_DE_ESTADO: Record<Borrador['estado'], TonoDeInsignia> = { pendiente: 'aviso', aprobado: 'exito', descartado: 'neutro' };

export function InsigniasDeBorrador({ b }: { b: Borrador }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Insignia tono={TONO_DE_ESTADO[b.estado]}>{ETIQUETA_DE_ESTADO[b.estado]}</Insignia>
      <Insignia tono="info">{ETIQUETA_DE_ORIGEN[b.origen]}</Insignia>
      {b.prioridad === 'alta' ? <Insignia tono="peligro">Prioridad alta</Insignia> : null}
      {b.corregido ? <Insignia tono="neutro">Corregido</Insignia> : null}
    </span>
  );
}
