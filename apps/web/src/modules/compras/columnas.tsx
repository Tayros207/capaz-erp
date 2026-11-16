import type { CompraDto, LineaDeCompraDto } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { formatearDia, textoPorRecibir } from './logica.ts';
import { InsigniasDeCompra } from './marco.tsx';

/** Columnas de una orden en la lista. */
export const COLUMNAS_DE_COMPRAS: Array<Columna<CompraDto>> = [
  { id: 'codigo', titulo: 'Orden', principal: true, celda: (c) => c.codigo },
  { id: 'proveedor', titulo: 'Proveedor', celda: (c) => c.proveedorNombre },
  { id: 'entrega', titulo: 'Entrega', celda: (c) => formatearDia(c.entregaEl) },
  { id: 'estado', titulo: 'Estado', celda: (c) => <InsigniasDeCompra compra={c} /> },
  { id: 'pendiente', titulo: 'Por recibir', celda: textoPorRecibir },
  { id: 'total', titulo: 'Total', alinear: 'derecha', celda: (c) => formatearSoles(c.totalCentimos) },
];

/** Columnas de las líneas de una orden ya enviada: lo pedido, lo recibido y lo que falta. */
export const COLUMNAS_DE_LINEAS_ENVIADAS: Array<Columna<LineaDeCompraDto>> = [
  {
    id: 'descripcion',
    titulo: 'Descripción',
    principal: true,
    celda: (l) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        {l.descripcion}
        {l.afectoIgv ? null : <Insignia tono="neutro">No afecto</Insignia>}
        {l.pendienteMilesimas === 0 ? <Insignia tono="exito">Completa</Insignia> : null}
      </span>
    ),
  },
  { id: 'pedido', titulo: 'Pedido', alinear: 'derecha', celda: (l) => formatearCantidad(l.cantidadMilesimas, l.unidad) },
  { id: 'recibido', titulo: 'Recibido', alinear: 'derecha', celda: (l) => formatearCantidad(l.recibidoMilesimas, l.unidad) },
  { id: 'pendiente', titulo: 'Falta', alinear: 'derecha', celda: (l) => formatearCantidad(l.pendienteMilesimas, l.unidad) },
  { id: 'costo', titulo: 'Costo unitario', alinear: 'derecha', celda: (l) => `S/ ${milesimasATexto(l.costoUnitarioMilesimas)}` },
  { id: 'importe', titulo: 'Importe', alinear: 'derecha', celda: (l) => formatearSoles(l.importeCentimos) },
];
