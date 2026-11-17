import type { ListaDePrecioDto } from '@capaz/shared';
import type { HoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { nombresDeProductos, type ListaDePrecio } from '../repositories/listas.repository.js';
import { aListaDto } from './mapeo.js';

/** Filas → DTO con el nombre del producto enlazado, leído con una sola consulta para todas. */
export async function listasADto(tx: Transaccion, ctx: ContextoDeEmpresa, filas: ListaDePrecio[], hoy: HoyDeLaEmpresa): Promise<ListaDePrecioDto[]> {
  const nombres = await nombresDeProductos(tx, ctx, [...new Set(filas.flatMap((f) => (f.productoId ? [f.productoId] : [])))]);
  return filas.map((f) => aListaDto(f, hoy, f.productoId ? (nombres.get(f.productoId) ?? null) : null));
}

export async function listaADto(tx: Transaccion, ctx: ContextoDeEmpresa, fila: ListaDePrecio, hoy: HoyDeLaEmpresa): Promise<ListaDePrecioDto> {
  return (await listasADto(tx, ctx, [fila], hoy))[0]!;
}
