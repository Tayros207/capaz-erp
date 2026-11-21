import type { PedidoDto } from '@capaz/shared';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { ETIQUETA_DE_ESTADO, TONO_DE_ESTADO } from './logica.ts';

export function SeccionesDePedidos() {
  return (
    <NavegacionDeSeccion
      etiqueta="Secciones de Pedidos"
      secciones={[
        { a: '/m/ordenes', texto: 'Pedidos', fin: true },
        { a: '/m/ordenes/tablero', texto: 'Por estado' },
        { a: '/m/ordenes/entregas', texto: 'Entregas' },
        { a: '/m/ordenes/guias', texto: 'Guías' },
        { a: '/m/ordenes/correcciones', texto: 'Correcciones' },
      ]}
    />
  );
}

/** El estado en una insignia y, si corresponde, el aviso de atraso (texto además de color). */
export function InsigniasDePedido({ pedido }: { pedido: Pick<PedidoDto, 'estado' | 'atrasado'> & Partial<Pick<PedidoDto, 'origenTipo'>> & Partial<Pick<PedidoDto, 'version'>> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Insignia tono={TONO_DE_ESTADO[pedido.estado]}>{ETIQUETA_DE_ESTADO[pedido.estado]}</Insignia>
      {(pedido.version ?? 1) > 1 ? <Insignia tono="info">{`v${pedido.version}`}</Insignia> : null}
      {pedido.origenTipo === 'importacion' ? <Insignia tono="neutro">Importado</Insignia> : null}
      {pedido.atrasado ? <Insignia tono="peligro">Atrasado</Insignia> : null}
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
