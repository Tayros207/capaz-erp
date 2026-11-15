import type { Candidata, ProductoDto } from '@capaz/shared';
import type { Producto } from '../repositories/productos.repository.js';

export const aProductoDto = (f: Producto): ProductoDto => ({
  id: f.id,
  codigo: f.codigo,
  nombre: f.nombre,
  tipo: f.tipo as ProductoDto['tipo'],
  unidad: f.unidad,
  precioUnitarioMilesimas: f.precioUnitarioMilesimas,
  afectoIgv: f.afectoIgv,
  descripcion: f.descripcion,
  archivadoEn: f.archivadoEn?.toISOString() ?? null,
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aCandidata = (f: Producto): Candidata => ({ id: f.id, nombre: f.nombre, ...(f.codigo && { detalle: `Código ${f.codigo}` }) });
