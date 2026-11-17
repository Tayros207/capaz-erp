import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { productos, sucursales } from '../../../db/esquema/core-maestros.js';
import { insumosArticulos, insumosExistencias, insumosMovimientos } from '../../../db/esquema/insumos.js';
import { insumosConteoLineas, insumosConteos, insumosTransferenciaLineas, insumosTransferencias } from '../../../db/esquema/insumos-operaciones.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorPorInstante, decodificarCursorPorInstante } from '../domain/cursor.js';
import type { MovimientoParaKardex } from '../domain/kardex.js';

// Transferencias, inventario físico (conteos) y lectura de movimientos para el kardex. Recibe la transacción de `conEmpresa`.

export type Transferencia = typeof insumosTransferencias.$inferSelect & { origenCodigo: string; destinoCodigo: string };
export type LineaDeTransferencia = { articuloId: string; nombre: string; unidad: string; cantidadMilesimas: number };
export type Conteo = typeof insumosConteos.$inferSelect & { sucursalCodigo: string; totalLineas: number; lineasContadas: number };
export type LineaDeConteo = typeof insumosConteoLineas.$inferSelect & { nombre: string; unidad: string };

const tTransf = (ctx: ContextoDeEmpresa) => eq(insumosTransferencias.tenantId, ctx.empresaId);
const tConteo = (ctx: ContextoDeEmpresa) => eq(insumosConteos.tenantId, ctx.empresaId);

// ───────── Transferencias ─────────

export async function crearTransferencia(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  d: { numero: number; anio: number; origenSucursalId: string; destinoSucursalId: string; fecha: string | undefined; nota: string | null },
): Promise<string> {
  const [f] = await tx
    .insert(insumosTransferencias)
    .values({ ...d, fecha: d.fecha ?? sql`current_date`, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .returning({ id: insumosTransferencias.id });
  return f!.id;
}

export async function agregarLineasDeTransferencia(tx: Transaccion, ctx: ContextoDeEmpresa, transferenciaId: string, lineas: ReadonlyArray<{ articuloId: string; cantidadMilesimas: number }>): Promise<void> {
  await tx.insert(insumosTransferenciaLineas).values(lineas.map((l) => ({ ...l, tenantId: ctx.empresaId, transferenciaId })));
}

const origen = sucursales;

function consultaDeTransferencias(tx: Transaccion) {
  const destino = sql`(select s.codigo from core.sucursales s where s.tenant_id = ${insumosTransferencias.tenantId} and s.id = ${insumosTransferencias.destinoSucursalId})`;
  return tx
    .select({
      t: insumosTransferencias,
      origenCodigo: origen.codigo,
      destinoCodigo: sql<string>`${destino}`,
      instante: sql<string>`${insumosTransferencias.creadoEn}::text`,
    })
    .from(insumosTransferencias)
    .innerJoin(origen, and(eq(origen.tenantId, insumosTransferencias.tenantId), eq(origen.id, insumosTransferencias.origenSucursalId)));
}

export async function verTransferencia(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Transferencia | null> {
  const [f] = await consultaDeTransferencias(tx).where(and(tTransf(ctx), eq(insumosTransferencias.id, id)));
  return f ? { ...f.t, origenCodigo: f.origenCodigo, destinoCodigo: f.destinoCodigo } : null;
}

export async function lineasDeTransferencias(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Map<string, LineaDeTransferencia[]>> {
  const porId = new Map<string, LineaDeTransferencia[]>();
  if (ids.length === 0) return porId;
  const filas = await tx
    .select({
      transferenciaId: insumosTransferenciaLineas.transferenciaId,
      articuloId: insumosTransferenciaLineas.articuloId,
      nombre: productos.nombre,
      unidad: insumosArticulos.unidad,
      cantidadMilesimas: insumosTransferenciaLineas.cantidadMilesimas,
    })
    .from(insumosTransferenciaLineas)
    .innerJoin(insumosArticulos, and(eq(insumosArticulos.tenantId, insumosTransferenciaLineas.tenantId), eq(insumosArticulos.id, insumosTransferenciaLineas.articuloId)))
    .innerJoin(productos, and(eq(productos.tenantId, insumosArticulos.tenantId), eq(productos.id, insumosArticulos.productoId)))
    .where(and(eq(insumosTransferenciaLineas.tenantId, ctx.empresaId), inArray(insumosTransferenciaLineas.transferenciaId, [...ids])))
    .orderBy(asc(productos.nombre), asc(insumosTransferenciaLineas.id));
  for (const { transferenciaId, ...l } of filas) porId.set(transferenciaId, [...(porId.get(transferenciaId) ?? []), l]);
  return porId;
}

export async function listarTransferencias(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  o: { limite: number; cursor?: string; sucursalId?: string },
): Promise<{ items: Transferencia[]; siguiente: string | null } | 'cursor_invalido'> {
  const filtros = [tTransf(ctx)];
  if (o.sucursalId) filtros.push(or(eq(insumosTransferencias.origenSucursalId, o.sucursalId), eq(insumosTransferencias.destinoSucursalId, o.sucursalId))!);
  if (o.cursor) {
    const pos = decodificarCursorPorInstante(o.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(lt(sql`${insumosTransferencias.creadoEn}::text`, pos.instante), and(eq(sql`${insumosTransferencias.creadoEn}::text`, pos.instante), lt(insumosTransferencias.id, pos.id)))!);
  }
  const filas = await consultaDeTransferencias(tx)
    .where(and(...filtros))
    .orderBy(desc(insumosTransferencias.creadoEn), desc(insumosTransferencias.id))
    .limit(o.limite + 1);
  const hayMas = filas.length > o.limite;
  const items = (hayMas ? filas.slice(0, o.limite) : filas).map((f) => ({ ...f.t, origenCodigo: f.origenCodigo, destinoCodigo: f.destinoCodigo, instante: f.instante }));
  const ultimo = items.at(-1);
  return { items, siguiente: hayMas && ultimo ? codificarCursorPorInstante({ instante: ultimo.instante, id: ultimo.id }) : null };
}

// ───────── Conteos ─────────

const COLUMNAS_DE_CONTEO = {
  c: insumosConteos,
  sucursalCodigo: sucursales.codigo,
  totalLineas: sql<number>`(select count(*)::int from insumos.conteo_lineas l where l.tenant_id = ${insumosConteos.tenantId} and l.conteo_id = ${insumosConteos.id})`,
  lineasContadas: sql<number>`(select count(*)::int from insumos.conteo_lineas l where l.tenant_id = ${insumosConteos.tenantId} and l.conteo_id = ${insumosConteos.id} and l.contada_milesimas is not null)`,
  instante: sql<string>`${insumosConteos.creadoEn}::text`,
};

function consultaDeConteos(tx: Transaccion) {
  return tx
    .select(COLUMNAS_DE_CONTEO)
    .from(insumosConteos)
    .innerJoin(sucursales, and(eq(sucursales.tenantId, insumosConteos.tenantId), eq(sucursales.id, insumosConteos.sucursalId)));
}

type FilaDeConteo = Awaited<ReturnType<ReturnType<typeof consultaDeConteos>['limit']>>[number];
const aConteo = (f: FilaDeConteo): Conteo => ({ ...f.c, sucursalCodigo: f.sucursalCodigo, totalLineas: f.totalLineas, lineasContadas: f.lineasContadas });

export async function verConteo(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { bloquear?: boolean } = {}): Promise<Conteo | null> {
  if (opciones.bloquear) await tx.select({ id: insumosConteos.id }).from(insumosConteos).where(and(tConteo(ctx), eq(insumosConteos.id, id))).for('update');
  const [f] = await consultaDeConteos(tx).where(and(tConteo(ctx), eq(insumosConteos.id, id)));
  return f ? aConteo(f) : null;
}

/** El conteo abierto de una sucursal, si lo hay (la base admite uno solo). */
export async function conteoAbiertoDe(tx: Transaccion, ctx: ContextoDeEmpresa, sucursalId: string): Promise<Conteo | null> {
  const [f] = await consultaDeConteos(tx).where(and(tConteo(ctx), eq(insumosConteos.sucursalId, sucursalId), eq(insumosConteos.estado, 'abierto')));
  return f ? aConteo(f) : null;
}

export async function crearConteo(tx: Transaccion, ctx: ContextoDeEmpresa, d: { numero: number; anio: number; sucursalId: string; nota: string | null }): Promise<string> {
  const [f] = await tx.insert(insumosConteos).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning({ id: insumosConteos.id });
  return f!.id;
}

/** Los artículos activos con existencia registrada en la sucursal (o solo los indicados) y lo que dice el sistema. */
export async function articulosParaConteo(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  sucursalId: string,
  articuloIds: readonly string[] | undefined,
): Promise<Array<{ articuloId: string; sistemaMilesimas: number }>> {
  const base = and(eq(insumosArticulos.tenantId, ctx.empresaId), isNull(insumosArticulos.archivadoEn), articuloIds ? inArray(insumosArticulos.id, [...articuloIds]) : undefined);
  if (articuloIds) {
    const filas = await tx
      .select({ articuloId: insumosArticulos.id, sistemaMilesimas: sql<number>`coalesce(${insumosExistencias.cantidadMilesimas}, 0)::bigint` })
      .from(insumosArticulos)
      .leftJoin(insumosExistencias, and(eq(insumosExistencias.tenantId, insumosArticulos.tenantId), eq(insumosExistencias.articuloId, insumosArticulos.id), eq(insumosExistencias.sucursalId, sucursalId)))
      .where(base);
    return filas.map((f) => ({ articuloId: f.articuloId, sistemaMilesimas: Number(f.sistemaMilesimas) }));
  }
  return tx
    .select({ articuloId: insumosArticulos.id, sistemaMilesimas: insumosExistencias.cantidadMilesimas })
    .from(insumosArticulos)
    .innerJoin(insumosExistencias, and(eq(insumosExistencias.tenantId, insumosArticulos.tenantId), eq(insumosExistencias.articuloId, insumosArticulos.id), eq(insumosExistencias.sucursalId, sucursalId)))
    .where(base);
}

export async function agregarLineasDeConteo(tx: Transaccion, ctx: ContextoDeEmpresa, conteoId: string, lineas: ReadonlyArray<{ articuloId: string; sistemaMilesimas: number }>): Promise<void> {
  if (lineas.length === 0) return;
  await tx.insert(insumosConteoLineas).values(lineas.map((l) => ({ ...l, tenantId: ctx.empresaId, conteoId })));
}

export async function lineasDeConteo(tx: Transaccion, ctx: ContextoDeEmpresa, conteoId: string): Promise<LineaDeConteo[]> {
  const filas = await tx
    .select({ l: insumosConteoLineas, nombre: productos.nombre, unidad: insumosArticulos.unidad })
    .from(insumosConteoLineas)
    .innerJoin(insumosArticulos, and(eq(insumosArticulos.tenantId, insumosConteoLineas.tenantId), eq(insumosArticulos.id, insumosConteoLineas.articuloId)))
    .innerJoin(productos, and(eq(productos.tenantId, insumosArticulos.tenantId), eq(productos.id, insumosArticulos.productoId)))
    .where(and(eq(insumosConteoLineas.tenantId, ctx.empresaId), eq(insumosConteoLineas.conteoId, conteoId)))
    .orderBy(asc(productos.nombre), asc(insumosConteoLineas.id));
  return filas.map((f) => ({ ...f.l, nombre: f.nombre, unidad: f.unidad }));
}

/** Anota lo contado de un artículo del conteo. `false` si ese artículo no está en el conteo. */
export async function anotarContada(tx: Transaccion, ctx: ContextoDeEmpresa, conteoId: string, articuloId: string, contadaMilesimas: number): Promise<boolean> {
  const r = await tx
    .update(insumosConteoLineas)
    .set({ contadaMilesimas, contadaPor: ctx.usuarioId, contadaEn: sql`now()` })
    .where(and(eq(insumosConteoLineas.tenantId, ctx.empresaId), eq(insumosConteoLineas.conteoId, conteoId), eq(insumosConteoLineas.articuloId, articuloId)))
    .returning({ id: insumosConteoLineas.id });
  return r.length > 0;
}

export async function fijarMovimientoDeLinea(tx: Transaccion, ctx: ContextoDeEmpresa, lineaId: string, movimientoId: string): Promise<void> {
  await tx.update(insumosConteoLineas).set({ movimientoId }).where(and(eq(insumosConteoLineas.tenantId, ctx.empresaId), eq(insumosConteoLineas.id, lineaId)));
}

export async function cerrarConteo(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<void> {
  await tx
    .update(insumosConteos)
    .set({ estado: 'cerrado', cerradoEn: sql`now()`, cerradoPor: ctx.usuarioId, actualizadoEn: sql`now()` })
    .where(and(tConteo(ctx), eq(insumosConteos.id, id)));
}

/** El motivo se guarda al final de la nota (no hay columna aparte: un conteo anulado no se vuelve a abrir). */
export async function anularConteo(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, motivo: string): Promise<void> {
  await tx
    .update(insumosConteos)
    .set({
      estado: 'anulado',
      anuladoEn: sql`now()`,
      anuladoPor: ctx.usuarioId,
      nota: sql`case when ${insumosConteos.nota} is null then ${`Anulado: ${motivo}`} else ${insumosConteos.nota} || ${` · Anulado: ${motivo}`} end`,
      actualizadoEn: sql`now()`,
    })
    .where(and(tConteo(ctx), eq(insumosConteos.id, id)));
}

export type FiltroDeConteos = 'abiertos' | 'cerrados' | 'anulados' | 'todos';
const ESTADO_DE_FILTRO = { abiertos: 'abierto', cerrados: 'cerrado', anulados: 'anulado' } as const;

export async function listarConteos(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  o: { limite: number; cursor?: string; estado: FiltroDeConteos; sucursalId?: string },
): Promise<{ items: Conteo[]; siguiente: string | null } | 'cursor_invalido'> {
  const filtros = [tConteo(ctx)];
  if (o.estado !== 'todos') filtros.push(eq(insumosConteos.estado, ESTADO_DE_FILTRO[o.estado]));
  if (o.sucursalId) filtros.push(eq(insumosConteos.sucursalId, o.sucursalId));
  if (o.cursor) {
    const pos = decodificarCursorPorInstante(o.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(lt(sql`${insumosConteos.creadoEn}::text`, pos.instante), and(eq(sql`${insumosConteos.creadoEn}::text`, pos.instante), lt(insumosConteos.id, pos.id)))!);
  }
  const filas = await consultaDeConteos(tx)
    .where(and(...filtros))
    .orderBy(desc(insumosConteos.creadoEn), desc(insumosConteos.id))
    .limit(o.limite + 1);
  const hayMas = filas.length > o.limite;
  const pagina = hayMas ? filas.slice(0, o.limite) : filas;
  const ultimo = pagina.at(-1);
  return { items: pagina.map(aConteo), siguiente: hayMas && ultimo ? codificarCursorPorInstante({ instante: ultimo.instante, id: ultimo.c.id }) : null };
}

// ───────── Kardex ─────────

/** Los movimientos de un artículo (de una sucursal o de todas) en orden cronológico, con su cantidad con signo. */
export async function movimientosParaKardex(tx: Transaccion, ctx: ContextoDeEmpresa, articuloId: string, sucursalId: string | undefined): Promise<MovimientoParaKardex[]> {
  const filas = await tx
    .select({
      movimientoId: insumosMovimientos.id,
      fecha: sql<string>`to_char(${insumosMovimientos.creadoEn} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      tipo: insumosMovimientos.tipo,
      cantidadMilesimas: insumosMovimientos.cantidadMilesimas,
      costoUnitarioMilesimas: insumosMovimientos.costoUnitarioMilesimas,
      motivo: insumosMovimientos.motivo,
    })
    .from(insumosMovimientos)
    .where(and(eq(insumosMovimientos.tenantId, ctx.empresaId), eq(insumosMovimientos.articuloId, articuloId), sucursalId ? eq(insumosMovimientos.sucursalId, sucursalId) : undefined))
    .orderBy(asc(insumosMovimientos.creadoEn), asc(insumosMovimientos.id));
  return filas.map((f) => ({ ...f, tipo: f.tipo as MovimientoParaKardex['tipo'] }));
}
