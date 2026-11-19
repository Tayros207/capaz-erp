import type { PedidoCompletoDto } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { AVISO_DE_APROBACION, vistaPrevia, type FormularioDeCorreccion } from './correccion.ts';
import type { SaldoDelPedido } from './deuda-del-pedido.ts';
import { ETIQUETA_DE_MOTIVO, textoDeDelta, tonoDeDelta } from './huella-de-correccion.ts';
import type { ErrorDeServidor, FaseDeCorreccion } from './use-correccion.ts';

type Props = {
  pedido: PedidoCompletoDto;
  form: FormularioDeCorreccion;
  saldo: SaldoDelPedido | null;
  fase: FaseDeCorreccion;
  resumen: string;
  error: ErrorDeServidor | null;
  alGuardar: () => void;
  alVolver: () => void;
};

function Pagos({ v }: { v: ReturnType<typeof vistaPrevia> }) {
  if (v.pagadoCentimos === null) return null;
  return (
    <p className="text-texto">
      Ya pagó <strong>{formatearSoles(v.pagadoCentimos)}</strong> · Falta <strong>{formatearSoles(v.faltaCentimos ?? 0)}</strong>
      {(v.aFavorCentimos ?? 0) > 0 ? <> · <strong>A favor del cliente {formatearSoles(v.aFavorCentimos ?? 0)}</strong> (no se devuelve)</> : null}
    </p>
  );
}

function Mensaje({ fase, resumen, error }: Pick<Props, 'fase' | 'resumen' | 'error'>) {
  if (error) {
    return (
      <div role="alert" className="flex flex-col gap-1 rounded-control border border-peligro/40 bg-peligro/10 p-3 text-sm text-texto">
        {error.codigo === 'requiere_aprobacion' ? <p className="font-semibold">{AVISO_DE_APROBACION}</p> : null}
        <p>{error.mensaje}</p>
      </div>
    );
  }
  if (fase === 'calculando') return <p role="status" aria-busy="true" className="text-sm text-texto-suave">Calculando lo que cambia…</p>;
  return resumen ? (
    <details className="rounded-control bg-superficie-alta p-3 text-sm text-texto-suave">
      <summary className="cursor-pointer font-medium text-texto">Resumen del sistema</summary>
      <p className="mt-2">{resumen}</p>
    </details>
  ) : null;
}

/** El segundo paso: «Qué cambia». Mostrarlo ya es la confirmación: «Guardar versión N» la acepta. */
export function RevisionDeCorreccion({ pedido, form, saldo, fase, resumen, error, alGuardar, alVolver }: Props) {
  const v = vistaPrevia(pedido, form, saldo ? saldo.abonadoCentimos : null);
  const ocupado = fase === 'calculando' || fase === 'guardando';
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-suave">
        {pedido.codigo} pasará de la versión {pedido.version} a la versión {pedido.version + 1}. La versión {pedido.version} queda guardada y se puede reimprimir.
        {form.motivo ? ` Motivo: ${ETIQUETA_DE_MOTIVO[form.motivo]}.` : ''}
      </p>
      <ul aria-label="Líneas que cambian" className="flex flex-col gap-2">
        {v.filas.map((f) => (
          <li key={f.clave} className="flex flex-col gap-0.5 rounded-control border border-borde bg-superficie p-3 text-sm">
            <span className="break-words font-medium text-texto">{f.descripcion || 'Línea sin descripción'}</span>
            <span className="break-words text-texto-suave">{f.antes ?? 'No estaba'} → {f.despues ?? 'Se quita'}</span>
          </li>
        ))}
        {v.filas.length === 0 ? <li className="text-sm text-texto-suave">Las líneas no cambian: solo se ajusta el total.</li> : null}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-texto">
        <span>Total: {formatearSoles(v.totalAnteriorCentimos)} → <strong className="font-titulo text-lg">{formatearSoles(v.totalNuevoCentimos)}</strong></span>
        <Insignia tono={tonoDeDelta(v.deltaCentimos)}>{textoDeDelta(v.deltaCentimos)}</Insignia>
      </div>
      <Pagos v={v} />
      <Mensaje fase={fase} resumen={resumen} error={error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" disabled={ocupado} onClick={alVolver}>Volver a editar</Boton>
        {error ? null : <Boton variante="primario" disabled={fase !== 'listo' && fase !== 'guardando'} cargando={fase === 'guardando'} onClick={alGuardar}>{`Guardar versión ${pedido.version + 1}`}</Boton>}
      </div>
    </div>
  );
}
