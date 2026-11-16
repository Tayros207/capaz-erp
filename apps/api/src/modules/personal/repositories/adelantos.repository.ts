import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { personalAdelantos, personalColaboradores } from '../../../db/esquema/personal.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorPorFecha, type CursorPorFecha } from '../domain/cursor.js';

// Repositorio de adelantos de dinero. Un adelanto nunca se edita ni se borra: se anula (la base solo deja cambiar las
// columnas de anulación). `propietario`: con alcance «propios», el usuario dueño de las filas (R4).

export type Adelanto = typeof personalAdelantos.$inferSelect & { colaboradorNombre: string };
export type DatosDeAdelanto = { numero: number; anio: number; colaboradorId: string; montoCentimos: number; fecha: string; motivo: string | null };
export type FiltrosDeAdelantos = { limite: number; cursor: CursorPorFecha | null; estado: 'vigentes' | 'anulados' | 'todos'; colaboradorId?: string; desde?: string; hasta?: string };

const d = personalAdelantos;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(d.tenantId, ctx.empresaId);
const delPropietario = (propietario: string | null): SQL | undefined => (propietario === null ? undefined : eq(d.creadoPor, propietario));
const conColaborador = and(eq(personalColaboradores.tenantId, d.tenantId), eq(personalColaboradores.id, d.colaboradorId));

const consulta = (tx: Transaccion) =>
  tx
    .select({ fila: d, colaboradorNombre: personalColaboradores.nombre })
    .from(d)
    .innerJoin(personalColaboradores, conColaborador);
const aplanar = (f: { fila: typeof d.$inferSelect; colaboradorNombre: string }): Adelanto => ({ ...f.fila, colaboradorNombre: f.colaboradorNombre });

export async function insertarAdelanto(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeAdelanto): Promise<string> {
  const [fila] = await tx
    .insert(d)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .returning({ id: d.id });
  if (!fila) throw new Error('No se pudo guardar el adelanto.');
  return fila.id;
}

export async function verAdelanto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propietario: string | null): Promise<Adelanto | null> {
  const [fila] = await consulta(tx).where(and(deEmpresa(ctx), eq(d.id, id), delPropietario(propietario)));
  return fila ? aplanar(fila) : null;
}

/** Toma la fila con `for update` para que dos anulaciones a la vez se turnen. `null` si no existe o no es suya. */
export async function bloquearAdelanto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propietario: string | null): Promise<typeof d.$inferSelect | null> {
  const [fila] = await tx
    .select()
    .from(d)
    .where(and(deEmpresa(ctx), eq(d.id, id), delPropietario(propietario)))
    .for('update');
  return fila ?? null;
}

/** Marca como anulado un adelanto registrado. `false` si ya no estaba registrado. */
export async function anularAdelanto(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, motivo: string): Promise<boolean> {
  const filas = await tx
    .update(d)
    .set({ estado: 'anulado', anuladoEn: sql`now()`, anuladoPor: ctx.usuarioId, motivoAnulacion: motivo })
    .where(and(deEmpresa(ctx), eq(d.id, id), eq(d.estado, 'registrado')))
    .returning({ id: d.id });
  return filas.length === 1;
}

/** Orden `(fecha, id)` descendente. `limite` ya viene validado (1 a 100). */
export async function listarAdelantos(tx: Transaccion, ctx: ContextoDeEmpresa, f: FiltrosDeAdelantos, propietario: string | null): Promise<{ items: Adelanto[]; siguiente: string | null }> {
  const donde: (SQL | undefined)[] = [
    deEmpresa(ctx),
    delPropietario(propietario),
    f.estado === 'vigentes' ? eq(d.estado, 'registrado') : f.estado === 'anulados' ? eq(d.estado, 'anulado') : undefined,
    f.colaboradorId ? eq(d.colaboradorId, f.colaboradorId) : undefined,
    f.desde ? gte(d.fecha, f.desde) : undefined,
    f.hasta ? lte(d.fecha, f.hasta) : undefined,
    f.cursor ? sql`(${d.fecha}, ${d.id}) < (${f.cursor.fecha}::date, ${f.cursor.id}::uuid)` : undefined,
  ];
  const filas = await consulta(tx)
    .where(and(...donde))
    .orderBy(desc(d.fecha), desc(d.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite).map(aplanar);
  const ultima = pagina.at(-1);
  return { items: pagina, siguiente: filas.length > f.limite && ultima ? codificarCursorPorFecha({ fecha: ultima.fecha, id: ultima.id }) : null };
}

/** Los últimos adelantos de un colaborador (para su ficha). */
export async function ultimosAdelantos(tx: Transaccion, ctx: ContextoDeEmpresa, colaboradorId: string, cuantos: number, propietario: string | null): Promise<Adelanto[]> {
  const filas = await consulta(tx)
    .where(and(deEmpresa(ctx), eq(d.colaboradorId, colaboradorId), delPropietario(propietario)))
    .orderBy(desc(d.fecha), desc(d.id))
    .limit(cuantos);
  return filas.map(aplanar);
}
