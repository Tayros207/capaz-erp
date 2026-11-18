import { Link } from 'react-router';
import { unir } from '../../shared/ui/unir.ts';

type Props = {
  mensaje: string;
  /** `exito` es un estado; `alerta` (algo quedó a medias) se anuncia como alerta. */
  tono: 'exito' | 'alerta';
  deuda?: { id: string; codigo: string } | null;
};

/** Aviso en la propia hoja (no modal) tras confirmar el pedido, con el enlace a la deuda si se creó. */
export function AvisoDeConfirmacion({ mensaje, tono, deuda }: Props) {
  const alerta = tono === 'alerta';
  return (
    <div role={alerta ? 'alert' : 'status'} className={unir('flex flex-col gap-2 rounded-tarjeta border p-4', alerta ? 'border-peligro' : 'border-exito')}>
      <p className={unir('font-medium', alerta ? 'text-peligro' : 'text-texto')}>{mensaje}</p>
      {deuda ? <Link to={`/m/registro/deudas/${deuda.id}`} className="w-fit font-medium text-accion underline">Ver la deuda {deuda.codigo}</Link> : null}
    </div>
  );
}
