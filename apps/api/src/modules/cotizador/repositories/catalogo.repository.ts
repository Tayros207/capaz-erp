import { and, asc, eq, getTableColumns, ilike, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { productos } from '../../../db/esquema/core-maestros.js';
import { cotizadorListasDePrecio } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { ListaDePrecio } from './listas.repository.js';

// Búsqueda de productos para cotizar: catálogo (`core.productos`, solo lectura) y su lista activa. La consulta de parecido
// es una copia de la del catálogo (un módulo no importa a otro); el esquema de `core` sí se lee, como en `productoVivo`.

const l = cotizadorListasDePrecio;
export type ProductoDeCatalogo = typeof productos.$inferSelect;
const sinComodines = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Productos activos por parecido de nombre, contiene o código exacto; los más parecidos primero. */
export async function buscarProductosParaCotizar(tx: Transaccion, ctx: ContextoDeEmpresa, texto: string, limite: number): Promise<ProductoDeCatalogo[]> {
  const parecido = sql<number>`similarity(${productos.nombreNormalizado}, ${texto}::text)`;
  const contiene = ilike(productos.nombreNormalizado, `%${sinComodines(texto)}%`);
  return tx
    .select(getTableColumns(productos))
    .from(productos)
    .where(and(eq(productos.tenantId, ctx.empresaId), isNull(productos.archivadoEn), or(sql`${productos.nombreNormalizado} % ${texto}::text`, contiene, sql`upper(${productos.codigo}) = upper(${texto})`)))
    .orderBy(sql`${parecido} desc`, asc(productos.nombreNormalizado))
    .limit(limite);
}

/** Los primeros productos activos por orden alfabético: lo que se ofrece al abrir el buscador sin haber escrito nada. */
export async function primerosProductosParaCotizar(tx: Transaccion, ctx: ContextoDeEmpresa, limite: number): Promise<ProductoDeCatalogo[]> {
  return tx
    .select(getTableColumns(productos))
    .from(productos)
    .where(and(eq(productos.tenantId, ctx.empresaId), isNull(productos.archivadoEn)))
    .orderBy(asc(productos.nombreNormalizado), asc(productos.id))
    .limit(limite);
}

/** La lista activa de cada producto (si hay dos, la más antigua; la comprobación de «una por producto» evita que ocurra). */
export async function listasActivasDeProductos(tx: Transaccion, ctx: ContextoDeEmpresa, productoIds: string[]): Promise<Map<string, ListaDePrecio>> {
  if (productoIds.length === 0) return new Map();
  const filas = await tx
    .select()
    .from(l)
    .where(and(eq(l.tenantId, ctx.empresaId), isNull(l.archivadoEn), inArray(l.productoId, productoIds)))
    .orderBy(asc(l.creadoEn), asc(l.id));
  const porProducto = new Map<string, ListaDePrecio>();
  for (const f of filas) if (f.productoId && !porProducto.has(f.productoId)) porProducto.set(f.productoId, f);
  return porProducto;
}

/** Listas activas sin producto (las heredadas de Cotizín) cuyo nombre contiene el texto. */
export async function listasSinProductoPorNombre(tx: Transaccion, ctx: ContextoDeEmpresa, texto: string, limite: number): Promise<ListaDePrecio[]> {
  return tx
    .select()
    .from(l)
    .where(and(eq(l.tenantId, ctx.empresaId), isNull(l.archivadoEn), isNull(l.productoId), like(l.nombreNormalizado, `%${sinComodines(texto)}%`)))
    .orderBy(asc(l.nombreNormalizado), asc(l.id))
    .limit(limite);
}
