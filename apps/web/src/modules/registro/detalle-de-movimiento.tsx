import type { MovimientoDto } from '@capaz/shared';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { detalleDeMovimiento, esTransferencia } from './logica.ts';

/** Celda de detalle de un movimiento en las listas: su texto y las insignias «Transferencia» y «Anulado». */
export function DetalleDeMovimiento({ m }: { m: MovimientoDto }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {detalleDeMovimiento(m)}
      {esTransferencia(m) ? <Insignia tono="info">Transferencia</Insignia> : null}
      {m.estado === 'anulado' ? <Insignia tono="neutro">Anulado</Insignia> : null}
    </span>
  );
}
