import type { MovimientoDeInsumoDto } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { detalleDeMovimiento, textoDeCantidad } from './logica.ts';
import { CantidadDeMovimiento, InsigniaDeTipo } from './marco.tsx';

/** Columnas del historial; `conArticulo` las del listado general (en la ficha el artículo ya se sabe). */
export function columnasDeHistorial(conArticulo: boolean): Array<Columna<MovimientoDeInsumoDto>> {
  return [
    { id: 'fecha', titulo: 'Fecha', principal: !conArticulo, celda: (m) => formatearFechaHora(m.creadoEn) },
    ...(conArticulo ? [{ id: 'articulo', titulo: 'Artículo', principal: true, celda: (m: MovimientoDeInsumoDto) => m.nombre }] : []),
    { id: 'sucursal', titulo: 'Sucursal', celda: (m) => m.sucursalCodigo },
    { id: 'tipo', titulo: 'Tipo', celda: (m) => <InsigniaDeTipo m={m} /> },
    { id: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', celda: (m) => <CantidadDeMovimiento m={m} /> },
    { id: 'queda', titulo: 'Quedó', alinear: 'derecha', celda: (m) => <span className="tabular-nums">{textoDeCantidad(m.existenciaResultanteMilesimas, m.unidad)}</span> },
    { id: 'detalle', titulo: 'Detalle', celda: (m) => detalleDeMovimiento(m) },
  ];
}
