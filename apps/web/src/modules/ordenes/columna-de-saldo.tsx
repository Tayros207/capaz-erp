import type { PedidoDto } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { datosDeSaldo, type CobroAbierto } from './cobro-en-lista.ts';

/** «Por cobrar»: lo que aún debe el cliente de cada pedido, con «Sin adelanto» o «Vencida» al lado cuando corresponde. */
export function columnaDeSaldo(cobros: ReadonlyMap<string, CobroAbierto>): Columna<PedidoDto> {
  return {
    id: 'por-cobrar',
    titulo: 'Por cobrar',
    alinear: 'derecha',
    valorDeOrden: (p) => cobros.get(p.id)?.saldoCentimos ?? 0,
    celda: (p) => {
      const s = datosDeSaldo(p, cobros.get(p.id));
      if (!s) return '—';
      return (
        <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <span className="font-medium">{formatearSoles(s.saldoCentimos)}</span>
          {s.nota ? <Insignia tono={s.tono}>{s.nota}</Insignia> : null}
        </span>
      );
    },
  };
}
