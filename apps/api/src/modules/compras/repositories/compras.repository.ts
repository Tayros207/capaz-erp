import { and, asc, desc, eq, getTableColumns, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { ESTADOS_ABIERTOS_DE_COMPRA, ESTADOS_POR_RECIBIR_DE_COMPRA, type EstadoDeCompra } from '@capaz/shared';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { comprasOrdenLineas, comprasOrdenes } from '../../../db/esquema/compras.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursor, decodificarCursor } from '../domain/cursor.js';
import type { LineaPreparada } from '../domain/orden.js';

// Repositorio de órdenes de compra: recibe la transacción del ejecutor (RLS aísla; el `where` por empresa
// es defensa en profundidad). `alcance: 'propios'` limita a las órdenes que la persona creó (R4: la tabla
// no tiene responsable).

export type Alcance = 'todos' | 'propios';
export type Compra = typeof comprasOrdenes.$inferSelect & { proveedorNombre: string; lineas: number; lineasPorRecibir: number };
export type LineaDeCompra = typeof comprasOrdenLineas.$inferSelect;

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(comprasOrdenes.tenantId, ctx.empresaId);
const deAlcance = (ctx: ContextoDeEmpresa, alcance: Alcance): SQL | undefined => (alcance === 'propios' ? eq(comprasOrdenes.creadoPor, ctx.usuarioId) : undefined);

const columnas = {
  ...getTableColumns(comprasOrdenes),
  proveedorNombre: clientes.nombre,
  lineas: sql<number>`(select count(*)::int from compras.orden_lineas l where l.tenant_id = ${comprasOrdenes.tenantId} and l.orden_id = ${comprasOrdenes.id})`,
  lineasPorRecibir: sql<number>`(select count(*)::int from compras.orden_lineas l
    where l.tenant_id = ${comprasOrdenes.tenantId} and l.orden_id = ${comprasOrdenes.id} and l.recibido_milesimas < l.cantidad_milesimas)`,
};
const conProveedor = and(eq(clientes.tenantId, comprasOrdenes.tenantId), eq(clientes.id, comprasOrdenes.proveedorId));

/**
 * `bloquear` toma primero la fila de la orden con `for update` (dos cambios a la vez se turnan: dos
 * recepciones simultáneas no pasan de lo pedido) y después la lee: así lo leído es lo último confirmado.
 * El bloqueo va en una consulta sin `join` a propósito.
 */
export async function verCompra(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { alcance: Alcance; bloquear?: boolean }): Promise<Compra | null> {
  const donde = and(deEmpresa(ctx), eq(comprasOrdenes.id, id), deAlcance(ctx, opciones.alcance));
  if (opciones.bloquear) {
    const tomada = await tx.select({ id: comprasOrdenes.id }).from(comprasOrdenes).where(donde).for('update');
    if (tomada.length === 0) return null;
  }
  const [fila] = await tx.select(columnas).from(comprasOrdenes).innerJoin(clientes, conProveedor).where(donde);
  return fila ?? null;
}

export async function lineasDe(tx: Transaccion, ctx: ContextoDeEmpresa, ordenId: string): Promise<LineaDeCompra[]> {
  return tx
    .select()
    .from(comprasOrdenLineas)
    .where(and(eq(comprasOrdenLineas.tenantId, ctx.empresaId), eq(comprasOrdenLineas.ordenId, ordenId)))
    .orderBy(asc(comprasOrdenLineas.posicion));
}

export type DatosDeCompra = {
  proveedorId: string;
  fecha: string;
  entregaEl: string | null;
  notas: string | null;
  sucursalId: string | null;
  igvPorcentaje: number;
};
export type Totales = { subtotalCentimos: number; igvCentimos: number; totalCentimos: number };

/** Crea el borrador (sin número: lo recibe al enviarse). */
export async function crearCompra(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeCompra, totales: Totales): Promise<string> {
  const [fila] = await tx
    .insert(comprasOrdenes)
    .values({ ...datos, ...totales, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .returning({ id: comprasOrdenes.id });
  return fila!.id;
}

/** Borra todas las líneas e inserta las nuevas (solo se llama con la orden en borrador y bloqueada). */
export async function reemplazarLineas(tx: Transaccion, ctx: ContextoDeEmpresa, ordenId: string, lineas: readonly LineaPreparada[]): Promise<void> {
  await tx.delete(comprasOrdenLineas).where(and(eq(comprasOrdenLineas.tenantId, ctx.empresaId), eq(comprasOrdenLineas.ordenId, ordenId)));
  if (lineas.length === 0) return;
  await tx.insert(comprasOrdenLineas).values(lineas.map((l) => ({ ...l, tenantId: ctx.empresaId, ordenId })));
}

export type CambiosDeCompra = Partial<
  Pick<
    typeof comprasOrdenes.$inferInsert,
    'proveedorId' | 'entregaEl' | 'notas' | 'sucursalId' | 'subtotalCentimos' | 'igvCentimos' | 'totalCentimos' | 'estado' | 'numero' | 'serie' | 'anio' | 'canceladoPor' | 'motivoCancelacion'
  >
> & { canceladoAhora?: boolean };

/** Aplica los cambios a una orden ya comprobada (y bloqueada) por la herramienta. */
export async function actualizarCompra(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cambios: CambiosDeCompra): Promise<void> {
  const { canceladoAhora, ...campos } = cambios;
  const r = await tx
    .update(comprasOrdenes)
    .set({ ...campos, ...(canceladoAhora && { canceladoEn: sql`now()` }), actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(comprasOrdenes.id, id)))
    .returning({ id: comprasOrdenes.id });
  if (r.length !== 1) throw new Error('No se pudo actualizar la orden de compra.');
}

// --- Listado con cursor por instante (creado_en, id) descendente ---

export type FiltroDeEstadoDeCompra = EstadoDeCompra | 'abiertas' | 'por_recibir' | 'todas';
export type FiltrosDeCompras = { limite: number; cursor?: string; estado: FiltroDeEstadoDeCompra; proveedorId?: string; entregaDesde?: string; entregaHasta?: string };

function filtroDeEstado(estado: FiltroDeEstadoDeCompra): SQL | undefined {
  if (estado === 'todas') return undefined;
  if (estado === 'abiertas') return inArray(comprasOrdenes.estado, [...ESTADOS_ABIERTOS_DE_COMPRA]);
  if (estado === 'por_recibir') return inArray(comprasOrdenes.estado, [...ESTADOS_POR_RECIBIR_DE_COMPRA]);
  return eq(comprasOrdenes.estado, estado);
}

export async function listarCompras(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  alcance: Alcance,
  f: FiltrosDeCompras,
): Promise<{ items: Compra[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = f.cursor ? decodificarCursor(f.cursor) : null;
  if (f.cursor && !pos) return 'cursor_invalido';
  const filas = await tx
    .select({ ...columnas, instante: sql<string>`${comprasOrdenes.creadoEn}::text` })
    .from(comprasOrdenes)
    .innerJoin(clientes, conProveedor)
    .where(
      and(
        deEmpresa(ctx),
        deAlcance(ctx, alcance),
        filtroDeEstado(f.estado),
        f.proveedorId ? eq(comprasOrdenes.proveedorId, f.proveedorId) : undefined,
        f.entregaDesde ? gte(comprasOrdenes.entregaEl, f.entregaDesde) : undefined,
        f.entregaHasta ? lte(comprasOrdenes.entregaEl, f.entregaHasta) : undefined,
        pos ? sql`(${comprasOrdenes.creadoEn}, ${comprasOrdenes.id}) < (${pos.instante}::timestamptz, ${pos.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(comprasOrdenes.creadoEn), desc(comprasOrdenes.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return {
    items: pagina.map(({ instante: _instante, ...c }) => c),
    siguiente: filas.length > f.limite && ultima ? codificarCursor(ultima.instante, ultima.id) : null,
  };
}
