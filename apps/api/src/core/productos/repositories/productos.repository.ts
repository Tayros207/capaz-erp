import { and, asc, getTableColumns, eq, gt, ilike, isNull, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { productos } from '../../../db/esquema/core-maestros.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursor, decodificarCursor } from '../../clientes/domain/cursor.js';
import type { DatosDeProducto } from '../domain/producto.js';

// Repositorio de productos: recibe la transacción de `conEmpresa`.

export type Producto = typeof productos.$inferSelect;
export type Pagina<T> = { items: T[]; siguiente: string | null };
export type EstadoDeListado = 'activos' | 'archivados' | 'todos';
export type Choque = { conflicto: 'nombre' | 'codigo'; existente: Producto };

export type ResultadoDeCrear = { creado: true; producto: Producto } | ({ creado: false } & Choque);

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(productos.tenantId, ctx.empresaId);

/** El choque que impediría guardar estos datos (ignorando al propio, si se edita). Considera solo activos para el nombre. */
async function buscarChoque(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeProducto, propio?: string): Promise<Choque | null> {
  const sinMi = propio ? sql`${productos.id} <> ${propio}` : sql`true`;
  const [porNombre] = await tx
    .select()
    .from(productos)
    .where(and(deEmpresa(ctx), sinMi, isNull(productos.archivadoEn), eq(productos.nombreNormalizado, datos.nombreNormalizado)));
  if (porNombre) return { conflicto: 'nombre', existente: porNombre };
  if (!datos.codigo) return null;
  const [porCodigo] = await tx.select().from(productos).where(and(deEmpresa(ctx), sinMi, eq(productos.codigo, datos.codigo)));
  return porCodigo ? { conflicto: 'codigo', existente: porCodigo } : null;
}

export async function crearProducto(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeProducto): Promise<ResultadoDeCrear> {
  const [fila] = await tx
    .insert(productos)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning();
  if (fila) return { creado: true, producto: fila };
  const choque = await buscarChoque(tx, ctx, datos);
  if (!choque) throw new Error('Conflicto de unicidad de productos sin fila que lo explique.');
  return { creado: false, ...choque };
}

export async function verProducto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Producto | null> {
  const [fila] = await tx.select().from(productos).where(and(deEmpresa(ctx), eq(productos.id, id)));
  return fila ?? null;
}

/** Reemplaza los datos editables. `null` si no existe. */
export async function editarProducto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, datos: DatosDeProducto): Promise<{ producto: Producto } | Choque | null> {
  const actual = await verProducto(tx, ctx, id);
  if (!actual) return null;
  // Un archivado no compite por el nombre: no se le exige unicidad hasta restaurarlo.
  const choque = actual.archivadoEn ? null : await buscarChoque(tx, ctx, datos, id);
  if (choque) return choque;
  const [fila] = await tx
    .update(productos)
    .set({ ...datos, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(productos.id, id)))
    .returning();
  return { producto: fila! };
}

export async function listarProductos(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  opciones: { limite: number; cursor?: string; estado?: EstadoDeListado },
): Promise<Pagina<Producto> | 'cursor_invalido'> {
  const filtros: SQL[] = [deEmpresa(ctx)];
  const estado = opciones.estado ?? 'activos';
  if (estado === 'activos') filtros.push(isNull(productos.archivadoEn));
  if (estado === 'archivados') filtros.push(isNotNull(productos.archivadoEn));
  if (opciones.cursor) {
    const pos = decodificarCursor(opciones.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(gt(productos.nombreNormalizado, pos.nombre), and(eq(productos.nombreNormalizado, pos.nombre), gt(productos.id, pos.id)))!);
  }
  const filas = await tx
    .select()
    .from(productos)
    .where(and(...filtros))
    .orderBy(asc(productos.nombreNormalizado), asc(productos.id))
    .limit(opciones.limite + 1);
  const hayMas = filas.length > opciones.limite;
  const items = hayMas ? filas.slice(0, opciones.limite) : filas;
  const ultimo = items.at(-1);
  return { items, siguiente: hayMas && ultimo ? codificarCursor({ nombre: ultimo.nombreNormalizado, id: ultimo.id }) : null };
}

/** Mejores candidatos por parecido del nombre (`pg_trgm`) o por contener el texto, o por código exacto. Solo activos. */
export async function buscarProductos(tx: Transaccion, ctx: ContextoDeEmpresa, textoNormalizado: string, limite: number): Promise<Array<Producto & { parecido: number }>> {
  const parecido = sql<number>`similarity(${productos.nombreNormalizado}, ${textoNormalizado}::text)`;
  const contiene = ilike(productos.nombreNormalizado, `%${textoNormalizado.replace(/[\\%_]/g, '\\$&')}%`);
  return tx
    .select({ ...getTableColumns(productos), parecido })
    .from(productos)
    .where(
      and(
        deEmpresa(ctx),
        isNull(productos.archivadoEn),
        or(sql`${productos.nombreNormalizado} % ${textoNormalizado}::text`, contiene, sql`upper(${productos.codigo}) = upper(${textoNormalizado})`),
      ),
    )
    .orderBy(sql`${parecido} desc`, asc(productos.nombreNormalizado))
    .limit(limite);
}

export async function archivarProducto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Producto | null> {
  const [fila] = await tx
    .update(productos)
    .set({ archivadoEn: sql`coalesce(${productos.archivadoEn}, now())`, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(productos.id, id)))
    .returning();
  return fila ?? null;
}

/** Restaura (idempotente). Si otro producto activo ya tomó el nombre, devuelve el choque. `null` si no existe. */
export async function restaurarProducto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<{ producto: Producto } | Choque | null> {
  const actual = await verProducto(tx, ctx, id);
  if (!actual) return null;
  if (!actual.archivadoEn) return { producto: actual };
  const [otro] = await tx
    .select()
    .from(productos)
    .where(and(deEmpresa(ctx), isNull(productos.archivadoEn), eq(productos.nombreNormalizado, actual.nombreNormalizado), sql`${productos.id} <> ${id}`));
  if (otro) return { conflicto: 'nombre', existente: otro };
  const [fila] = await tx
    .update(productos)
    .set({ archivadoEn: null, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(productos.id, id)))
    .returning();
  return { producto: fila! };
}
