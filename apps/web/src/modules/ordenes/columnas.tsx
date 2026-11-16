import type { PedidoDto } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { formatearDia } from './logica.ts';
import { InsigniasDePedido } from './marco.tsx';

/** Columnas de un pedido en la lista y en las entregas. */
export const COLUMNAS_DE_PEDIDOS: Array<Columna<PedidoDto>> = [
  { id: 'codigo', titulo: 'Pedido', principal: true, celda: (p) => p.codigo },
  { id: 'cliente', titulo: 'Cliente', celda: (p) => p.clienteNombre },
  { id: 'entrega', titulo: 'Entrega', celda: (p) => formatearDia(p.entregaEl) },
  { id: 'estado', titulo: 'Estado', celda: (p) => <InsigniasDePedido pedido={p} /> },
  { id: 'total', titulo: 'Total', alinear: 'derecha', celda: (p) => formatearSoles(p.totalCentimos) },
];
