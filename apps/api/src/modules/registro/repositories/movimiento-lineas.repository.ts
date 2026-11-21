import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { LineaCalculada } from '@capaz/shared';
import { productos } from '../../../db/esquema/core-maestros.js';
import { registroMovimientoLineas } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Productos de un movimiento. Solo se insertan junto con el movimiento: la base rechaza cambiarlos o borrarlos.

const l = registroMovimientoLineas;
export type LineaDeMovimiento = typeof registroMovimientoLineas.$inferSelect;

export async function insertarLineasDeMovimiento(tx: Transaccion, ctx: ContextoDeEmpresa, movimientoId: string, lineas: readonly LineaCalculada[]): Promise<void> {
  if (lineas.length === 0) return;
  await tx.insert(l).values(
    lineas.map((x, orden) => ({
      tenantId: ctx.empresaId,
      movimientoId,
      orden,
      productoId: x.productoId,
      descripcion: x.descripcion,
      unidad: x.unidad,
      cantidadMilesimas: x.cantidadMilesimas,
      precioUnitarioMilesimas: x.precioUnitarioMilesimas,
      subtotalCentimos: x.subtotalCentimos,
    })),
  );
}

/** Las líneas de cada movimiento (clave: id del movimiento), en su orden. Una sola consulta para toda la página. */
export async function lineasDeMovimientos(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Map<string, LineaDeMovimiento[]>> {
  const porMovimiento = new Map<string, LineaDeMovimiento[]>();
  if (ids.length === 0) return porMovimiento;
  const filas = await tx
    .select()
    .from(l)
    .where(and(eq(l.tenantId, ctx.empresaId), inArray(l.movimientoId, [...ids])))
    .orderBy(asc(l.movimientoId), asc(l.orden));
  for (const f of filas) porMovimiento.set(f.movimientoId, [...(porMovimiento.get(f.movimientoId) ?? []), f]);
  return porMovimiento;
}

/** Los productos del catálogo de esta empresa (vivos) entre los indicados. */
export async function productosVivos(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filas = await tx
    .select({ id: productos.id })
    .from(productos)
    .where(and(eq(productos.tenantId, ctx.empresaId), inArray(productos.id, [...ids]), isNull(productos.archivadoEn)));
  return new Set(filas.map((f) => f.id));
}
