import { and, asc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA } from '@capaz/shared';
import { registroCategorias } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { normalizarNombre } from '../domain/catalogos.js';

// Repositorio de categorías de ingreso y de egreso. Mismas reglas que el de cuentas.

export type Categoria = typeof registroCategorias.$inferSelect;
export type DatosDeCategoria = { nombre: string; nombreNormalizado: string; tipo: string };

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(registroCategorias.tenantId, ctx.empresaId);

export async function listarCategorias(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  opciones: { tipo?: string; incluirArchivadas: boolean },
): Promise<Categoria[]> {
  const filtros: SQL[] = [deEmpresa(ctx)];
  if (opciones.tipo) filtros.push(eq(registroCategorias.tipo, opciones.tipo));
  if (!opciones.incluirArchivadas) filtros.push(isNull(registroCategorias.archivadoEn));
  return tx
    .select()
    .from(registroCategorias)
    .where(and(...filtros))
    .orderBy(asc(registroCategorias.tipo), asc(registroCategorias.nombreNormalizado), asc(registroCategorias.id));
}

export async function verCategoria(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Categoria | null> {
  const [fila] = await tx.select().from(registroCategorias).where(and(deEmpresa(ctx), eq(registroCategorias.id, id)));
  return fila ?? null;
}

/** La categoría viva con ese nombre y tipo (p. ej. «Cobros» de ingreso para un abono). */
export async function categoriaConNombre(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  tipo: string,
  nombreNormalizado: string,
  salvo?: string,
): Promise<Categoria | null> {
  const filtros: SQL[] = [
    deEmpresa(ctx),
    eq(registroCategorias.tipo, tipo),
    eq(registroCategorias.nombreNormalizado, nombreNormalizado),
    isNull(registroCategorias.archivadoEn),
  ];
  if (salvo) filtros.push(ne(registroCategorias.id, salvo));
  const [fila] = await tx.select().from(registroCategorias).where(and(...filtros));
  return fila ?? null;
}

export async function crearCategoria(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  datos: DatosDeCategoria,
): Promise<{ creada: true; categoria: Categoria } | { creada: false; existente: Categoria }> {
  const [fila] = await tx
    .insert(registroCategorias)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning();
  if (fila) return { creada: true, categoria: fila };
  const existente = await categoriaConNombre(tx, ctx, datos.tipo, datos.nombreNormalizado);
  if (!existente) throw new Error('Conflicto de unicidad de categorías sin fila que lo explique.');
  return { creada: false, existente };
}

/** Cambia el nombre. `null` si no existe; si otra categoría viva del mismo tipo ya lo usa, la devuelve. */
export async function renombrarCategoria(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  id: string,
  datos: { nombre: string; nombreNormalizado: string },
): Promise<{ categoria: Categoria } | { existente: Categoria } | null> {
  const actual = await verCategoria(tx, ctx, id);
  if (!actual) return null;
  const existente = await categoriaConNombre(tx, ctx, actual.tipo, datos.nombreNormalizado, id);
  if (existente) return { existente };
  const [fila] = await tx
    .update(registroCategorias)
    .set(datos)
    .where(and(deEmpresa(ctx), eq(registroCategorias.id, id)))
    .returning();
  return fila ? { categoria: fila } : null;
}

/** Archiva (idempotente). `null` si no existe. */
export async function archivarCategoria(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Categoria | null> {
  const [fila] = await tx
    .update(registroCategorias)
    .set({ archivadoEn: sql`coalesce(${registroCategorias.archivadoEn}, now())` })
    .where(and(deEmpresa(ctx), eq(registroCategorias.id, id)))
    .returning();
  return fila ?? null;
}

/**
 * Las dos categorías reservadas «Transferencia» (de ingreso y de egreso). Se crean si faltan (empresas que ya tenían
 * catálogo antes de existir las transferencias); segura ante dos transferencias a la vez por el índice único.
 */
export async function categoriasDeTransferencia(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<{ ingreso: string; egreso: string }> {
  const nombreNormalizado = normalizarNombre(NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA);
  await tx
    .insert(registroCategorias)
    .values((['ingreso', 'egreso'] as const).map((tipo) => ({ tenantId: ctx.empresaId, nombre: NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA, nombreNormalizado, tipo, creadoPor: ctx.usuarioId })))
    .onConflictDoNothing();
  const filas = await tx
    .select({ id: registroCategorias.id, tipo: registroCategorias.tipo })
    .from(registroCategorias)
    .where(and(deEmpresa(ctx), eq(registroCategorias.nombreNormalizado, nombreNormalizado), isNull(registroCategorias.archivadoEn)));
  const ingreso = filas.find((f) => f.tipo === 'ingreso');
  const egreso = filas.find((f) => f.tipo === 'egreso');
  if (!ingreso || !egreso) throw new Error('No se pudieron preparar las categorías de transferencia.');
  return { ingreso: ingreso.id, egreso: egreso.id };
}
