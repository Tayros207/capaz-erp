import { and, asc, desc, eq, getTableColumns, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { ESTADOS_ABIERTOS_DE_PEDIDO, type DetalleDeEventoDePedido, type EstadoDePedido } from '@capaz/shared';
import { clientes, productos, sucursales } from '../../../db/esquema/core-maestros.js';
import { ordenesGuias, ordenesPedidoEventos, ordenesPedidoLineas, ordenesPedidos } from '../../../db/esquema/ordenes.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { LineaPreparada, ProductoParaLinea } from '../domain/pedido.js';

// Repositorio de pedidos: recibe la transacción del ejecutor (RLS aísla; el `where` por empresa es
// defensa en profundidad). `alcance: 'propios'` limita a lo que la persona creó o tiene a cargo (R4).

export type Alcance = 'todos' | 'propios';
export type Pedido = typeof ordenesPedidos.$inferSelect & { clienteNombre: string; lineas: number };
export type LineaDePedido = typeof ordenesPedidoLineas.$inferSelect;
export type EventoDePedido = typeof ordenesPedidoEventos.$inferSelect & { usuarioNombre: string | null; guiaSerie: string | null; guiaNumero: number | null };
export type TipoDeEvento = 'creado' | 'editado' | 'confirmado' | 'estado' | 'cancelado' | 'nota' | 'datos_editados' | 'corregido' | 'guia_emitida' | 'guia_anulada';

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(ordenesPedidos.tenantId, ctx.empresaId);
export const deAlcance = (ctx: ContextoDeEmpresa, alcance: Alcance): SQL | undefined =>
  alcance === 'propios' ? or(eq(ordenesPedidos.creadoPor, ctx.usuarioId), eq(ordenesPedidos.responsableId, ctx.usuarioId)) : undefined;

const columnas = {
  ...getTableColumns(ordenesPedidos),
  clienteNombre: clientes.nombre,
  lineas: sql<number>`(select count(*)::int from ordenes.pedido_lineas l where l.tenant_id = ${ordenesPedidos.tenantId} and l.pedido_id = ${ordenesPedidos.id})`,
};
const conCliente = and(eq(clientes.tenantId, ordenesPedidos.tenantId), eq(clientes.id, ordenesPedidos.clienteId));

/**
 * `bloquear` toma primero la fila del pedido con `for update` (dos cambios a la vez se turnan) y después
 * la lee: así lo leído es lo último confirmado. El bloqueo va en una consulta sin `join` a propósito.
 */
export async function verPedido(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { alcance: Alcance; bloquear?: boolean }): Promise<Pedido | null> {
  const donde = and(deEmpresa(ctx), eq(ordenesPedidos.id, id), deAlcance(ctx, opciones.alcance));
  if (opciones.bloquear) {
    const tomada = await tx.select({ id: ordenesPedidos.id }).from(ordenesPedidos).where(donde).for('update');
    if (tomada.length === 0) return null;
  }
  const [fila] = await tx.select(columnas).from(ordenesPedidos).innerJoin(clientes, conCliente).where(donde);
  return fila ?? null;
}

export async function lineasDe(tx: Transaccion, ctx: ContextoDeEmpresa, pedidoId: string): Promise<LineaDePedido[]> {
  return tx
    .select()
    .from(ordenesPedidoLineas)
    .where(and(eq(ordenesPedidoLineas.tenantId, ctx.empresaId), eq(ordenesPedidoLineas.pedidoId, pedidoId)))
    .orderBy(asc(ordenesPedidoLineas.posicion));
}

const MAXIMO_DE_HISTORIAL = 200;

/** Lo más reciente primero. */
export async function historialDe(tx: Transaccion, ctx: ContextoDeEmpresa, pedidoId: string): Promise<EventoDePedido[]> {
  const filas = await tx
    .select({ ...getTableColumns(ordenesPedidoEventos), guiaSerie: ordenesGuias.serie, guiaNumero: ordenesGuias.numero })
    .from(ordenesPedidoEventos)
    .leftJoin(ordenesGuias, and(eq(ordenesGuias.tenantId, ordenesPedidoEventos.tenantId), eq(ordenesGuias.id, ordenesPedidoEventos.guiaId)))
    .where(and(eq(ordenesPedidoEventos.tenantId, ctx.empresaId), eq(ordenesPedidoEventos.pedidoId, pedidoId)))
    .orderBy(desc(ordenesPedidoEventos.creadoEn), desc(ordenesPedidoEventos.id))
    .limit(MAXIMO_DE_HISTORIAL);
  const nombres = await nombresDeMiembros(tx, [...new Set(filas.map((f) => f.usuarioId))]);
  return filas.map((f) => ({ ...f, usuarioNombre: nombres.get(f.usuarioId) ?? null }));
}

/** Nombre de cada miembro de la empresa por su identificador (vista `core.v_miembros`); quien ya no es miembro no aparece. */
export async function nombresDeMiembros(tx: Transaccion, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const r = await tx.execute<{ usuario_id: string; nombre: string }>(sql`select usuario_id, nombre from core.v_miembros where usuario_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  return new Map(r.rows.map((f) => [f.usuario_id, f.nombre]));
}

export type DatosDePedido = {
  clienteId: string;
  fecha: string;
  entregaEl: string | null;
  responsableId: string | null;
  notas: string | null;
  sucursalId: string | null;
  origenTipo: string | null;
  origenId: string | null;
  igvPorcentaje: number;
};
export type Totales = { subtotalCentimos: number; igvCentimos: number; totalCentimos: number };

/** Crea el borrador. `null` si ya hay un pedido vivo con el mismo origen (único parcial de la base). */
export async function crearPedido(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDePedido, totales: Totales): Promise<string | null> {
  const [fila] = await tx
    .insert(ordenesPedidos)
    .values({ ...datos, ...totales, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning({ id: ordenesPedidos.id });
  return fila?.id ?? null;
}

/** El pedido vivo (no cancelado) que ya usa ese origen, sin mirar el alcance: solo para explicar el choque. */
export async function pedidoPorOrigen(tx: Transaccion, ctx: ContextoDeEmpresa, origenTipo: string, origenId: string) {
  const [fila] = await tx
    .select({ id: ordenesPedidos.id, numero: ordenesPedidos.numero, serie: ordenesPedidos.serie, anio: ordenesPedidos.anio, estado: ordenesPedidos.estado })
    .from(ordenesPedidos)
    .where(and(deEmpresa(ctx), eq(ordenesPedidos.origenTipo, origenTipo), eq(ordenesPedidos.origenId, origenId), sql`${ordenesPedidos.estado} <> 'cancelado'`));
  return fila ?? null;
}

/** Borra todas las líneas del pedido e inserta las nuevas (solo se llama con el pedido en borrador y bloqueado). */
export async function reemplazarLineas(tx: Transaccion, ctx: ContextoDeEmpresa, pedidoId: string, lineas: readonly LineaPreparada[]): Promise<void> {
  await tx.delete(ordenesPedidoLineas).where(and(eq(ordenesPedidoLineas.tenantId, ctx.empresaId), eq(ordenesPedidoLineas.pedidoId, pedidoId)));
  if (lineas.length === 0) return;
  await tx.insert(ordenesPedidoLineas).values(lineas.map((l) => ({ ...l, tenantId: ctx.empresaId, pedidoId })));
}

export type CambiosDePedido = Partial<
  Pick<
    typeof ordenesPedidos.$inferInsert,
    | 'clienteId' | 'entregaEl' | 'responsableId' | 'notas' | 'sucursalId' | 'subtotalCentimos' | 'igvCentimos' | 'totalCentimos' | 'igvPorcentaje'
    | 'version' | 'estado' | 'numero' | 'serie' | 'anio' | 'canceladoPor' | 'motivoCancelacion'
  >
> & { confirmadoAhora?: boolean; entregadoAhora?: boolean; canceladoAhora?: boolean };

/** Aplica los cambios a un pedido ya comprobado (y bloqueado) por la herramienta. */
export async function actualizarPedido(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cambios: CambiosDePedido): Promise<void> {
  const { confirmadoAhora, entregadoAhora, canceladoAhora, ...campos } = cambios;
  const r = await tx
    .update(ordenesPedidos)
    .set({
      ...campos,
      ...(confirmadoAhora && { confirmadoEn: sql`now()` }),
      ...(entregadoAhora && { entregadoEn: sql`now()` }),
      ...(canceladoAhora && { canceladoEn: sql`now()` }),
      actualizadoEn: sql`now()`,
    })
    .where(and(deEmpresa(ctx), eq(ordenesPedidos.id, id)))
    .returning({ id: ordenesPedidos.id });
  if (r.length !== 1) throw new Error('No se pudo actualizar el pedido.');
}

export async function registrarEvento(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  pedidoId: string,
  evento: { tipo: TipoDeEvento; estadoAnterior?: EstadoDePedido; estadoNuevo?: EstadoDePedido; nota?: string; detalle?: DetalleDeEventoDePedido; guiaId?: string },
): Promise<void> {
  await tx.insert(ordenesPedidoEventos).values({ ...evento, tenantId: ctx.empresaId, pedidoId, usuarioId: ctx.usuarioId });
}

// --- Listado con cursor por instante (creado_en, id) descendente ---

export const codificarCursor = (instante: string, id: string) => Buffer.from(`${instante}|${id}`).toString('base64url');
const FORMA_DE_CURSOR = /^(.+)\|([0-9a-f-]{36})$/;

export function decodificarCursor(cursor: string): { instante: string; id: string } | null {
  const m = FORMA_DE_CURSOR.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}

export type FiltrosDePedidos = {
  limite: number;
  cursor?: string;
  estado: EstadoDePedido | 'abiertos' | 'todos';
  clienteId?: string;
  responsableId?: string;
  entregaDesde?: string;
  entregaHasta?: string;
};

function filtroDeEstado(estado: FiltrosDePedidos['estado']): SQL | undefined {
  if (estado === 'todos') return undefined;
  if (estado === 'abiertos') return inArray(ordenesPedidos.estado, [...ESTADOS_ABIERTOS_DE_PEDIDO]);
  return eq(ordenesPedidos.estado, estado);
}

export async function listarPedidos(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  alcance: Alcance,
  f: FiltrosDePedidos,
): Promise<{ items: Pedido[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = f.cursor ? decodificarCursor(f.cursor) : null;
  if (f.cursor && !pos) return 'cursor_invalido';
  const filas = await tx
    .select({ ...columnas, instante: sql<string>`${ordenesPedidos.creadoEn}::text` })
    .from(ordenesPedidos)
    .innerJoin(clientes, conCliente)
    .where(
      and(
        deEmpresa(ctx),
        deAlcance(ctx, alcance),
        filtroDeEstado(f.estado),
        f.clienteId ? eq(ordenesPedidos.clienteId, f.clienteId) : undefined,
        f.responsableId ? eq(ordenesPedidos.responsableId, f.responsableId) : undefined,
        f.entregaDesde ? gte(ordenesPedidos.entregaEl, f.entregaDesde) : undefined,
        f.entregaHasta ? lte(ordenesPedidos.entregaEl, f.entregaHasta) : undefined,
        pos ? sql`(${ordenesPedidos.creadoEn}, ${ordenesPedidos.id}) < (${pos.instante}::timestamptz, ${pos.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(ordenesPedidos.creadoEn), desc(ordenesPedidos.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return {
    items: pagina.map(({ instante: _instante, ...p }) => p),
    siguiente: filas.length > f.limite && ultima ? codificarCursor(ultima.instante, ultima.id) : null,
  };
}

// --- Lo que un pedido necesita del núcleo ---

export async function clienteVigente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [fila] = await tx
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, id), sql`${clientes.archivadoEn} is null`, sql`${clientes.fusionadoEn} is null`));
  return fila !== undefined;
}

export async function sucursalVigente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [fila] = await tx
    .select({ id: sucursales.id })
    .from(sucursales)
    .where(and(eq(sucursales.tenantId, ctx.empresaId), eq(sucursales.id, id), sql`${sucursales.archivadoEn} is null`));
  return fila !== undefined;
}

/** Código de la sucursal del pedido o, si no tiene, el de la principal: es la serie del correlativo. */
export async function serieDe(tx: Transaccion, ctx: ContextoDeEmpresa, sucursalId: string | null): Promise<string | null> {
  const [fila] = await tx
    .select({ codigo: sucursales.codigo })
    .from(sucursales)
    .where(and(eq(sucursales.tenantId, ctx.empresaId), sucursalId ? eq(sucursales.id, sucursalId) : sql`${sucursales.esPrincipal}`));
  return fila?.codigo ?? null;
}

/** ¿Es miembro de la empresa? Por la vista `core.v_miembros`, como `miembros_listar`. */
export async function esMiembro(tx: Transaccion, usuarioId: string): Promise<boolean> {
  const r = await tx.execute(sql`select 1 from core.v_miembros where usuario_id = ${usuarioId} limit 1`);
  return r.rows.length > 0;
}

export async function productosPorId(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Map<string, ProductoParaLinea>> {
  if (ids.length === 0) return new Map();
  const filas = await tx
    .select({
      id: productos.id,
      nombre: productos.nombre,
      unidad: productos.unidad,
      precioUnitarioMilesimas: productos.precioUnitarioMilesimas,
      afectoIgv: productos.afectoIgv,
      archivadoEn: productos.archivadoEn,
    })
    .from(productos)
    .where(and(eq(productos.tenantId, ctx.empresaId), inArray(productos.id, [...new Set(ids)])));
  return new Map(filas.map(({ archivadoEn, ...p }) => [p.id, { ...p, archivado: archivadoEn !== null }]));
}
