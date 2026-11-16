import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { personalAsistencias, personalColaboradores } from '../../../db/esquema/personal.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { AsistenciaDeDia } from '../domain/asistencia.js';
import { codificarCursorPorFecha, type CursorPorFecha } from '../domain/cursor.js';

// Repositorio de asistencias: una fila por colaborador y día (único en la base).

export type Asistencia = typeof personalAsistencias.$inferSelect & { colaboradorNombre: string };
export type FiltrosDeAsistencias = { limite: number; cursor: CursorPorFecha | null; desde: string; hasta?: string; colaboradorId?: string };

const a = personalAsistencias;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(a.tenantId, ctx.empresaId);
const conColaborador = and(eq(personalColaboradores.tenantId, a.tenantId), eq(personalColaboradores.id, a.colaboradorId));

const consulta = (tx: Transaccion) =>
  tx
    .select({ fila: a, colaboradorNombre: personalColaboradores.nombre })
    .from(a)
    .innerJoin(personalColaboradores, conColaborador);
const aplanar = (f: { fila: typeof a.$inferSelect; colaboradorNombre: string }): Asistencia => ({ ...f.fila, colaboradorNombre: f.colaboradorNombre });

/** Lo que ya hay del día, para decidir la marca. `bloquear` toma la fila (sin unión) antes de leerla. */
export async function asistenciaDelDia(tx: Transaccion, ctx: ContextoDeEmpresa, colaboradorId: string, fecha: string, opciones: { bloquear?: boolean } = {}) {
  const donde = and(deEmpresa(ctx), eq(a.colaboradorId, colaboradorId), eq(a.fecha, fecha));
  const [fila] = opciones.bloquear ? await tx.select().from(a).where(donde).for('update') : await tx.select().from(a).where(donde);
  return fila ?? null;
}

/** Crea o reemplaza la asistencia del día (la herramienta ya calculó el resultado). Devuelve su id. */
export async function guardarAsistencia(tx: Transaccion, ctx: ContextoDeEmpresa, colaboradorId: string, fecha: string, d: AsistenciaDeDia): Promise<string> {
  const [fila] = await tx
    .insert(a)
    .values({ tenantId: ctx.empresaId, colaboradorId, fecha, estado: d.estado, entrada: d.entrada, salida: d.salida, nota: d.nota, creadoPor: ctx.usuarioId })
    .onConflictDoUpdate({
      target: [a.tenantId, a.colaboradorId, a.fecha],
      set: { estado: d.estado, entrada: d.entrada, salida: d.salida, nota: d.nota, actualizadoEn: sql`now()` },
    })
    .returning({ id: a.id });
  if (!fila) throw new Error('No se pudo guardar la asistencia.');
  return fila.id;
}

export async function verAsistencia(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Asistencia | null> {
  const [fila] = await consulta(tx).where(and(deEmpresa(ctx), eq(a.id, id)));
  return fila ? aplanar(fila) : null;
}

/** Orden `(fecha, id)` descendente. Sin `hasta`, solo el día `desde`. `limite` ya viene validado (1 a 100). */
export async function listarAsistencias(tx: Transaccion, ctx: ContextoDeEmpresa, f: FiltrosDeAsistencias): Promise<{ items: Asistencia[]; siguiente: string | null }> {
  const donde: (SQL | undefined)[] = [
    deEmpresa(ctx),
    gte(a.fecha, f.desde),
    lte(a.fecha, f.hasta ?? f.desde),
    f.colaboradorId ? eq(a.colaboradorId, f.colaboradorId) : undefined,
    f.cursor ? sql`(${a.fecha}, ${a.id}) < (${f.cursor.fecha}::date, ${f.cursor.id}::uuid)` : undefined,
  ];
  const filas = await consulta(tx)
    .where(and(...donde))
    .orderBy(desc(a.fecha), desc(a.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite).map(aplanar);
  const ultima = pagina.at(-1);
  return { items: pagina, siguiente: filas.length > f.limite && ultima ? codificarCursorPorFecha({ fecha: ultima.fecha, id: ultima.id }) : null };
}

/** Las últimas asistencias de un colaborador (para su ficha). */
export async function ultimasAsistencias(tx: Transaccion, ctx: ContextoDeEmpresa, colaboradorId: string, cuantas: number): Promise<Asistencia[]> {
  const filas = await consulta(tx)
    .where(and(deEmpresa(ctx), eq(a.colaboradorId, colaboradorId)))
    .orderBy(desc(a.fecha), desc(a.id))
    .limit(cuantas);
  return filas.map(aplanar);
}
