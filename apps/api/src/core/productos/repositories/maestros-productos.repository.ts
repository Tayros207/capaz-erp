import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { categoriasProducto, productoFicha, productoUnidades } from '../../../db/esquema/core-maestros-ampliados.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Repositorio de categorías, ficha y unidades de los productos. Recibe la transacción de `conEmpresa`.

export type Categoria = typeof categoriasProducto.$inferSelect;
export type FichaDeProducto = typeof productoFicha.$inferSelect;
export type UnidadDeProducto = typeof productoUnidades.$inferSelect;
export type CambiosDeFicha = Partial<Omit<FichaDeProducto, 'tenantId' | 'productoId' | 'creadoEn' | 'actualizadoEn' | 'actualizadoPor' | 'pesoGramos'>> & {
  pesoGramos?: string | null;
};

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(categoriasProducto.tenantId, ctx.empresaId);

export async function listarCategorias(tx: Transaccion, ctx: ContextoDeEmpresa, incluirArchivadas: boolean): Promise<Categoria[]> {
  return tx
    .select()
    .from(categoriasProducto)
    .where(and(deEmpresa(ctx), incluirArchivadas ? sql`true` : isNull(categoriasProducto.archivadoEn)))
    .orderBy(asc(categoriasProducto.nombreNormalizado), asc(categoriasProducto.id));
}

export async function verCategoria(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Categoria | null> {
  const [f] = await tx.select().from(categoriasProducto).where(and(deEmpresa(ctx), eq(categoriasProducto.id, id)));
  return f ?? null;
}

/** ¿El ancestro `candidato` está en la cadena de padres de `id`? Evita ciclos en el árbol. */
export async function esDescendiente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, candidato: string): Promise<boolean> {
  let actual: string | null = candidato;
  for (let i = 0; i < 50 && actual; i++) {
    if (actual === id) return true;
    actual = (await verCategoria(tx, ctx, actual))?.padreId ?? null;
  }
  return false;
}

export async function porNombreNormalizado(tx: Transaccion, ctx: ContextoDeEmpresa, nombreNormalizado: string): Promise<Categoria | null> {
  const [f] = await tx
    .select()
    .from(categoriasProducto)
    .where(and(deEmpresa(ctx), eq(categoriasProducto.nombreNormalizado, nombreNormalizado), isNull(categoriasProducto.archivadoEn)));
  return f ?? null;
}

type DatosDeCategoria = { nombre: string; nombreNormalizado: string; padreId: string | null };

export async function guardarCategoria(tx: Transaccion, ctx: ContextoDeEmpresa, id: string | undefined, d: DatosDeCategoria): Promise<Categoria | null> {
  if (!id) {
    const [f] = await tx.insert(categoriasProducto).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning();
    return f!;
  }
  const [f] = await tx
    .update(categoriasProducto)
    .set({ ...d, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(categoriasProducto.id, id)))
    .returning();
  return f ?? null;
}

export async function archivarCategoria(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Categoria | null> {
  const [f] = await tx
    .update(categoriasProducto)
    .set({ archivadoEn: sql`coalesce(${categoriasProducto.archivadoEn}, now())`, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(categoriasProducto.id, id)))
    .returning();
  return f ?? null;
}

export async function verFicha(tx: Transaccion, ctx: ContextoDeEmpresa, productoId: string): Promise<FichaDeProducto | null> {
  const [f] = await tx.select().from(productoFicha).where(and(eq(productoFicha.tenantId, ctx.empresaId), eq(productoFicha.productoId, productoId)));
  return f ?? null;
}

export async function guardarFicha(tx: Transaccion, ctx: ContextoDeEmpresa, productoId: string, cambios: CambiosDeFicha): Promise<FichaDeProducto> {
  const [f] = await tx
    .insert(productoFicha)
    .values({ ...cambios, tenantId: ctx.empresaId, productoId, actualizadoPor: ctx.usuarioId })
    .onConflictDoUpdate({
      target: [productoFicha.tenantId, productoFicha.productoId],
      set: { ...cambios, actualizadoPor: ctx.usuarioId, actualizadoEn: sql`now()` },
    })
    .returning();
  return f!;
}

/** Otro producto que ya usa ese SKU o código de barras (para rechazar con un mensaje claro). */
export async function productoConCodigo(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  campo: 'sku' | 'codigoBarras',
  valor: string,
  propio: string,
): Promise<string | null> {
  const col = campo === 'sku' ? productoFicha.sku : productoFicha.codigoBarras;
  const [f] = await tx
    .select({ id: productoFicha.productoId })
    .from(productoFicha)
    .where(and(eq(productoFicha.tenantId, ctx.empresaId), eq(col, valor), sql`${productoFicha.productoId} <> ${propio}`));
  return f?.id ?? null;
}

export async function listarUnidades(tx: Transaccion, ctx: ContextoDeEmpresa, productoId: string): Promise<UnidadDeProducto[]> {
  return tx
    .select()
    .from(productoUnidades)
    .where(and(eq(productoUnidades.tenantId, ctx.empresaId), eq(productoUnidades.productoId, productoId)))
    .orderBy(asc(productoUnidades.unidad));
}

/** Una fila por producto y unidad: si ya existe, se actualiza su equivalencia. */
export async function guardarUnidad(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  d: { productoId: string; unidad: string; factorMilesimas: number; paraCompra: boolean; paraVenta: boolean },
): Promise<UnidadDeProducto> {
  const [f] = await tx
    .insert(productoUnidades)
    .values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoUpdate({
      target: [productoUnidades.tenantId, productoUnidades.productoId, productoUnidades.unidad],
      set: { factorMilesimas: d.factorMilesimas, paraCompra: d.paraCompra, paraVenta: d.paraVenta, actualizadoEn: sql`now()` },
    })
    .returning();
  return f!;
}

export async function eliminarUnidad(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const r = await tx.delete(productoUnidades).where(and(eq(productoUnidades.tenantId, ctx.empresaId), eq(productoUnidades.id, id))).returning({ id: productoUnidades.id });
  return r.length > 0;
}
