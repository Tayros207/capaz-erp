import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { cotizadorEnlaces } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { VENTANA_DE_VISTA_MS } from '../domain/enlaces.js';

// Repositorio de enlaces públicos. Solo se guarda el sha256 del token. Recibe la transacción del ejecutor (o la de
// `conEmpresa` del controlador público): la RLS aísla y el `where` por empresa es defensa en profundidad.

const t = cotizadorEnlaces;
export type Enlace = typeof t.$inferSelect;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(t.tenantId, ctx.empresaId);

export async function crearEnlace(tx: Transaccion, ctx: ContextoDeEmpresa, d: { cotizacionId: string; version: number; tokenHash: string; venceEn: Date }): Promise<Enlace> {
  const [fila] = await tx.insert(t).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning();
  if (!fila) throw new Error('No se pudo crear el enlace.');
  return fila;
}

export async function listarEnlaces(tx: Transaccion, ctx: ContextoDeEmpresa, cotizacionId: string): Promise<Enlace[]> {
  return tx.select().from(t).where(and(deEmpresa(ctx), eq(t.cotizacionId, cotizacionId))).orderBy(desc(t.creadoEn), asc(t.id));
}

export async function verEnlace(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Enlace | null> {
  const [fila] = await tx.select().from(t).where(and(deEmpresa(ctx), eq(t.id, id)));
  return fila ?? null;
}

/** Lo busca el controlador público ya dentro de la empresa que resolvió el grupo de sistema. */
export async function enlacePorHash(tx: Transaccion, ctx: ContextoDeEmpresa, tokenHash: string): Promise<Enlace | null> {
  const [fila] = await tx.select().from(t).where(and(deEmpresa(ctx), eq(t.tokenHash, tokenHash)));
  return fila ?? null;
}

/** Revoca si estaba vivo; devuelve la fila revocada o `null` si ya estaba revocado (la herramienta es idempotente). */
export async function revocarEnlace(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Enlace | null> {
  const [fila] = await tx.update(t).set({ revocadoEn: sql`now()`, actualizadoEn: sql`now()` }).where(and(deEmpresa(ctx), eq(t.id, id), isNull(t.revocadoEn))).returning();
  return fila ?? null;
}

/** Revoca todos los enlaces vivos de una cotización (al anularla) y devuelve los que revocó. */
export async function revocarEnlacesVivos(tx: Transaccion, ctx: ContextoDeEmpresa, cotizacionId: string): Promise<Enlace[]> {
  return tx.update(t).set({ revocadoEn: sql`now()`, actualizadoEn: sql`now()` }).where(and(deEmpresa(ctx), eq(t.cotizacionId, cotizacionId), isNull(t.revocadoEn))).returning();
}

/** Suma una vista si no se contó otra en la última hora. Una sola sentencia: dos visitas a la vez cuentan una. */
export async function contarVistaDelEnlace(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const filas = await tx
    .update(t)
    .set({ vistas: sql`${t.vistas} + 1`, ultimaVistaEn: sql`now()`, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(t.id, id), sql`(${t.ultimaVistaEn} is null or ${t.ultimaVistaEn} <= now() - make_interval(secs => ${VENTANA_DE_VISTA_MS / 1000}))`))
    .returning({ id: t.id });
  return filas.length === 1;
}
