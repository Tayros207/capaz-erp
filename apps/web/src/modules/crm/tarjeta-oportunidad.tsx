import { Link } from 'react-router';
import type { EtapaDto, OportunidadDto } from '@capaz/shared';
import { MenuDeAcciones, type AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { ganarOportunidad, moverOportunidad } from './api.ts';
import { useEscribir } from './acciones.ts';
import { destinosDeMovimiento, textoDeMonto } from './logica.ts';

type Props = { o: OportunidadDto; etapas: readonly EtapaDto[]; editar: boolean; alPerder: (o: OportunidadDto) => void };

/** Tarjeta del tablero: título, cliente, monto, pendientes y acciones (sin arrastre). */
export function TarjetaOportunidad({ o, etapas, editar, alPerder }: Props) {
  const escribir = useEscribir();
  const acciones: AccionDeMenu[] = [
    ...destinosDeMovimiento(etapas, o).map((e) => ({
      etiqueta: `Mover a «${e.nombre}»`,
      onSeleccionar: () => void escribir(moverOportunidad(o.id, e.id), `Movida a «${e.nombre}».`),
    })),
    { etiqueta: 'Ganada', onSeleccionar: () => void escribir(ganarOportunidad(o.id), '¡Oportunidad ganada!') },
    { etiqueta: 'Perdida', onSeleccionar: () => alPerder(o), peligro: true },
  ];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/m/crm/oportunidades/${o.id}`} className="min-w-0 break-words font-medium text-texto hover:underline">{o.titulo}</Link>
        {editar ? <MenuDeAcciones etiqueta={`Acciones de ${o.codigo}`} acciones={acciones} /> : null}
      </div>
      <span className="text-sm text-texto-suave">{o.clienteNombre}</span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium tabular-nums text-texto">{textoDeMonto(o.montoEstimadoCentimos)}</span>
        {o.actividadesPendientes > 0 ? <Insignia tono="aviso">{o.actividadesPendientes === 1 ? '1 pendiente' : `${o.actividadesPendientes} pendientes`}</Insignia> : null}
      </div>
    </div>
  );
}
