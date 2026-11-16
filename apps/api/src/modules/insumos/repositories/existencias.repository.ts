import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { productos, sucursales } from '../../../db/esquema/core-maestros.js';
import { insumosArticulos, insumosExistencias } from '../../../db/esquema/insumos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorPorNombre, decodificarCursorPorNombre } from '../domain/cursor.js';
import { filtroDeBusqueda } from './articulos.repository.js';

// Existencias por artículo y sucursal. La cantidad la cambia SOLO el código que inserta un movimiento, en la misma
// transacción y con la fila bloqueada (`tomarExistencia` + `fijarExistencia`).

export type Sucursal = { id: string; codigo: string; nombre: string };
export type Existencia = {
  id: string;
  articuloId: string;
  productoId: string;
  nombre: string;
  nombreNormalizado: string;
  codigo: string | null;
  unidad: string;
  sucursalId: string;
  sucursalCodigo: string;
  sucursalNombre: string;
  cantidadMilesimas: number;
  minimoMilesimas: number;
  actualizadoEn: Date;
};

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(insumosExistencias.tenantId, ctx.empresaId);

/** La sucursal pedida (o la principal si no se pide), solo si existe en la empresa y no está archivada. */
export async function sucursalParaMover(tx: Transaccion, ctx: ContextoDeEmpresa, sucursalId: string | undefined): Promise<Sucursal | null> {
  const [fila] = await tx
    .select({ id: sucursales.id, codigo: sucursales.codigo, nombre: sucursales.nombre })
    .from(sucursales)
    .where(and(eq(sucursales.tenantId, ctx.empresaId), sucursalId ? eq(sucursales.id, sucursalId) : sql`${sucursales.esPrincipal}`, isNull(sucursales.archivadoEn)));
  return fila ?? null;
}

/**
 * La fila de existencia del artículo en la sucursal, bloqueada con `for update` (la crea en cero si no existe).
 * Dos movimientos a la vez sobre la misma existencia se turnan: el segundo lee lo que dejó el primero.
 */
export async function tomarExistencia(tx: Transaccion, ctx: ContextoDeEmpresa, articuloId: string, sucursalId: string): Promise<{ id: string; cantidadMilesimas: number }> {
  await asegurarExistencia(tx, ctx, articuloId, sucursalId);
  const [fila] = await tx
    .select({ id: insumosExistencias.id, cantidadMilesimas: insumosExistencias.cantidadMilesimas })
    .from(insumosExistencias)
    .where(and(deEmpresa(ctx), eq(insumosExistencias.articuloId, articuloId), eq(insumosExistencias.sucursalId, sucursalId)))
    .for('update');
  if (!fila) throw new Error('No se pudo tomar la existencia.');
  return fila;
}

/** Lo que hay sin bloquear ni crear nada (cero si no hay fila): lo usa el resumen de una crítica. */
export async function cantidadActual(tx: Transaccion, ctx: ContextoDeEmpresa, articuloId: string, sucursalId: string): Promise<number> {
  const [fila] = await tx
    .select({ cantidadMilesimas: insumosExistencias.cantidadMilesimas })
    .from(insumosExistencias)
    .where(and(deEmpresa(ctx), eq(insumosExistencias.articuloId, articuloId), eq(insumosExistencias.sucursalId, sucursalId)));
  return fila?.cantidadMilesimas ?? 0;
}

/** Solo tras `tomarExistencia` y con el movimiento ya insertado en la misma transacción. */
export async function fijarExistencia(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cantidadMilesimas: number): Promise<void> {
  const r = await tx
    .update(insumosExistencias)
    .set({ cantidadMilesimas, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(insumosExistencias.id, id)))
    .returning({ id: insumosExistencias.id });
  if (r.length !== 1) throw new Error('No se pudo fijar la existencia.');
}

/** Crea en cero la existencia del artículo en la sucursal si no la tiene (no cambia una que ya existe). */
export async function asegurarExistencia(tx: Transaccion, ctx: ContextoDeEmpresa, articuloId: string, sucursalId: string): Promise<void> {
  await tx.insert(insumosExistencias).values({ tenantId: ctx.empresaId, articuloId, sucursalId, creadoPor: ctx.usuarioId }).onConflictDoNothing();
}

const columnas = {
  id: insumosExistencias.id,
  articuloId: insumosExistencias.articuloId,
  productoId: insumosArticulos.productoId,
  nombre: productos.nombre,
  nombreNormalizado: productos.nombreNormalizado,
  codigo: productos.codigo,
  unidad: insumosArticulos.unidad,
  sucursalId: insumosExistencias.sucursalId,
  sucursalCodigo: sucursales.codigo,
  sucursalNombre: sucursales.nombre,
  cantidadMilesimas: insumosExistencias.cantidadMilesimas,
  minimoMilesimas: insumosArticulos.minimoMilesimas,
  actualizadoEn: insumosExistencias.actualizadoEn,
};

function consultaDeExistencias(tx: Transaccion) {
  return tx
    .select(columnas)
    .from(insumosExistencias)
    .innerJoin(insumosArticulos, and(eq(insumosArticulos.tenantId, insumosExistencias.tenantId), eq(insumosArticulos.id, insumosExistencias.articuloId)))
    .innerJoin(productos, and(eq(productos.tenantId, insumosArticulos.tenantId), eq(productos.id, insumosArticulos.productoId)))
    .innerJoin(sucursales, and(eq(sucursales.tenantId, insumosExistencias.tenantId), eq(sucursales.id, insumosExistencias.sucursalId)));
}

export async function verExistencia(tx: Transaccion, ctx: ContextoDeEmpresa, articuloId: string, sucursalId: string): Promise<Existencia | null> {
  const [fila] = await consultaDeExistencias(tx).where(and(deEmpresa(ctx), eq(insumosExistencias.articuloId, articuloId), eq(insumosExistencias.sucursalId, sucursalId)));
  return fila ?? null;
}

export type FiltrosDeExistencias = { limite: number; cursor?: string; sucursalId?: string; buscar?: string; buscarNormalizado?: string; soloBajoMinimo: boolean };

/** Existencias de artículos activos, por nombre del producto y id. Bajo mínimo = cantidad menor que el mínimo. */
export async function listarExistencias(tx: Transaccion, ctx: ContextoDeEmpresa, f: FiltrosDeExistencias): Promise<{ items: Existencia[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = f.cursor ? decodificarCursorPorNombre(f.cursor) : null;
  if (f.cursor && !pos) return 'cursor_invalido';
  const filas = await consultaDeExistencias(tx)
    .where(
      and(
        deEmpresa(ctx),
        isNull(insumosArticulos.archivadoEn),
        f.sucursalId ? eq(insumosExistencias.sucursalId, f.sucursalId) : undefined,
        filtroDeBusqueda(f.buscarNormalizado, f.buscar),
        f.soloBajoMinimo ? sql`${insumosExistencias.cantidadMilesimas} < ${insumosArticulos.minimoMilesimas}` : undefined,
        pos ? or(gt(productos.nombreNormalizado, pos.nombre), and(eq(productos.nombreNormalizado, pos.nombre), gt(insumosExistencias.id, pos.id))) : undefined,
      ),
    )
    .orderBy(asc(productos.nombreNormalizado), asc(insumosExistencias.id))
    .limit(f.limite + 1);
  const items = filas.slice(0, f.limite);
  const ultimo = items.at(-1);
  return { items, siguiente: filas.length > f.limite && ultimo ? codificarCursorPorNombre({ nombre: ultimo.nombreNormalizado, id: ultimo.id }) : null };
}

/** Suma de lo que hay del artículo en todas las sucursales. */
export async function existenciaTotal(tx: Transaccion, ctx: ContextoDeEmpresa, articuloId: string): Promise<number> {
  const [fila] = await tx
    .select({ total: sql<string>`coalesce(sum(${insumosExistencias.cantidadMilesimas}), 0)::text` })
    .from(insumosExistencias)
    .where(and(deEmpresa(ctx), eq(insumosExistencias.articuloId, articuloId)));
  return Number(fila?.total ?? 0);
}
