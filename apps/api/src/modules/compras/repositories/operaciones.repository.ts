import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { EstadoDeSolicitudDeCompra } from '@capaz/shared';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { comprasOrdenLineas, comprasOrdenes } from '../../../db/esquema/compras.js';
import { comprasFacturas, comprasSolicitudLineas, comprasSolicitudes } from '../../../db/esquema/compras-operaciones.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursor, decodificarCursor } from '../domain/cursor.js';

// Solicitudes de compra y facturas del proveedor. Recibe la transacción del ejecutor (RLS aísla; el `where` por empresa es
// defensa en profundidad).

export type Solicitud = typeof comprasSolicitudes.$inferSelect;
export type LineaDeSolicitud = typeof comprasSolicitudLineas.$inferSelect;
export type Factura = typeof comprasFacturas.$inferSelect & { proveedorNombre: string; ordenSerie: string | null; ordenAnio: number | null; ordenNumero: number | null };

const sDe = (ctx: ContextoDeEmpresa) => eq(comprasSolicitudes.tenantId, ctx.empresaId);
const fDe = (ctx: ContextoDeEmpresa) => eq(comprasFacturas.tenantId, ctx.empresaId);

// ───────── Solicitudes ─────────

export type LineaDeSolicitudNueva = { posicion: number; productoId: string | null; descripcion: string; unidad: string; cantidadMilesimas: number };

export async function crearSolicitud(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  d: { fecha: string; necesariaEl: string | null; area: string | null; motivo: string | null },
): Promise<string> {
  const [f] = await tx.insert(comprasSolicitudes).values({ ...d, tenantId: ctx.empresaId, solicitadoPor: ctx.usuarioId, creadoPor: ctx.usuarioId }).returning({ id: comprasSolicitudes.id });
  return f!.id;
}

export async function reemplazarLineasDeSolicitud(tx: Transaccion, ctx: ContextoDeEmpresa, solicitudId: string, lineas: readonly LineaDeSolicitudNueva[]): Promise<void> {
  await tx.delete(comprasSolicitudLineas).where(and(eq(comprasSolicitudLineas.tenantId, ctx.empresaId), eq(comprasSolicitudLineas.solicitudId, solicitudId)));
  if (lineas.length > 0) await tx.insert(comprasSolicitudLineas).values(lineas.map((l) => ({ ...l, tenantId: ctx.empresaId, solicitudId })));
}

/** Con `bloquear`, la fila se toma con `for update`: dos resoluciones a la vez se turnan y la segunda ve el estado nuevo. */
export async function verSolicitud(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { bloquear?: boolean } = {}): Promise<Solicitud | null> {
  const q = tx.select().from(comprasSolicitudes).where(and(sDe(ctx), eq(comprasSolicitudes.id, id)));
  const [f] = opciones.bloquear ? await q.for('update') : await q;
  return f ?? null;
}

export async function lineasDeSolicitudes(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Map<string, LineaDeSolicitud[]>> {
  const porId = new Map<string, LineaDeSolicitud[]>();
  if (ids.length === 0) return porId;
  const filas = await tx
    .select()
    .from(comprasSolicitudLineas)
    .where(and(eq(comprasSolicitudLineas.tenantId, ctx.empresaId), inArray(comprasSolicitudLineas.solicitudId, [...ids])))
    .orderBy(asc(comprasSolicitudLineas.posicion));
  for (const l of filas) porId.set(l.solicitudId, [...(porId.get(l.solicitudId) ?? []), l]);
  return porId;
}

export type CambiosDeSolicitud = Partial<Pick<Solicitud, 'estado' | 'numero' | 'anio' | 'ordenId' | 'resueltoPor' | 'motivoResolucion'>> & { resuelta?: boolean };

export async function actualizarSolicitud(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, { resuelta, ...cambios }: CambiosDeSolicitud): Promise<void> {
  await tx
    .update(comprasSolicitudes)
    .set({ ...cambios, ...(resuelta && { resueltoEn: sql`now()` }), actualizadoEn: sql`now()` })
    .where(and(sDe(ctx), eq(comprasSolicitudes.id, id)));
}

export type FiltroDeSolicitudes = EstadoDeSolicitudDeCompra | 'abiertas' | 'todas';
const ABIERTAS: EstadoDeSolicitudDeCompra[] = ['borrador', 'pendiente', 'aprobada'];

export async function listarSolicitudes(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  o: { limite: number; cursor?: string; estado: FiltroDeSolicitudes },
): Promise<{ items: Solicitud[]; siguiente: string | null } | 'cursor_invalido'> {
  const filtros: SQL[] = [sDe(ctx)];
  if (o.estado === 'abiertas') filtros.push(inArray(comprasSolicitudes.estado, ABIERTAS));
  else if (o.estado !== 'todas') filtros.push(eq(comprasSolicitudes.estado, o.estado));
  if (o.cursor) {
    const pos = decodificarCursor(o.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(lt(sql`${comprasSolicitudes.creadoEn}::text`, pos.instante), and(eq(sql`${comprasSolicitudes.creadoEn}::text`, pos.instante), lt(comprasSolicitudes.id, pos.id)))!);
  }
  const filas = await tx
    .select({ s: comprasSolicitudes, instante: sql<string>`${comprasSolicitudes.creadoEn}::text` })
    .from(comprasSolicitudes)
    .where(and(...filtros))
    .orderBy(desc(comprasSolicitudes.creadoEn), desc(comprasSolicitudes.id))
    .limit(o.limite + 1);
  const hayMas = filas.length > o.limite;
  const pagina = hayMas ? filas.slice(0, o.limite) : filas;
  const ultimo = pagina.at(-1);
  return { items: pagina.map((f) => f.s), siguiente: hayMas && ultimo ? codificarCursor(ultimo.instante, ultimo.s.id) : null };
}

// ───────── Facturas ─────────

const COLUMNAS_DE_FACTURA = {
  f: comprasFacturas,
  proveedorNombre: clientes.nombre,
  ordenSerie: comprasOrdenes.serie,
  ordenAnio: comprasOrdenes.anio,
  ordenNumero: comprasOrdenes.numero,
  instante: sql<string>`${comprasFacturas.creadoEn}::text`,
};

function consultaDeFacturas(tx: Transaccion) {
  return tx
    .select(COLUMNAS_DE_FACTURA)
    .from(comprasFacturas)
    .innerJoin(clientes, and(eq(clientes.tenantId, comprasFacturas.tenantId), eq(clientes.id, comprasFacturas.proveedorId)))
    .leftJoin(comprasOrdenes, and(eq(comprasOrdenes.tenantId, comprasFacturas.tenantId), eq(comprasOrdenes.id, comprasFacturas.ordenId)));
}

type FilaDeFactura = Awaited<ReturnType<ReturnType<typeof consultaDeFacturas>['limit']>>[number];
const aFactura = (r: FilaDeFactura): Factura => ({ ...r.f, proveedorNombre: r.proveedorNombre, ordenSerie: r.ordenSerie, ordenAnio: r.ordenAnio, ordenNumero: r.ordenNumero });

export async function verFactura(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { bloquear?: boolean } = {}): Promise<Factura | null> {
  if (opciones.bloquear) await tx.select({ id: comprasFacturas.id }).from(comprasFacturas).where(and(fDe(ctx), eq(comprasFacturas.id, id))).for('update');
  const [f] = await consultaDeFacturas(tx).where(and(fDe(ctx), eq(comprasFacturas.id, id)));
  return f ? aFactura(f) : null;
}

export type DatosDeFactura = {
  proveedorId: string;
  ordenId: string | null;
  serie: string;
  numero: string;
  fecha: string;
  venceEl: string | null;
  moneda: string;
  subtotalCentimos: number;
  igvCentimos: number;
  totalCentimos: number;
  notas: string | null;
};

/** `null` si ese comprobante de ese proveedor ya está registrado (único parcial de la base): no se duplica. */
export async function crearFactura(tx: Transaccion, ctx: ContextoDeEmpresa, d: DatosDeFactura): Promise<string | null> {
  const [f] = await tx.insert(comprasFacturas).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).onConflictDoNothing().returning({ id: comprasFacturas.id });
  return f?.id ?? null;
}

export async function anularFactura(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, motivo: string): Promise<void> {
  await tx
    .update(comprasFacturas)
    .set({ anuladoEn: sql`now()`, anuladoPor: ctx.usuarioId, motivoAnulacion: motivo, actualizadoEn: sql`now()` })
    .where(and(fDe(ctx), eq(comprasFacturas.id, id)));
}

export async function listarFacturas(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  o: { limite: number; cursor?: string; estado: 'vigentes' | 'anuladas' | 'todas'; proveedorId?: string; ordenId?: string },
): Promise<{ items: Factura[]; siguiente: string | null } | 'cursor_invalido'> {
  const filtros: SQL[] = [fDe(ctx)];
  if (o.estado === 'vigentes') filtros.push(isNull(comprasFacturas.anuladoEn));
  if (o.estado === 'anuladas') filtros.push(isNotNull(comprasFacturas.anuladoEn));
  if (o.proveedorId) filtros.push(eq(comprasFacturas.proveedorId, o.proveedorId));
  if (o.ordenId) filtros.push(eq(comprasFacturas.ordenId, o.ordenId));
  if (o.cursor) {
    const pos = decodificarCursor(o.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(lt(sql`${comprasFacturas.creadoEn}::text`, pos.instante), and(eq(sql`${comprasFacturas.creadoEn}::text`, pos.instante), lt(comprasFacturas.id, pos.id)))!);
  }
  const filas = await consultaDeFacturas(tx)
    .where(and(...filtros))
    .orderBy(desc(comprasFacturas.creadoEn), desc(comprasFacturas.id))
    .limit(o.limite + 1);
  const hayMas = filas.length > o.limite;
  const pagina = hayMas ? filas.slice(0, o.limite) : filas;
  const ultimo = pagina.at(-1);
  return { items: pagina.map(aFactura), siguiente: hayMas && ultimo ? codificarCursor(ultimo.instante, ultimo.f.id) : null };
}

/** El total de la orden y el valor de lo recibido (IGV incluido): lo que la factura debe cuadrar. */
export async function totalesParaConciliar(tx: Transaccion, ctx: ContextoDeEmpresa, ordenId: string): Promise<{ ordenTotalCentimos: number; lineas: Array<{ cantidadMilesimas: number; costoUnitarioMilesimas: number }> } | null> {
  const [o] = await tx.select({ total: comprasOrdenes.totalCentimos }).from(comprasOrdenes).where(and(eq(comprasOrdenes.tenantId, ctx.empresaId), eq(comprasOrdenes.id, ordenId)));
  if (!o) return null;
  const lineas = await tx
    .select({ cantidadMilesimas: comprasOrdenLineas.recibidoMilesimas, costoUnitarioMilesimas: comprasOrdenLineas.costoUnitarioMilesimas })
    .from(comprasOrdenLineas)
    .where(and(eq(comprasOrdenLineas.tenantId, ctx.empresaId), eq(comprasOrdenLineas.ordenId, ordenId)));
  return { ordenTotalCentimos: o.total, lineas };
}
