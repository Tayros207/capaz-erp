import { conciliarFactura, importeDeRecepcion, type ConciliacionDto, type EstadoDeSolicitudDeCompra, type FacturaDto, type SolicitudDeCompraDto } from '@capaz/shared';
import { codigoDeOrden } from '../domain/orden.js';
import type { Factura, LineaDeSolicitud, Solicitud } from '../repositories/operaciones.repository.js';

const iso = (f: Date | null) => f?.toISOString() ?? null;

/** «SC-0001-2026»; nulo mientras la solicitud es borrador. */
export const codigoDeSolicitud = (numero: number | null, anio: number | null): string | null => (numero === null || anio === null ? null : `SC-${String(numero).padStart(4, '0')}-${anio}`);

export const aSolicitudDto = (s: Solicitud, lineas: readonly LineaDeSolicitud[]): SolicitudDeCompraDto => ({
  id: s.id,
  codigo: codigoDeSolicitud(s.numero, s.anio),
  numero: s.numero,
  anio: s.anio,
  estado: s.estado as EstadoDeSolicitudDeCompra,
  fecha: s.fecha,
  necesariaEl: s.necesariaEl,
  area: s.area,
  motivo: s.motivo,
  ordenId: s.ordenId,
  solicitadoPor: s.solicitadoPor,
  resueltoPor: s.resueltoPor,
  resueltoEn: iso(s.resueltoEn),
  motivoResolucion: s.motivoResolucion,
  lineas: lineas.map((l) => ({ posicion: l.posicion, productoId: l.productoId, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas })),
  creadoEn: s.creadoEn.toISOString(),
});

export type DeLaOrden = { ordenTotalCentimos: number; lineas: ReadonlyArray<{ cantidadMilesimas: number; costoUnitarioMilesimas: number }> } | null;

/** Concilia contra la orden (si la hay) y lo recibido hasta ahora: se calcula al leer, porque la orden sigue recibiendo. */
export function conciliacionDe(f: Pick<Factura, 'totalCentimos' | 'moneda'>, orden: DeLaOrden): ConciliacionDto {
  return conciliarFactura({
    totalCentimos: f.totalCentimos,
    moneda: f.moneda,
    ordenTotalCentimos: orden?.ordenTotalCentimos ?? null,
    recibidoCentimos: orden ? importeDeRecepcion(orden.lineas) : null,
  });
}

export const aFacturaDto = (f: Factura, orden: DeLaOrden): FacturaDto => ({
  id: f.id,
  proveedorId: f.proveedorId,
  proveedorNombre: f.proveedorNombre,
  ordenId: f.ordenId,
  ordenCodigo: f.ordenId ? codigoDeOrden(f.ordenSerie, f.ordenAnio, f.ordenNumero) : null,
  serie: f.serie,
  numero: f.numero,
  comprobante: `${f.serie}-${f.numero}`,
  fecha: f.fecha,
  venceEl: f.venceEl,
  moneda: f.moneda as FacturaDto['moneda'],
  subtotalCentimos: f.subtotalCentimos,
  igvCentimos: f.igvCentimos,
  totalCentimos: f.totalCentimos,
  notas: f.notas,
  anuladoEn: iso(f.anuladoEn),
  motivoAnulacion: f.motivoAnulacion,
  conciliacion: conciliacionDe(f, orden),
  creadoEn: f.creadoEn.toISOString(),
});
