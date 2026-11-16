import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { crmEtapas, crmOportunidades } from '../../../db/esquema/crm.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { normalizarNombre } from '../../../core/clientes/domain/normalizacion.js';
import { ETAPAS_POR_DEFECTO, type EtapaViva, type TipoDeEtapa } from '../domain/etapas.js';

// Etapas del embudo. Reciben la transacción de `conEmpresa` (RLS aísla; el `where` por empresa es defensa en profundidad).

export type Etapa = typeof crmEtapas.$inferSelect;

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(crmEtapas.tenantId, ctx.empresaId);

export const comoViva = (e: Etapa): EtapaViva => ({ id: e.id, tipo: e.tipo as TipoDeEtapa, orden: e.orden, archivada: e.archivadoEn !== null });

/** Serializa los cambios de etapas de una empresa (crear, ordenar, archivar no se pisan). */
export async function bloquearEtapas(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'crm.etapas:' + ctx.empresaId}))`);
}

/**
 * Catálogo por defecto (R10): solo si la empresa aún no tiene ninguna etapa (ni archivada), para no
 * resucitar las que archivó. Idempotente: dos llamadas a la vez chocan en el único por nombre y no duplican.
 */
export async function asegurarCatalogos(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<number> {
  const [hay] = await tx.select({ n: count() }).from(crmEtapas).where(deEmpresa(ctx));
  if ((hay?.n ?? 0) > 0) return 0;
  const filas = await tx
    .insert(crmEtapas)
    .values(ETAPAS_POR_DEFECTO.map((e) => ({ ...e, nombreNormalizado: normalizarNombre(e.nombre), tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })))
    .onConflictDoNothing()
    .returning({ id: crmEtapas.id });
  return filas.length;
}

/** Vivas primero, por `orden`; las archivadas al final. */
export async function listarEtapas(tx: Transaccion, ctx: ContextoDeEmpresa, incluirArchivadas = false): Promise<Etapa[]> {
  return tx
    .select()
    .from(crmEtapas)
    .where(and(deEmpresa(ctx), incluirArchivadas ? undefined : isNull(crmEtapas.archivadoEn)))
    .orderBy(sql`${crmEtapas.archivadoEn} is not null`, asc(crmEtapas.orden), asc(crmEtapas.nombreNormalizado));
}

export async function verEtapa(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Etapa | null> {
  const [fila] = await tx.select().from(crmEtapas).where(and(deEmpresa(ctx), eq(crmEtapas.id, id)));
  return fila ?? null;
}

/** La etapa viva de un tipo de cierre (siempre existe una tras `asegurarCatalogos`). */
export async function etapaDeCierre(tx: Transaccion, ctx: ContextoDeEmpresa, tipo: 'ganada' | 'perdida'): Promise<Etapa | null> {
  const [fila] = await tx.select().from(crmEtapas).where(and(deEmpresa(ctx), eq(crmEtapas.tipo, tipo), isNull(crmEtapas.archivadoEn)));
  return fila ?? null;
}

async function porNombre(tx: Transaccion, ctx: ContextoDeEmpresa, nombreNormalizado: string): Promise<Etapa | null> {
  const [fila] = await tx
    .select()
    .from(crmEtapas)
    .where(and(deEmpresa(ctx), eq(crmEtapas.nombreNormalizado, nombreNormalizado), isNull(crmEtapas.archivadoEn)));
  return fila ?? null;
}

export type ResultadoDeEtapa = { etapa: Etapa } | { conflicto: Etapa };

export async function crearEtapa(tx: Transaccion, ctx: ContextoDeEmpresa, nombre: string, orden: number): Promise<ResultadoDeEtapa> {
  const nombreNormalizado = normalizarNombre(nombre);
  const [fila] = await tx
    .insert(crmEtapas)
    .values({ tenantId: ctx.empresaId, nombre, nombreNormalizado, orden, tipo: 'abierta', creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning();
  if (fila) return { etapa: fila };
  const existente = await porNombre(tx, ctx, nombreNormalizado);
  if (!existente) throw new Error('Choque de unicidad de etapas sin fila que lo explique.');
  return { conflicto: existente };
}

/** `null` si no existe. */
export async function renombrarEtapa(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, nombre: string): Promise<ResultadoDeEtapa | null> {
  const actual = await verEtapa(tx, ctx, id);
  if (!actual) return null;
  const nombreNormalizado = normalizarNombre(nombre);
  const otra = actual.archivadoEn ? null : await porNombre(tx, ctx, nombreNormalizado);
  if (otra && otra.id !== id) return { conflicto: otra };
  const [fila] = await tx.update(crmEtapas).set({ nombre, nombreNormalizado }).where(and(deEmpresa(ctx), eq(crmEtapas.id, id))).returning();
  return { etapa: fila! };
}

/** Guarda el `orden` de cada etapa (como mucho 32 filas). */
export async function guardarOrden(tx: Transaccion, ctx: ContextoDeEmpresa, asignaciones: ReadonlyArray<{ id: string; orden: number }>): Promise<void> {
  for (const a of asignaciones) {
    await tx
      .update(crmEtapas)
      .set({ orden: a.orden })
      .where(and(deEmpresa(ctx), eq(crmEtapas.id, a.id), sql`${crmEtapas.orden} <> ${a.orden}`));
  }
}

export async function archivarEtapa(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Etapa> {
  const [fila] = await tx
    .update(crmEtapas)
    .set({ archivadoEn: sql`coalesce(${crmEtapas.archivadoEn}, now())` })
    .where(and(deEmpresa(ctx), eq(crmEtapas.id, id)))
    .returning();
  return fila!;
}

/** Cuántas oportunidades abiertas hay en la etapa (de toda la empresa, sin alcance). */
export async function abiertasEnEtapa(tx: Transaccion, ctx: ContextoDeEmpresa, etapaId: string): Promise<number> {
  const [r] = await tx
    .select({ n: count() })
    .from(crmOportunidades)
    .where(and(eq(crmOportunidades.tenantId, ctx.empresaId), eq(crmOportunidades.etapaId, etapaId), eq(crmOportunidades.estado, 'abierta')));
  return r?.n ?? 0;
}
