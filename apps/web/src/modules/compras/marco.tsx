import type { CompraDto } from '@capaz/shared';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { ETIQUETA_DE_ESTADO, TONO_DE_ESTADO } from './logica.ts';

/** El estado en una insignia y, si corresponde, el aviso de atraso (texto además de color). */
export function InsigniasDeCompra({ compra }: { compra: Pick<CompraDto, 'estado' | 'atrasada'> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Insignia tono={TONO_DE_ESTADO[compra.estado]}>{ETIQUETA_DE_ESTADO[compra.estado]}</Insignia>
      {compra.atrasada ? <Insignia tono="peligro">Atrasada</Insignia> : null}
    </span>
  );
}

export function Cargando({ etiqueta }: { etiqueta: string }) {
  return (
    <div aria-busy="true" aria-label={etiqueta} className="flex flex-col gap-2">
      <Esqueleto className="h-12" />
      <Esqueleto className="h-12" />
      <Esqueleto className="h-12" />
    </div>
  );
}

/** Un dato de la ficha en modo lectura. */
export function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}
