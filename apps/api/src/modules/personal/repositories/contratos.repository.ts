import { and, asc, desc, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { EstadoDeVacaciones } from '@capaz/shared';
import { personalColaboradores } from '../../../db/esquema/personal.js';
import { personalContratos, personalVacaciones } from '../../../db/esquema/personal-contratos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Cursor opaco por instante: `(creado_en como texto, id)` en base64url (el texto de PostgreSQL conserva los microsegundos).
const codificarCursorPorInstante = (c: { instante: string; id: string }): string => Buffer.from(`${c.instante}|${c.id}`).toString('base64url');
function decodificarCursorPorInstante(cursor: string): { instante: string; id: string } | null {
  const m = /^(.+)\|([0-9a-f-]{36})$/.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}

// Contratos de trabajo y vacaciones. Recibe la transacción de `conEmpresa` (RLS aísla; el `where` por empresa es defensa en profundidad).

export type Contrato = typeof personalContratos.$inferSelect & { colaboradorNombre: string };
export type Vacaciones = typeof personalVacaciones.$inferSelect & { colaboradorNombre: string };

const cDe = (ctx: ContextoDeEmpresa) => eq(personalContratos.tenantId, ctx.empresaId);
const vDe = (ctx: ContextoDeEmpresa) => eq(personalVacaciones.tenantId, ctx.empresaId);

// ───────── Contratos ─────────

const consultaDeContratos = (tx: Transaccion) =>
  tx
    .select({ c: personalContratos, colaboradorNombre: personalColaboradores.nombre, instante: sql<string>`${personalContratos.creadoEn}::text` })
    .from(personalContratos)
    .innerJoin(personalColaboradores, and(eq(personalColaboradores.tenantId, personalContratos.tenantId), eq(personalColaboradores.id, personalContratos.colaboradorId)));

export async function crearContrato(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  d: { colaboradorId: string; tipo: string; inicio: string; fin: string | null; remuneracionMensualCentimos: number; jornadaHorasSemana: number },
): Promise<string | null> {
  const [f] = await tx.insert(personalContratos).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).onConflictDoNothing().returning({ id: personalContratos.id });
  return f?.id ?? null;
}

export async function verContrato(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { bloquear?: boolean } = {}): Promise<Contrato | null> {
  if (opciones.bloquear) await tx.select({ id: personalContratos.id }).from(personalContratos).where(and(cDe(ctx), eq(personalContratos.id, id))).for('update');
  const [f] = await consultaDeContratos(tx).where(and(cDe(ctx), eq(personalContratos.id, id)));
  return f ? { ...f.c, colaboradorNombre: f.colaboradorNombre } : null;
}

export async function terminarContrato(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, fecha: string, motivo: string): Promise<void> {
  await tx
    .update(personalContratos)
    .set({ estado: 'terminado', terminadoEn: fecha, motivoTermino: motivo, actualizadoEn: sql`now()` })
    .where(and(cDe(ctx), eq(personalContratos.id, id)));
}

export async function listarContratos(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  o: { limite: number; cursor?: string; estado: 'vigentes' | 'terminados' | 'todos'; colaboradorId?: string },
): Promise<{ items: Contrato[]; siguiente: string | null } | 'cursor_invalido'> {
  const filtros: SQL[] = [cDe(ctx)];
  if (o.estado !== 'todos') filtros.push(eq(personalContratos.estado, o.estado === 'vigentes' ? 'vigente' : 'terminado'));
  if (o.colaboradorId) filtros.push(eq(personalContratos.colaboradorId, o.colaboradorId));
  if (o.cursor) {
    const pos = decodificarCursorPorInstante(o.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(lt(sql`${personalContratos.creadoEn}::text`, pos.instante), and(eq(sql`${personalContratos.creadoEn}::text`, pos.instante), lt(personalContratos.id, pos.id)))!);
  }
  const filas = await consultaDeContratos(tx).where(and(...filtros)).orderBy(desc(personalContratos.creadoEn), desc(personalContratos.id)).limit(o.limite + 1);
  const hayMas = filas.length > o.limite;
  const pagina = hayMas ? filas.slice(0, o.limite) : filas;
  const ultimo = pagina.at(-1);
  return { items: pagina.map((f) => ({ ...f.c, colaboradorNombre: f.colaboradorNombre })), siguiente: hayMas && ultimo ? codificarCursorPorInstante({ instante: ultimo.instante, id: ultimo.c.id }) : null };
}

// ───────── Vacaciones ─────────

const consultaDeVacaciones = (tx: Transaccion) =>
  tx
    .select({ v: personalVacaciones, colaboradorNombre: personalColaboradores.nombre, instante: sql<string>`${personalVacaciones.creadoEn}::text` })
    .from(personalVacaciones)
    .innerJoin(personalColaboradores, and(eq(personalColaboradores.tenantId, personalVacaciones.tenantId), eq(personalColaboradores.id, personalVacaciones.colaboradorId)));

export async function crearVacaciones(tx: Transaccion, ctx: ContextoDeEmpresa, d: { colaboradorId: string; desde: string; hasta: string; dias: number; motivo: string | null }): Promise<string> {
  const [f] = await tx.insert(personalVacaciones).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning({ id: personalVacaciones.id });
  return f!.id;
}

export async function verVacaciones(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { bloquear?: boolean } = {}): Promise<Vacaciones | null> {
  if (opciones.bloquear) await tx.select({ id: personalVacaciones.id }).from(personalVacaciones).where(and(vDe(ctx), eq(personalVacaciones.id, id))).for('update');
  const [f] = await consultaDeVacaciones(tx).where(and(vDe(ctx), eq(personalVacaciones.id, id)));
  return f ? { ...f.v, colaboradorNombre: f.colaboradorNombre } : null;
}

export async function cambiarEstadoDeVacaciones(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, c: { estado: EstadoDeVacaciones; resuelta?: boolean; resueltoPor?: string; motivoResolucion?: string | null }): Promise<void> {
  const { resuelta, ...resto } = c;
  await tx
    .update(personalVacaciones)
    .set({ ...resto, ...(resuelta && { resueltoEn: sql`now()` }), actualizadoEn: sql`now()` })
    .where(and(vDe(ctx), eq(personalVacaciones.id, id)));
}

/** Los rangos de un colaborador que ocupan fechas: solicitadas y aprobadas. */
export async function rangosOcupados(tx: Transaccion, ctx: ContextoDeEmpresa, colaboradorId: string, exceptoId?: string): Promise<Array<{ desde: string; hasta: string }>> {
  const filas = await tx
    .select({ desde: personalVacaciones.desde, hasta: personalVacaciones.hasta, id: personalVacaciones.id })
    .from(personalVacaciones)
    .where(and(vDe(ctx), eq(personalVacaciones.colaboradorId, colaboradorId), inArray(personalVacaciones.estado, ['solicitada', 'aprobada'])));
  return filas.filter((f) => f.id !== exceptoId).map(({ desde, hasta }) => ({ desde, hasta }));
}

/** Días aprobados y días aún por aprobar de un colaborador. */
export async function diasDeVacaciones(tx: Transaccion, ctx: ContextoDeEmpresa, colaboradorId: string): Promise<{ aprobadas: number; solicitadas: number }> {
  const filas = await tx
    .select({ estado: personalVacaciones.estado, dias: sql<string>`coalesce(sum(${personalVacaciones.dias}), 0)::bigint` })
    .from(personalVacaciones)
    .where(and(vDe(ctx), eq(personalVacaciones.colaboradorId, colaboradorId), inArray(personalVacaciones.estado, ['solicitada', 'aprobada'])))
    .groupBy(personalVacaciones.estado);
  const por = new Map(filas.map((f) => [f.estado, Number(f.dias)]));
  return { aprobadas: por.get('aprobada') ?? 0, solicitadas: por.get('solicitada') ?? 0 };
}

export async function listarVacaciones(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  o: { limite: number; cursor?: string; estado: EstadoDeVacaciones | 'abiertas' | 'todas'; colaboradorId?: string },
): Promise<{ items: Vacaciones[]; siguiente: string | null } | 'cursor_invalido'> {
  const filtros: SQL[] = [vDe(ctx)];
  if (o.estado === 'abiertas') filtros.push(eq(personalVacaciones.estado, 'solicitada'));
  else if (o.estado !== 'todas') filtros.push(eq(personalVacaciones.estado, o.estado));
  if (o.colaboradorId) filtros.push(eq(personalVacaciones.colaboradorId, o.colaboradorId));
  if (o.cursor) {
    const pos = decodificarCursorPorInstante(o.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(lt(sql`${personalVacaciones.creadoEn}::text`, pos.instante), and(eq(sql`${personalVacaciones.creadoEn}::text`, pos.instante), lt(personalVacaciones.id, pos.id)))!);
  }
  const filas = await consultaDeVacaciones(tx).where(and(...filtros)).orderBy(desc(personalVacaciones.creadoEn), desc(personalVacaciones.id)).limit(o.limite + 1);
  const hayMas = filas.length > o.limite;
  const pagina = hayMas ? filas.slice(0, o.limite) : filas;
  const ultimo = pagina.at(-1);
  return { items: pagina.map((f) => ({ ...f.v, colaboradorNombre: f.colaboradorNombre })), siguiente: hayMas && ultimo ? codificarCursorPorInstante({ instante: ultimo.instante, id: ultimo.v.id }) : null };
}
