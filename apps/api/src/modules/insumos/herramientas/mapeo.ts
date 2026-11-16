import type { ArticuloDto, ExistenciaDto, MovimientoDeInsumoDto, TipoDeMovimientoDeInsumo } from '@capaz/shared';
import { estaBajoMinimo } from '../domain/existencia.js';
import type { Articulo, ExistenciaDeArticulo } from '../repositories/articulos.repository.js';
import type { Existencia } from '../repositories/existencias.repository.js';
import type { Movimiento } from '../repositories/movimientos.repository.js';

// Fila → DTO de las herramientas de inventario. Las fechas salen en ISO.

const iso = (f: Date | null) => f?.toISOString() ?? null;

export function aArticuloDto(a: Articulo, existencias: readonly ExistenciaDeArticulo[]): ArticuloDto {
  const porSucursal = existencias.map((e) => ({
    sucursalId: e.sucursalId,
    sucursalCodigo: e.sucursalCodigo,
    sucursalNombre: e.sucursalNombre,
    cantidadMilesimas: e.cantidadMilesimas,
    bajoMinimo: estaBajoMinimo(e.cantidadMilesimas, a.minimoMilesimas),
  }));
  return {
    id: a.id,
    productoId: a.productoId,
    nombre: a.nombre,
    codigo: a.codigo,
    unidad: a.unidad,
    minimoMilesimas: a.minimoMilesimas,
    ultimoCostoMilesimas: a.ultimoCostoMilesimas,
    existenciaTotalMilesimas: porSucursal.reduce((suma, e) => suma + e.cantidadMilesimas, 0),
    bajoMinimo: porSucursal.some((e) => e.bajoMinimo),
    existencias: porSucursal,
    archivadoEn: iso(a.archivadoEn),
    creadoEn: a.creadoEn.toISOString(),
    actualizadoEn: a.actualizadoEn.toISOString(),
  };
}

export const aExistenciaDto = (e: Existencia): ExistenciaDto => ({
  id: e.id,
  articuloId: e.articuloId,
  productoId: e.productoId,
  nombre: e.nombre,
  codigo: e.codigo,
  unidad: e.unidad,
  sucursalId: e.sucursalId,
  sucursalCodigo: e.sucursalCodigo,
  sucursalNombre: e.sucursalNombre,
  cantidadMilesimas: e.cantidadMilesimas,
  minimoMilesimas: e.minimoMilesimas,
  bajoMinimo: estaBajoMinimo(e.cantidadMilesimas, e.minimoMilesimas),
  actualizadoEn: e.actualizadoEn.toISOString(),
});

export const aMovimientoDto = (m: Movimiento): MovimientoDeInsumoDto => ({
  id: m.id,
  articuloId: m.articuloId,
  nombre: m.nombre,
  unidad: m.unidad,
  sucursalId: m.sucursalId,
  sucursalCodigo: m.sucursalCodigo,
  tipo: m.tipo as TipoDeMovimientoDeInsumo,
  cantidadMilesimas: m.cantidadMilesimas,
  existenciaResultanteMilesimas: m.existenciaResultanteMilesimas,
  costoUnitarioMilesimas: m.costoUnitarioMilesimas,
  motivo: m.motivo,
  origenTipo: m.origenTipo,
  origenId: m.origenId,
  creadoPor: m.creadoPor,
  creadoEn: m.creadoEn.toISOString(),
});
