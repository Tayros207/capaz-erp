import { and, asc, desc, eq, gte, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import type { EstadoDeOrdenDeProduccion, LineaDeOrdenEntrada } from '@capaz/shared';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { produccionOrdenEventos, produccionOrdenItems, produccionOrdenes } from '../../../db/esquema/produccion.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Órdenes de trabajo, sus líneas y su historial. Recibe la transacción de `conEmpresa` (RLS aísla; el `where` por empresa
// es defensa en profundidad).

export type Orden = typeof produccionOrdenes.$inferSelect & { clienteNombre: string };
export type Item = typeof produccionOrdenItems.$inferSelect;
export type EventoDeOrden = typeof produccionOrdenEventos.$inferSelect;
export type LineaPreparada = LineaDeOrdenEntrada & { unidad: string; subtotalCentimos: number };

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(produccionOrdenes.tenantId, ctx.empresaId);

// Cursor opaco por instante: `(creado_en como texto, id)` en base64url (el texto de PostgreSQL conserva los microsegundos).
const codificarCursor = (instante: string, id: string): string => Buffer.from(`${instante}|${id}`).toString('base64url');
function decodificarCursor(cursor: string): { instante: string; id: string } | null {
  const m = /^(.+)\|([0-9a-f-]{36})$/.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}

const consulta = (tx: Transaccion) =>
  tx
    .select({ o: produccionOrdenes, clienteNombre: clientes.nombre, instante: sql<string>`${produccionOrdenes.creadoEn}::text` })
    .from(produccionOrdenes)
    .innerJoin(clientes, and(eq(clientes.tenantId, produccionOrdenes.tenantId), eq(clientes.id, produccionOrdenes.clienteId)));

export type DatosDeOrden = {
  numero: number;
  anio: number;
  fecha: string;
  entregaEl: string | null;
  clienteId: string;
  totalCentimos: number;
  adelantoCentimos: number;
  notas: string | null;
};

export async function crearOrden(tx: Transaccion, ctx: ContextoDeEmpresa, d: DatosDeOrden): Promise<string> {
  const [f] = await tx.insert(produccionOrdenes).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning({ id: produccionOrdenes.id });
  return f!.id;
}

/** Con `bloquear`, la fila se toma con `for update`: dos cambios a la vez se turnan y el segundo ve el estado nuevo. */
export async function verOrden(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { bloquear?: boolean } = {}): Promise<Orden | null> {
  if (opciones.bloquear) await tx.select({ id: produccionOrdenes.id }).from(produccionOrdenes).where(and(deEmpresa(ctx), eq(produccionOrdenes.id, id))).for('update');
  const [f] = await consulta(tx).where(and(deEmpresa(ctx), eq(produccionOrdenes.id, id)));
  return f ? { ...f.o, clienteNombre: f.clienteNombre } : null;
}

export type CambiosDeOrden = Partial<Omit<DatosDeOrden, 'numero' | 'anio'>> & {
  estado?: EstadoDeOrdenDeProduccion;
  entregada?: boolean;
  /** Vuelve a pendiente desde anulada: limpia la anulación. */
  reactivada?: boolean;
  anulada?: { motivo: string; destinoAdelanto: 'devuelto' | 'retenido' | null };
};

export async function actualizarOrden(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, { entregada, reactivada, anulada, ...cambios }: CambiosDeOrden): Promise<void> {
  await tx
    .update(produccionOrdenes)
    .set({
      ...cambios,
      ...(entregada && { entregadoEn: sql`now()` }),
      ...(reactivada && { anuladoEn: null, anuladoPor: null, motivoAnulacion: null, destinoAdelanto: null }),
      ...(anulada && { anuladoEn: sql`now()`, anuladoPor: ctx.usuarioId, motivoAnulacion: anulada.motivo, destinoAdelanto: anulada.destinoAdelanto }),
      actualizadoEn: sql`now()`,
    })
    .where(and(deEmpresa(ctx), eq(produccionOrdenes.id, id)));
}

/** Borra las líneas e inserta las nuevas, en orden (posiciones 0..n). */
export async function reemplazarItems(tx: Transaccion, ctx: ContextoDeEmpresa, ordenId: string, lineas: readonly LineaPreparada[]): Promise<void> {
  await tx.delete(produccionOrdenItems).where(and(eq(produccionOrdenItems.tenantId, ctx.empresaId), eq(produccionOrdenItems.ordenId, ordenId)));
  await tx.insert(produccionOrdenItems).values(
    lineas.map((l, posicion) => ({
      tenantId: ctx.empresaId,
      ordenId,
      posicion,
      descripcion: l.descripcion,
      unidad: l.unidad,
      cantidadMilesimas: l.cantidadMilesimas,
      precioUnitarioMilesimas: l.precioUnitarioMilesimas,
      subtotalCentimos: l.subtotalCentimos,
      material: l.material?.trim() || null,
      medida: l.medida?.trim() || null,
      colores: l.colores?.trim() || null,
      acabado: l.acabado?.trim() || null,
    })),
  );
}

export async function itemsDeOrdenes(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Map<string, Item[]>> {
  const porOrden = new Map<string, Item[]>();
  if (ids.length === 0) return porOrden;
  const filas = await tx
    .select()
    .from(produccionOrdenItems)
    .where(and(eq(produccionOrdenItems.tenantId, ctx.empresaId), inArray(produccionOrdenItems.ordenId, [...ids])))
    .orderBy(asc(produccionOrdenItems.posicion));
  for (const f of filas) porOrden.set(f.ordenId, [...(porOrden.get(f.ordenId) ?? []), f]);
  return porOrden;
}

export async function agregarEvento(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  e: { ordenId: string; tipo: 'creada' | 'editada' | 'estado' | 'anulada' | 'cobro'; estadoAnterior: string | null; estadoNuevo: string; nota: string | null },
): Promise<void> {
  await tx.insert(produccionOrdenEventos).values({ ...e, tenantId: ctx.empresaId, usuarioId: ctx.usuarioId });
}

export async function eventosDeOrden(tx: Transaccion, ctx: ContextoDeEmpresa, ordenId: string): Promise<EventoDeOrden[]> {
  return tx
    .select()
    .from(produccionOrdenEventos)
    .where(and(eq(produccionOrdenEventos.tenantId, ctx.empresaId), eq(produccionOrdenEventos.ordenId, ordenId)))
    .orderBy(asc(produccionOrdenEventos.creadoEn), asc(produccionOrdenEventos.id));
}

export type FiltroDeEstado = EstadoDeOrdenDeProduccion | 'en_cola' | 'todas';
const EN_COLA: EstadoDeOrdenDeProduccion[] = ['pendiente', 'en_maquina', 'listo'];
const sinTildes = (texto: string): string => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export async function listarOrdenes(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  o: { limite: number; cursor?: string; estado: FiltroDeEstado; desde?: string; hasta?: string; clienteId?: string; buscar?: string },
): Promise<{ items: Orden[]; siguiente: string | null } | 'cursor_invalido'> {
  const filtros: SQL[] = [deEmpresa(ctx)];
  if (o.estado === 'en_cola') filtros.push(inArray(produccionOrdenes.estado, EN_COLA));
  else if (o.estado !== 'todas') filtros.push(eq(produccionOrdenes.estado, o.estado));
  if (o.desde) filtros.push(gte(produccionOrdenes.fecha, o.desde));
  if (o.hasta) filtros.push(lte(produccionOrdenes.fecha, o.hasta));
  if (o.clienteId) filtros.push(eq(produccionOrdenes.clienteId, o.clienteId));
  if (o.buscar?.trim()) {
    const patron = `%${sinTildes(o.buscar.trim()).replace(/[\\%_]/g, '\\$&')}%`;
    // Cliente, código, notas y lo escrito en las líneas (trabajo, material, medida, colores, acabado), sin tildes ni mayúsculas.
    const sinAcentos = (c: SQL) => sql`translate(lower(coalesce(${c}, '')), 'áéíóúüñ', 'aeiouun')`;
    filtros.push(
      or(
        sql`${sinAcentos(sql`${clientes.nombre}`)} like ${patron}`,
        sql`lower('OT-' || ${produccionOrdenes.anio} || '-' || lpad(${produccionOrdenes.numero}::text, 4, '0')) like ${patron}`,
        sql`${sinAcentos(sql`${produccionOrdenes.notas}`)} like ${patron}`,
        sql`exists (select 1 from produccion.orden_items i where i.tenant_id = ${produccionOrdenes.tenantId} and i.orden_id = ${produccionOrdenes.id}
          and ${sinAcentos(sql`i.descripcion || ' ' || coalesce(i.material, '') || ' ' || coalesce(i.medida, '') || ' ' || coalesce(i.colores, '') || ' ' || coalesce(i.acabado, '')`)} like ${patron})`,
      )!,
    );
  }
  if (o.cursor) {
    const pos = decodificarCursor(o.cursor);
    if (!pos) return 'cursor_invalido';
    filtros.push(or(lt(sql`${produccionOrdenes.creadoEn}::text`, pos.instante), and(eq(sql`${produccionOrdenes.creadoEn}::text`, pos.instante), lt(produccionOrdenes.id, pos.id)))!);
  }
  const filas = await consulta(tx).where(and(...filtros)).orderBy(desc(produccionOrdenes.creadoEn), desc(produccionOrdenes.id)).limit(o.limite + 1);
  const hayMas = filas.length > o.limite;
  const pagina = hayMas ? filas.slice(0, o.limite) : filas;
  const ultimo = pagina.at(-1);
  return { items: pagina.map((f) => ({ ...f.o, clienteNombre: f.clienteNombre })), siguiente: hayMas && ultimo ? codificarCursor(ultimo.instante, ultimo.o.id) : null };
}

/** El cliente existe en la empresa y no está archivado ni fusionado. */
export async function clienteVigente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [f] = await tx.select({ id: clientes.id }).from(clientes).where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, id), sql`${clientes.archivadoEn} is null`, sql`${clientes.fusionadoEn} is null`));
  return !!f;
}
