import { and, desc, eq, isNotNull, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { crmActividades, crmOportunidades } from '../../../db/esquema/crm.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursor, type PosicionPorInstante } from '../domain/cursor.js';
import { soloPropias } from './oportunidades.repository.js';

// Actividades de seguimiento. Con alcance «propios» (R4) se ven las que la persona creó o tiene como
// responsable, y también las de las oportunidades que son suyas.

export type Actividad = typeof crmActividades.$inferSelect;
export type ActividadCompleta = { a: Actividad; oportunidadNumero: number; oportunidadAnio: number; oportunidadTitulo: string; instante: string };
export type FiltrosDeActividades = {
  limite: number;
  estado: 'pendientes' | 'vencidas' | 'hechas' | 'todas';
  oportunidadId?: string;
  responsableId?: string;
};

const a = crmActividades;
const o = crmOportunidades;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(a.tenantId, ctx.empresaId);
const visibles = (usuarioId: string): SQL => or(eq(a.creadoPor, usuarioId), eq(a.responsableId, usuarioId), soloPropias(usuarioId))!;

/** Lo mismo que `visibles`, sin la oportunidad en el `from` (para bloquear solo la actividad). */
const visiblesSinJoin = (usuarioId: string): SQL =>
  or(
    eq(a.creadoPor, usuarioId),
    eq(a.responsableId, usuarioId),
    sql`exists (select 1 from crm.oportunidades o where o.tenant_id = ${a.tenantId} and o.id = ${a.oportunidadId} and (o.creado_por = ${usuarioId} or o.responsable_id = ${usuarioId}))`,
  )!;

function consulta(tx: Transaccion, donde: SQL | undefined) {
  return tx
    .select({ a: crmActividades, oportunidadNumero: o.numero, oportunidadAnio: o.anio, oportunidadTitulo: o.titulo, instante: sql<string>`${a.creadoEn}::text` })
    .from(a)
    .innerJoin(o, and(eq(o.tenantId, a.tenantId), eq(o.id, a.oportunidadId)))
    .where(donde);
}

/** Todas las actividades a su alcance de una oportunidad, las más recientes primero. */
export async function actividadesDe(tx: Transaccion, ctx: ContextoDeEmpresa, oportunidadId: string, propios: boolean): Promise<ActividadCompleta[]> {
  return consulta(tx, and(deEmpresa(ctx), eq(a.oportunidadId, oportunidadId), propios ? visibles(ctx.usuarioId) : undefined)).orderBy(desc(a.creadoEn), desc(a.id));
}

export async function verActividad(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propios: boolean): Promise<ActividadCompleta | null> {
  const [fila] = await consulta(tx, and(deEmpresa(ctx), eq(a.id, id), propios ? visibles(ctx.usuarioId) : undefined));
  return fila ?? null;
}

/** Toma la actividad con `for update`. `null` si no existe o no está a su alcance. */
export async function bloquearActividad(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propios: boolean): Promise<Actividad | null> {
  const [fila] = await tx
    .select()
    .from(a)
    .where(and(deEmpresa(ctx), eq(a.id, id), propios ? visiblesSinJoin(ctx.usuarioId) : undefined))
    .for('update');
  return fila ?? null;
}

export type DatosDeActividad = Pick<Actividad, 'oportunidadId' | 'tipo' | 'asunto'> & Partial<Pick<Actividad, 'nota' | 'venceEl' | 'responsableId'>>;

export async function insertarActividad(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeActividad): Promise<Actividad> {
  const [fila] = await tx.insert(a).values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning();
  return fila!;
}

/** Marca hecha (y reemplaza la nota si llega). */
export async function marcarHecha(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, nota: string | null | undefined): Promise<void> {
  await tx
    .update(a)
    .set({ hechaEn: sql`now()`, hechaPor: ctx.usuarioId, ...(nota !== undefined && { nota }) })
    .where(and(deEmpresa(ctx), eq(a.id, id)));
}

export async function listarActividades(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  f: FiltrosDeActividades,
  hoy: string,
  cursor: PosicionPorInstante | null,
  propios: boolean,
): Promise<{ items: ActividadCompleta[]; siguiente: string | null }> {
  const porEstado = {
    pendientes: isNull(a.hechaEn),
    vencidas: and(isNull(a.hechaEn), lt(a.venceEl, hoy)),
    hechas: isNotNull(a.hechaEn),
    todas: undefined,
  }[f.estado];
  const filas = await consulta(
    tx,
    and(
      deEmpresa(ctx),
      porEstado,
      f.oportunidadId ? eq(a.oportunidadId, f.oportunidadId) : undefined,
      f.responsableId ? eq(a.responsableId, f.responsableId) : undefined,
      cursor ? sql`(${a.creadoEn}, ${a.id}) < (${cursor.instante}::timestamptz, ${cursor.id}::uuid)` : undefined,
      propios ? visibles(ctx.usuarioId) : undefined,
    ),
  )
    .orderBy(desc(a.creadoEn), desc(a.id))
    .limit(f.limite + 1);
  const items = filas.slice(0, f.limite);
  const ultima = items.at(-1);
  return { items, siguiente: filas.length > f.limite && ultima ? codificarCursor({ instante: ultima.instante, id: ultima.a.id }) : null };
}
