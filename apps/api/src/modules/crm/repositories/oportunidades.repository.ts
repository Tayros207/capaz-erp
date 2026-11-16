import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { clientes, sucursales } from '../../../db/esquema/core-maestros.js';
import { crmEtapas, crmOportunidades } from '../../../db/esquema/crm.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursor, type PosicionPorInstante } from '../domain/cursor.js';

// Oportunidades. `propios` (R4) limita a las que la persona creó o tiene como responsable.

export type Oportunidad = typeof crmOportunidades.$inferSelect;
export type OportunidadCompleta = { o: Oportunidad; clienteNombre: string; etapaNombre: string; pendientes: number; instante: string };
export type FiltrosDeOportunidades = {
  limite: number;
  estado: 'abiertas' | 'ganadas' | 'perdidas' | 'todas';
  etapaId?: string;
  clienteId?: string;
  responsableId?: string;
  /** Ya normalizado (sin tildes, en minúsculas). */
  buscar?: string;
};

const o = crmOportunidades;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(o.tenantId, ctx.empresaId);
const ESTADO_DE_FILTRO = { abiertas: 'abierta', ganadas: 'ganada', perdidas: 'perdida' } as const;
// Mismo criterio que `normalizarNombre` para el título, en SQL (la base no tiene `unaccent`).
const CON_TILDE = 'áàäâãéèëêíìïîóòöôõúùüûñç';
const SIN_TILDE = 'aaaaaeeeeiiiiooooouuuunc';

/** Filtro de alcance «propios»: creada por la persona o con ella como responsable. */
export const soloPropias = (usuarioId: string): SQL => or(eq(o.creadoPor, usuarioId), eq(o.responsableId, usuarioId))!;

const columnas = {
  o: crmOportunidades,
  clienteNombre: clientes.nombre,
  etapaNombre: crmEtapas.nombre,
  pendientes: sql<number>`(select count(*)::int from crm.actividades a where a.tenant_id = ${o.tenantId} and a.oportunidad_id = ${o.id} and a.hecha_en is null)`,
  instante: sql<string>`${o.ultimaActividadEn}::text`,
};

function consulta(tx: Transaccion, donde: SQL | undefined) {
  return tx
    .select(columnas)
    .from(o)
    .innerJoin(clientes, and(eq(clientes.tenantId, o.tenantId), eq(clientes.id, o.clienteId)))
    .innerJoin(crmEtapas, and(eq(crmEtapas.tenantId, o.tenantId), eq(crmEtapas.id, o.etapaId)))
    .where(donde);
}

export async function verOportunidad(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propios: boolean): Promise<OportunidadCompleta | null> {
  const [fila] = await consulta(tx, and(deEmpresa(ctx), eq(o.id, id), propios ? soloPropias(ctx.usuarioId) : undefined));
  return fila ?? null;
}

/** Toma la fila con `for update` (dos cambios a la vez se turnan). `null` si no existe o no está a su alcance. */
export async function bloquearOportunidad(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, propios: boolean): Promise<Oportunidad | null> {
  const [fila] = await tx
    .select()
    .from(o)
    .where(and(deEmpresa(ctx), eq(o.id, id), propios ? soloPropias(ctx.usuarioId) : undefined))
    .for('update');
  return fila ?? null;
}

export async function listarOportunidades(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  f: FiltrosDeOportunidades,
  cursor: PosicionPorInstante | null,
  propios: boolean,
): Promise<{ items: OportunidadCompleta[]; siguiente: string | null }> {
  const filas = await consulta(
    tx,
    and(
      deEmpresa(ctx),
      f.estado !== 'todas' ? eq(o.estado, ESTADO_DE_FILTRO[f.estado]) : undefined,
      f.etapaId ? eq(o.etapaId, f.etapaId) : undefined,
      f.clienteId ? eq(o.clienteId, f.clienteId) : undefined,
      f.responsableId ? eq(o.responsableId, f.responsableId) : undefined,
      f.buscar ? sql`translate(lower(${o.titulo}), ${CON_TILDE}, ${SIN_TILDE}) like ${`%${f.buscar.replace(/[\\%_]/g, '\\$&')}%`}` : undefined,
      cursor ? sql`(${o.ultimaActividadEn}, ${o.id}) < (${cursor.instante}::timestamptz, ${cursor.id}::uuid)` : undefined,
      propios ? soloPropias(ctx.usuarioId) : undefined,
    ),
  )
    .orderBy(desc(o.ultimaActividadEn), desc(o.id))
    .limit(f.limite + 1);
  const items = filas.slice(0, f.limite);
  const ultima = items.at(-1);
  return { items, siguiente: filas.length > f.limite && ultima ? codificarCursor({ instante: ultima.instante, id: ultima.o.id }) : null };
}

export type DatosNuevos = Pick<Oportunidad, 'numero' | 'anio' | 'titulo' | 'clienteId' | 'etapaId'> &
  Partial<Pick<Oportunidad, 'montoEstimadoCentimos' | 'fechaEsperada' | 'responsableId' | 'notas' | 'sucursalId'>>;

export async function insertarOportunidad(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosNuevos): Promise<Oportunidad> {
  const [fila] = await tx
    .insert(o)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .returning();
  return fila!;
}

export type CambiosDeOportunidad = Partial<
  Pick<Oportunidad, 'titulo' | 'clienteId' | 'etapaId' | 'estado' | 'montoEstimadoCentimos' | 'fechaEsperada' | 'responsableId' | 'motivoPerdida' | 'notas' | 'sucursalId'>
> & { cerrada?: boolean };

/** Aplica los cambios y marca la actividad (`ultima_actividad_en = now()`, regla 5). `cerrada` fija o limpia `cerrada_en`. */
export async function actualizarOportunidad(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cambios: CambiosDeOportunidad): Promise<void> {
  const { cerrada, ...resto } = cambios;
  await tx
    .update(o)
    .set({ ...resto, ...(cerrada !== undefined && { cerradaEn: cerrada ? sql`now()` : null }), ultimaActividadEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(o.id, id)));
}

/** Solo la marca de actividad (al crear o completar una actividad). */
export async function tocarOportunidad(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<void> {
  await tx.update(o).set({ ultimaActividadEn: sql`now()` }).where(and(deEmpresa(ctx), eq(o.id, id)));
}

/** Un cliente del núcleo que existe y no está fusionado. */
export async function clienteValido(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string): Promise<boolean> {
  const [f] = await tx
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, clienteId), isNull(clientes.fusionadoEn)));
  return !!f;
}

export async function sucursalValida(tx: Transaccion, ctx: ContextoDeEmpresa, sucursalId: string): Promise<boolean> {
  const [f] = await tx.select({ id: sucursales.id }).from(sucursales).where(and(eq(sucursales.tenantId, ctx.empresaId), eq(sucursales.id, sucursalId)));
  return !!f;
}

/** Regla 7: el responsable debe ser miembro de la empresa de la transacción (vista `core.v_miembros`). */
export async function esMiembro(tx: Transaccion, usuarioId: string): Promise<boolean> {
  const r = await tx.execute<{ n: number }>(sql`select count(*)::int as n from core.v_miembros where usuario_id = ${usuarioId}`);
  return (r.rows[0]?.n ?? 0) > 0;
}
