import { and, asc, count, eq, isNull, ne, sql } from 'drizzle-orm';
import { cotizadorFormatosPliego, cotizadorItemsDelCuadro, cotizadorMaquinas, cotizadorTarifas } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { SemillaDelTaller } from '../domain/taller-semilla.js';
import { bloquearPorId, editarPorId, insertarUnica, listarPorNombre, verPorId, archivarPorId, activaConNombre, type FiltrosPorNombre } from './taller-comun.repository.js';

// Los cuatro catálogos del taller, cada uno con su forma. Lo común está en `taller-comun.repository.ts`.

const f = cotizadorFormatosPliego;
const m = cotizadorMaquinas;
const t = cotizadorTarifas;
const i = cotizadorItemsDelCuadro;

export type FormatoDePliego = typeof f.$inferSelect;
export type Maquina = typeof m.$inferSelect;
export type Tarifa = typeof t.$inferSelect;
export type ItemDelCuadro = typeof i.$inferSelect;
export type EtapaGuardada = { nombre: string; mermaPct: string; arranque: string };

// --- Formatos ---
export const listarFormatos = (tx: Transaccion, ctx: ContextoDeEmpresa, fl: FiltrosPorNombre & { tipo?: string }) =>
  listarPorNombre(tx, ctx, f, { ...fl, extra: fl.tipo ? eq(f.tipo, fl.tipo) : undefined });
export const verFormato = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => verPorId(tx, ctx, f, id);
export const bloquearFormato = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => bloquearPorId(tx, ctx, f, id);
export const formatoActivoConNombre = (tx: Transaccion, ctx: ContextoDeEmpresa, n: string, salvo?: string) => activaConNombre(tx, ctx, f, n, salvo);
export const crearFormato = (tx: Transaccion, ctx: ContextoDeEmpresa, d: { nombre: string; nombreNormalizado: string; anchoCm: string; altoCm: string; tipo: string }) => insertarUnica(tx, ctx, f, d);
export const editarFormato = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string, c: Record<string, unknown>) => editarPorId(tx, ctx, f, id, c);
export const archivarFormato = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => archivarPorId(tx, ctx, f, id);

// --- Máquinas ---
export const listarMaquinas = (tx: Transaccion, ctx: ContextoDeEmpresa, fl: FiltrosPorNombre) => listarPorNombre(tx, ctx, m, fl);
export const verMaquina = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => verPorId(tx, ctx, m, id);
export const bloquearMaquina = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => bloquearPorId(tx, ctx, m, id);
export const maquinaActivaConNombre = (tx: Transaccion, ctx: ContextoDeEmpresa, n: string, salvo?: string) => activaConNombre(tx, ctx, m, n, salvo);
export const crearMaquina = (tx: Transaccion, ctx: ContextoDeEmpresa, d: Record<string, unknown> & { nombreNormalizado: string }) => insertarUnica(tx, ctx, m, d);
export const editarMaquina = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string, c: Record<string, unknown>) => editarPorId(tx, ctx, m, id, c);
export const archivarMaquina = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => archivarPorId(tx, ctx, m, id);

// --- Tarifas ---
export const listarTarifas = (tx: Transaccion, ctx: ContextoDeEmpresa, fl: FiltrosPorNombre & { factor?: string }) =>
  listarPorNombre(tx, ctx, t, { ...fl, extra: fl.factor ? eq(t.factor, fl.factor) : undefined });
export const verTarifa = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => verPorId(tx, ctx, t, id);
export const bloquearTarifa = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => bloquearPorId(tx, ctx, t, id);
export const tarifaActivaConNombre = (tx: Transaccion, ctx: ContextoDeEmpresa, n: string, salvo?: string) => activaConNombre(tx, ctx, t, n, salvo);
export const crearTarifa = (tx: Transaccion, ctx: ContextoDeEmpresa, d: Record<string, unknown> & { nombreNormalizado: string }) => insertarUnica(tx, ctx, t, d);
export const editarTarifa = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string, c: Record<string, unknown>) => editarPorId(tx, ctx, t, id, c);
export const archivarTarifa = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => archivarPorId(tx, ctx, t, id);

/** El formato activo con ese id (para enlazar una tarifa), o `null`. */
export async function formatoVivo(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<FormatoDePliego | null> {
  const [fila] = await tx.select().from(f).where(and(eq(f.tenantId, ctx.empresaId), eq(f.id, id), isNull(f.archivadoEn)));
  return fila ?? null;
}

// --- Ítems del cuadro: van por posición, no por nombre ---
export async function listarItems(tx: Transaccion, ctx: ContextoDeEmpresa, estado: 'activas' | 'archivadas' | 'todas'): Promise<ItemDelCuadro[]> {
  const e = estado === 'activas' ? isNull(i.archivadoEn) : estado === 'archivadas' ? sql`${i.archivadoEn} is not null` : undefined;
  return tx.select().from(i).where(and(eq(i.tenantId, ctx.empresaId), e)).orderBy(asc(i.posicion), asc(i.id));
}
export const verItem = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => verPorId(tx, ctx, i, id);
export const bloquearItem = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => bloquearPorId(tx, ctx, i, id);
export const itemActivoConNombre = (tx: Transaccion, ctx: ContextoDeEmpresa, n: string, salvo?: string) => activaConNombre(tx, ctx, i, n, salvo);
export const editarItem = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string, c: Record<string, unknown>) => editarPorId(tx, ctx, i, id, c);
export const archivarItem = (tx: Transaccion, ctx: ContextoDeEmpresa, id: string) => archivarPorId(tx, ctx, i, id);

/** Cuántos ítems activos hay y la siguiente posición libre. */
export async function resumenDeItems(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<{ activos: number; siguientePosicion: number }> {
  const [r] = await tx
    .select({ activos: count(), maxima: sql<number | null>`max(${i.posicion})` })
    .from(i)
    .where(and(eq(i.tenantId, ctx.empresaId), isNull(i.archivadoEn)));
  return { activos: r?.activos ?? 0, siguientePosicion: r?.maxima === null || r?.maxima === undefined ? 0 : Number(r.maxima) + 1 };
}
export const crearItem = async (tx: Transaccion, ctx: ContextoDeEmpresa, d: Record<string, unknown> & { nombreNormalizado: string }) => insertarUnica(tx, ctx, i, d);

/** Reescribe las posiciones de los ítems activos según `ids` (ya validados). */
export async function fijarPosiciones(tx: Transaccion, ctx: ContextoDeEmpresa, ids: string[]): Promise<void> {
  for (const [posicion, id] of ids.entries()) {
    await tx.update(i).set({ posicion, actualizadoEn: new Date() }).where(and(eq(i.tenantId, ctx.empresaId), eq(i.id, id), ne(i.posicion, posicion)));
  }
}

// --- Sembrar ---
/** ¿La empresa ya tiene alguna fila (activa o archivada) en el taller? */
export async function tallerTieneFilas(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<boolean> {
  for (const tabla of [f, m, t, i]) {
    const [r] = await tx.select({ n: count() }).from(tabla).where(eq(tabla.tenantId, ctx.empresaId));
    if ((r?.n ?? 0) > 0) return true;
  }
  return false;
}

export async function insertarSemilla(tx: Transaccion, ctx: ContextoDeEmpresa, s: SemillaDelTaller): Promise<void> {
  const base = { tenantId: ctx.empresaId, creadoPor: ctx.usuarioId };
  const ahora = new Date();
  if (s.formatos.length) await tx.insert(f).values(s.formatos.map((x) => ({ ...base, ...x }))).onConflictDoNothing();
  if (s.maquinas.length) await tx.insert(m).values(s.maquinas.map((x) => ({ ...base, ...x }))).onConflictDoNothing();
  if (s.tarifas.length) await tx.insert(t).values(s.tarifas.map(({ archivada, ...x }) => ({ ...base, ...x, archivadoEn: archivada ? ahora : null }))).onConflictDoNothing();
  if (s.items.length) await tx.insert(i).values(s.items.map((x) => ({ ...base, ...x }))).onConflictDoNothing();
}
