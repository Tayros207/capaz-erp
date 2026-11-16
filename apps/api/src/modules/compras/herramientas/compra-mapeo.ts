import { importeDeRecepcion, type CompraCompletaDto, type CompraDto, type EstadoDeCompra, type LineaDeCompraDto, type RecepcionDeCompraDto } from '@capaz/shared';
import { estaAtrasada } from '../domain/estados.js';
import { codigoDeOrden } from '../domain/orden.js';
import { pendienteDe } from '../domain/recepcion.js';
import type { Compra, LineaDeCompra } from '../repositories/compras.repository.js';
import type { Recepcion } from '../repositories/recepciones.repository.js';

const iso = (f: Date | null) => f?.toISOString() ?? null;

/** `hoy` es el día de la empresa (`AAAA-MM-DD`): decide `atrasada`. */
export const aCompraDto = (f: Compra, hoy: string): CompraDto => ({
  id: f.id,
  codigo: codigoDeOrden(f.serie, f.anio, f.numero),
  numero: f.numero,
  serie: f.serie,
  anio: f.anio,
  proveedorId: f.proveedorId,
  proveedorNombre: f.proveedorNombre,
  estado: f.estado as EstadoDeCompra,
  fecha: f.fecha,
  entregaEl: f.entregaEl,
  atrasada: estaAtrasada(f.estado as EstadoDeCompra, f.entregaEl, hoy),
  igvPorcentaje: f.igvPorcentaje,
  subtotalCentimos: f.subtotalCentimos,
  igvCentimos: f.igvCentimos,
  totalCentimos: f.totalCentimos,
  notas: f.notas,
  sucursalId: f.sucursalId,
  canceladoEn: iso(f.canceladoEn),
  motivoCancelacion: f.motivoCancelacion,
  lineas: f.lineas,
  lineasPorRecibir: f.lineasPorRecibir,
  creadoPor: f.creadoPor,
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aLineaDto = (l: LineaDeCompra): LineaDeCompraDto => ({
  id: l.id,
  posicion: l.posicion,
  productoId: l.productoId,
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
  costoUnitarioMilesimas: l.costoUnitarioMilesimas,
  afectoIgv: l.afectoIgv,
  importeCentimos: l.importeCentimos,
  recibidoMilesimas: l.recibidoMilesimas,
  pendienteMilesimas: pendienteDe(l),
});

/** El valor de cada recepción se calcula con el costo de sus líneas de la orden (IGV incluido). */
export function aRecepcionDto(r: Recepcion, costos: ReadonlyMap<string, number>): RecepcionDeCompraDto {
  return {
    id: r.id,
    numero: r.numero,
    fecha: r.fecha,
    nota: r.nota,
    importeCentimos: importeDeRecepcion(r.lineas.map((l) => ({ cantidadMilesimas: l.cantidadMilesimas, costoUnitarioMilesimas: costos.get(l.ordenLineaId) ?? 0 }))),
    lineas: r.lineas.map((l) => ({ ordenLineaId: l.ordenLineaId, cantidadMilesimas: l.cantidadMilesimas })),
    creadoPor: r.creadoPor,
    creadoEn: r.creadoEn.toISOString(),
  };
}

export function aCompraCompleta(f: Compra, lineas: readonly LineaDeCompra[], recepciones: readonly Recepcion[], hoy: string): CompraCompletaDto {
  const costos = new Map(lineas.map((l) => [l.id, l.costoUnitarioMilesimas]));
  return { ...aCompraDto(f, hoy), detalle: lineas.map(aLineaDto), recepciones: recepciones.map((r) => aRecepcionDto(r, costos)) };
}
