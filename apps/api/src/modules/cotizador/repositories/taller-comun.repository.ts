import { and, asc, eq, isNotNull, isNull, like, ne, sql, type SQL } from 'drizzle-orm';
import { cotizadorFormatosPliego, cotizadorItemsDelCuadro, cotizadorMaquinas, cotizadorTarifas } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorDeLista, type CursorDeLista } from '../domain/cursor.js';

// Lo común de los repositorios del taller: las cuatro tablas comparten id, empresa, nombre normalizado y archivado.
// Recibe la transacción de `conEmpresa`: la RLS aísla y el `where` por empresa es defensa en profundidad.

export type TablaDelTaller = typeof cotizadorFormatosPliego | typeof cotizadorMaquinas | typeof cotizadorTarifas | typeof cotizadorItemsDelCuadro;
type Fila<T extends TablaDelTaller> = T['$inferSelect'];
export type EstadoDeListado = 'activas' | 'archivadas' | 'todas';
export type FiltrosPorNombre = { buscar?: string; estado: EstadoDeListado; cursor: CursorDeLista | null; limite: number; extra?: SQL | undefined };

/** Los comodines de `like` que escribió la persona no valen. */
const sinComodines = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);
/** Las tablas se usan por sus columnas comunes; el tipo de unión no deja a Drizzle verlas como una sola. */
const comun = (t: TablaDelTaller) => t as typeof cotizadorTarifas;

export function filtroDeEstado(t: TablaDelTaller, estado: EstadoDeListado): SQL | undefined {
  return estado === 'activas' ? isNull(comun(t).archivadoEn) : estado === 'archivadas' ? isNotNull(comun(t).archivadoEn) : undefined;
}

export async function listarPorNombre<T extends TablaDelTaller>(tx: Transaccion, ctx: ContextoDeEmpresa, tabla: T, f: FiltrosPorNombre): Promise<{ items: Array<Fila<T>>; siguiente: string | null }> {
  const t = comun(tabla);
  const donde: (SQL | undefined)[] = [
    eq(t.tenantId, ctx.empresaId),
    filtroDeEstado(tabla, f.estado),
    f.buscar ? like(t.nombreNormalizado, `%${sinComodines(f.buscar)}%`) : undefined,
    f.cursor ? sql`(${t.nombreNormalizado}, ${t.id}) > (${f.cursor.nombreNormalizado}, ${f.cursor.id}::uuid)` : undefined,
    f.extra,
  ];
  const filas = await tx.select().from(t).where(and(...donde)).orderBy(asc(t.nombreNormalizado), asc(t.id)).limit(f.limite + 1);
  const items = filas.slice(0, f.limite);
  const ultima = items.at(-1);
  const siguiente = filas.length > f.limite && ultima ? codificarCursorDeLista({ nombreNormalizado: ultima.nombreNormalizado, id: ultima.id }) : null;
  return { items: items as Array<Fila<T>>, siguiente };
}

export async function verPorId<T extends TablaDelTaller>(tx: Transaccion, ctx: ContextoDeEmpresa, tabla: T, id: string): Promise<Fila<T> | null> {
  const t = comun(tabla);
  const [fila] = await tx.select().from(t).where(and(eq(t.tenantId, ctx.empresaId), eq(t.id, id)));
  return (fila ?? null) as Fila<T> | null;
}

/** La fila se bloquea (`for update`) para que la confirmación y el cambio vean el mismo estado. */
export async function bloquearPorId<T extends TablaDelTaller>(tx: Transaccion, ctx: ContextoDeEmpresa, tabla: T, id: string): Promise<Fila<T> | null> {
  const t = comun(tabla);
  const [fila] = await tx.select().from(t).where(and(eq(t.tenantId, ctx.empresaId), eq(t.id, id))).for('update');
  return (fila ?? null) as Fila<T> | null;
}

/** La fila activa que ya usa ese nombre normalizado, salvo `salvo`. */
export async function activaConNombre<T extends TablaDelTaller>(tx: Transaccion, ctx: ContextoDeEmpresa, tabla: T, nombreNormalizado: string, salvo?: string): Promise<Fila<T> | null> {
  const t = comun(tabla);
  const filtros: SQL[] = [eq(t.tenantId, ctx.empresaId), eq(t.nombreNormalizado, nombreNormalizado), isNull(t.archivadoEn)];
  if (salvo) filtros.push(ne(t.id, salvo));
  const [fila] = await tx.select().from(t).where(and(...filtros));
  return (fila ?? null) as Fila<T> | null;
}

export async function editarPorId<T extends TablaDelTaller>(tx: Transaccion, ctx: ContextoDeEmpresa, tabla: T, id: string, cambios: Record<string, unknown>): Promise<Fila<T>> {
  const t = comun(tabla);
  const [fila] = await tx.update(t).set({ ...cambios, actualizadoEn: new Date() }).where(and(eq(t.tenantId, ctx.empresaId), eq(t.id, id))).returning();
  if (!fila) throw new Error('La fila editada del taller no existe.');
  return fila as Fila<T>;
}

/** Archiva (idempotente): una fila ya archivada se devuelve tal cual. */
export async function archivarPorId<T extends TablaDelTaller>(tx: Transaccion, ctx: ContextoDeEmpresa, tabla: T, id: string): Promise<Fila<T> | null> {
  const t = comun(tabla);
  const [fila] = await tx
    .update(t)
    .set({ archivadoEn: new Date(), actualizadoEn: new Date() })
    .where(and(eq(t.tenantId, ctx.empresaId), eq(t.id, id), isNull(t.archivadoEn)))
    .returning();
  return ((fila as Fila<T> | undefined) ?? (await verPorId(tx, ctx, tabla, id))) as Fila<T> | null;
}

/** Inserta una fila; un choque de nombre activo se devuelve (la fila que ya existe), no se lanza. */
export async function insertarUnica<T extends TablaDelTaller>(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  tabla: T,
  valores: Record<string, unknown> & { nombreNormalizado: string },
): Promise<{ creada: true; fila: Fila<T> } | { creada: false; existente: Fila<T> }> {
  const [fila] = await tx
    .insert(comun(tabla))
    .values({ ...valores, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId } as typeof cotizadorTarifas.$inferInsert)
    .onConflictDoNothing()
    .returning();
  if (fila) return { creada: true, fila: fila as Fila<T> };
  const existente = await activaConNombre(tx, ctx, tabla, valores.nombreNormalizado);
  if (!existente) throw new Error('Conflicto de unicidad del taller sin fila que lo explique.');
  return { creada: false, existente };
}

/** Restaura (idempotente): una fila ya activa se devuelve tal cual. */
export async function restaurarPorId<T extends TablaDelTaller>(tx: Transaccion, ctx: ContextoDeEmpresa, tabla: T, id: string): Promise<Fila<T> | null> {
  const t = comun(tabla);
  const [fila] = await tx
    .update(t)
    .set({ archivadoEn: null, actualizadoEn: new Date() })
    .where(and(eq(t.tenantId, ctx.empresaId), eq(t.id, id), isNotNull(t.archivadoEn)))
    .returning();
  return ((fila as Fila<T> | undefined) ?? (await verPorId(tx, ctx, tabla, id))) as Fila<T> | null;
}
