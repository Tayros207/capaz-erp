import { and, asc, eq, getTableColumns, gt, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { productos, sucursales } from '../../../db/esquema/core-maestros.js';
import { insumosArticulos, insumosExistencias } from '../../../db/esquema/insumos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorPorNombre, decodificarCursorPorNombre } from '../domain/cursor.js';

// Artículos bajo control de inventario: reciben la transacción del ejecutor (RLS aísla; el `where` por empresa es
// defensa en profundidad). El nombre y el código son los del producto del núcleo (llave compuesta, R6).

export type Articulo = typeof insumosArticulos.$inferSelect & { nombre: string; codigo: string | null; nombreNormalizado: string };
export type ExistenciaDeArticulo = { articuloId: string; sucursalId: string; sucursalCodigo: string; sucursalNombre: string; cantidadMilesimas: number };
export type ProductoParaArticulo = { id: string; nombre: string; unidad: string; archivado: boolean };
export type FiltroDeArticulos = 'activos' | 'archivados' | 'todos';

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(insumosArticulos.tenantId, ctx.empresaId);
const conProducto = and(eq(productos.tenantId, insumosArticulos.tenantId), eq(productos.id, insumosArticulos.productoId));
const columnas = { ...getTableColumns(insumosArticulos), nombre: productos.nombre, codigo: productos.codigo, nombreNormalizado: productos.nombreNormalizado };

/** Alguna existencia del artículo está por debajo de su mínimo. */
const conAlgunaBajoMinimo = sql`exists (select 1 from insumos.existencias e
  where e.tenant_id = ${insumosArticulos.tenantId} and e.articulo_id = ${insumosArticulos.id} and e.cantidad_milesimas < ${insumosArticulos.minimoMilesimas})`;

/**
 * `bloquear` toma primero la fila del artículo con `for no key update` y después la lee. Todo movimiento del artículo
 * pasa por aquí: dos movimientos del mismo artículo se turnan, y archivar no se cruza con una entrada.
 */
export async function verArticulo(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { bloquear?: boolean } = {}): Promise<Articulo | null> {
  const donde = and(deEmpresa(ctx), eq(insumosArticulos.id, id));
  if (opciones.bloquear) {
    const tomada = await tx.select({ id: insumosArticulos.id }).from(insumosArticulos).where(donde).for('no key update');
    if (tomada.length === 0) return null;
  }
  const [fila] = await tx.select(columnas).from(insumosArticulos).innerJoin(productos, conProducto).where(donde);
  return fila ?? null;
}

export async function articuloDeProducto(tx: Transaccion, ctx: ContextoDeEmpresa, productoId: string): Promise<Articulo | null> {
  const [fila] = await tx.select(columnas).from(insumosArticulos).innerJoin(productos, conProducto).where(and(deEmpresa(ctx), eq(insumosArticulos.productoId, productoId)));
  return fila ?? null;
}

export async function productoParaArticulo(tx: Transaccion, ctx: ContextoDeEmpresa, productoId: string): Promise<ProductoParaArticulo | null> {
  const [fila] = await tx
    .select({ id: productos.id, nombre: productos.nombre, unidad: productos.unidad, archivadoEn: productos.archivadoEn })
    .from(productos)
    .where(and(eq(productos.tenantId, ctx.empresaId), eq(productos.id, productoId)));
  return fila ? { id: fila.id, nombre: fila.nombre, unidad: fila.unidad, archivado: fila.archivadoEn !== null } : null;
}

/** Crea el artículo. `null` si el producto ya tiene artículo (único de la base). */
export async function crearArticulo(tx: Transaccion, ctx: ContextoDeEmpresa, datos: { productoId: string; unidad: string; minimoMilesimas: number }): Promise<string | null> {
  const [fila] = await tx
    .insert(insumosArticulos)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning({ id: insumosArticulos.id });
  return fila?.id ?? null;
}

export type CambiosDeArticulo = { unidad?: string; minimoMilesimas?: number; ultimoCostoMilesimas?: number; archivado?: boolean };

export async function actualizarArticulo(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cambios: CambiosDeArticulo): Promise<void> {
  const { archivado, ...campos } = cambios;
  const r = await tx
    .update(insumosArticulos)
    .set({ ...campos, ...(archivado !== undefined && { archivadoEn: archivado ? sql`now()` : null }), actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(insumosArticulos.id, id)))
    .returning({ id: insumosArticulos.id });
  if (r.length !== 1) throw new Error('No se pudo actualizar el artículo.');
}

/** Las existencias de esos artículos, con su sucursal: la principal primero y después por código. */
export async function existenciasDeArticulos(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Map<string, ExistenciaDeArticulo[]>> {
  const mapa = new Map<string, ExistenciaDeArticulo[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return mapa;
  const filas = await tx
    .select({
      articuloId: insumosExistencias.articuloId,
      sucursalId: insumosExistencias.sucursalId,
      sucursalCodigo: sucursales.codigo,
      sucursalNombre: sucursales.nombre,
      cantidadMilesimas: insumosExistencias.cantidadMilesimas,
    })
    .from(insumosExistencias)
    .innerJoin(sucursales, and(eq(sucursales.tenantId, insumosExistencias.tenantId), eq(sucursales.id, insumosExistencias.sucursalId)))
    .where(and(eq(insumosExistencias.tenantId, ctx.empresaId), inArray(insumosExistencias.articuloId, [...ids])))
    .orderBy(sql`${sucursales.esPrincipal} desc`, asc(sucursales.codigo));
  for (const f of filas) mapa.get(f.articuloId)?.push(f);
  return mapa;
}

export type FiltrosDeArticulos = { limite: number; cursor?: string; estado: FiltroDeArticulos; buscar?: string; soloBajoMinimo: boolean };

function filtroDeEstado(estado: FiltroDeArticulos): SQL | undefined {
  if (estado === 'activos') return isNull(insumosArticulos.archivadoEn);
  if (estado === 'archivados') return isNotNull(insumosArticulos.archivadoEn);
  return undefined;
}

/** `%texto%` con los comodines de LIKE escapados: lo tecleado se busca tal cual. */
export const patronQueContiene = (texto: string): string => `%${texto.replace(/[\\%_]/g, '\\$&')}%`;

/** Busca por el nombre normalizado del producto (contiene) o por su código exacto. */
export const filtroDeBusqueda = (normalizado: string | undefined, crudo: string | undefined): SQL | undefined =>
  normalizado && crudo ? or(sql`${productos.nombreNormalizado} like ${patronQueContiene(normalizado)}`, sql`lower(${productos.codigo}) = lower(${crudo})`) : undefined;

/** Por nombre del producto (ascendente) y id: un catálogo se recorre alfabéticamente. `buscar` llega ya normalizado. */
export async function listarArticulos(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  f: FiltrosDeArticulos & { buscarNormalizado?: string },
): Promise<{ items: Articulo[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = f.cursor ? decodificarCursorPorNombre(f.cursor) : null;
  if (f.cursor && !pos) return 'cursor_invalido';
  const filas = await tx
    .select(columnas)
    .from(insumosArticulos)
    .innerJoin(productos, conProducto)
    .where(
      and(
        deEmpresa(ctx),
        filtroDeEstado(f.estado),
        filtroDeBusqueda(f.buscarNormalizado, f.buscar),
        f.soloBajoMinimo ? conAlgunaBajoMinimo : undefined,
        pos ? or(gt(productos.nombreNormalizado, pos.nombre), and(eq(productos.nombreNormalizado, pos.nombre), gt(insumosArticulos.id, pos.id))) : undefined,
      ),
    )
    .orderBy(asc(productos.nombreNormalizado), asc(insumosArticulos.id))
    .limit(f.limite + 1);
  const items = filas.slice(0, f.limite);
  const ultimo = items.at(-1);
  return { items, siguiente: filas.length > f.limite && ultimo ? codificarCursorPorNombre({ nombre: ultimo.nombreNormalizado, id: ultimo.id }) : null };
}

/** Producto → artículo, solo de los artículos activos: lo que puede entrar al inventario (consumidor de compras). */
export async function articulosActivosPorProducto(tx: Transaccion, ctx: ContextoDeEmpresa, productoIds: readonly string[]): Promise<Map<string, string>> {
  if (productoIds.length === 0) return new Map();
  const filas = await tx
    .select({ productoId: insumosArticulos.productoId, id: insumosArticulos.id })
    .from(insumosArticulos)
    .where(and(deEmpresa(ctx), inArray(insumosArticulos.productoId, [...new Set(productoIds)]), isNull(insumosArticulos.archivadoEn)));
  return new Map(filas.map((f) => [f.productoId, f.id]));
}
