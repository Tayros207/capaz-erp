import { and, asc, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { sucursales } from '../../../db/esquema/core-maestros.js';
import { personalColaboradores } from '../../../db/esquema/personal.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorPorNombre, type CursorPorNombre } from '../domain/cursor.js';
import type { DatosDeColaborador } from '../domain/colaborador.js';

// Repositorio de colaboradores. Catálogo de la empresa (sin alcance «propios»): la RLS de la transacción aísla por
// empresa y el `where` por empresa es defensa en profundidad. Un colaborador no se borra: se archiva.

export type Colaborador = typeof personalColaboradores.$inferSelect;
export type FiltrosDeColaboradores = { limite: number; cursor: CursorPorNombre | null; buscar?: string; estado: 'activos' | 'archivados' | 'todos'; sucursalId?: string };

const c = personalColaboradores;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(c.tenantId, ctx.empresaId);

const aFila = (d: DatosDeColaborador) => ({
  nombre: d.nombre,
  nombreNormalizado: d.nombreNormalizado,
  documentoTipo: d.documentoTipo,
  documentoNumero: d.documentoNumero,
  telefono: d.telefono,
  cargo: d.cargo,
  usuarioId: d.cuentaId,
  fechaIngreso: d.fechaIngreso,
  sucursalId: d.sucursalId,
});

/** Crea el colaborador. `null` si ya hay uno activo con el mismo nombre (único parcial de la base). */
export async function crearColaborador(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeColaborador): Promise<Colaborador | null> {
  const [fila] = await tx
    .insert(c)
    .values({ ...aFila(datos), tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning();
  return fila ?? null;
}

/** El colaborador activo con ese nombre normalizado, si lo hay (explica el choque de unicidad). */
export async function colaboradorActivoPorNombre(tx: Transaccion, ctx: ContextoDeEmpresa, nombreNormalizado: string, exceptoId?: string): Promise<Colaborador | null> {
  const [fila] = await tx
    .select()
    .from(c)
    .where(and(deEmpresa(ctx), eq(c.nombreNormalizado, nombreNormalizado), isNull(c.archivadoEn), exceptoId ? sql`${c.id} <> ${exceptoId}` : undefined));
  return fila ?? null;
}

/** `bloquear` toma la fila con `for update`: dos cambios a la vez se turnan. */
export async function verColaborador(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { bloquear?: boolean } = {}): Promise<Colaborador | null> {
  const consulta = tx.select().from(c).where(and(deEmpresa(ctx), eq(c.id, id)));
  const [fila] = opciones.bloquear ? await consulta.for('update') : await consulta;
  return fila ?? null;
}

/** Orden `(nombre normalizado, id)` ascendente. `limite` ya viene validado (1 a 100). */
export async function listarColaboradores(tx: Transaccion, ctx: ContextoDeEmpresa, f: FiltrosDeColaboradores): Promise<{ items: Colaborador[]; siguiente: string | null }> {
  const buscar = f.buscar?.trim();
  const donde: (SQL | undefined)[] = [
    deEmpresa(ctx),
    f.estado === 'activos' ? isNull(c.archivadoEn) : f.estado === 'archivados' ? isNotNull(c.archivadoEn) : undefined,
    f.sucursalId ? eq(c.sucursalId, f.sucursalId) : undefined,
    buscar ? sql`position(${buscar.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()} in ${c.nombreNormalizado}) > 0` : undefined,
    f.cursor ? sql`(${c.nombreNormalizado}, ${c.id}) > (${f.cursor.nombre}, ${f.cursor.id}::uuid)` : undefined,
  ];
  const filas = await tx
    .select()
    .from(c)
    .where(and(...donde))
    .orderBy(asc(c.nombreNormalizado), asc(c.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return { items: pagina, siguiente: filas.length > f.limite && ultima ? codificarCursorPorNombre({ nombre: ultima.nombreNormalizado, id: ultima.id }) : null };
}

/** Aplica los datos ya validados a un colaborador ya comprobado (y bloqueado) por la herramienta. */
export async function actualizarColaborador(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, datos: DatosDeColaborador): Promise<void> {
  const r = await tx
    .update(c)
    .set({ ...aFila(datos), actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(c.id, id)))
    .returning({ id: c.id });
  if (r.length !== 1) throw new Error('El colaborador a actualizar no existe en esta empresa.');
}

export async function cambiarArchivado(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, archivado: boolean): Promise<void> {
  const r = await tx
    .update(c)
    .set({ archivadoEn: archivado ? sql`now()` : null, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(c.id, id)))
    .returning({ id: c.id });
  if (r.length !== 1) throw new Error('El colaborador a archivar no existe en esta empresa.');
}

export async function sucursalVigente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [fila] = await tx
    .select({ id: sucursales.id })
    .from(sucursales)
    .where(and(eq(sucursales.tenantId, ctx.empresaId), eq(sucursales.id, id), isNull(sucursales.archivadoEn)));
  return fila !== undefined;
}

/** ¿Es miembro de la empresa? Por la vista `core.v_miembros`, como `miembros_listar`. */
export async function esMiembro(tx: Transaccion, usuarioId: string): Promise<boolean> {
  const r = await tx.execute(sql`select 1 from core.v_miembros where usuario_id = ${usuarioId} limit 1`);
  return r.rows.length > 0;
}
