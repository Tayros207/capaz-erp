import { and, asc, desc, eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm';
import { DIAS_DE_CANDIDATOS_ENTREGADOS, MAXIMO_DE_CANDIDATOS_PARA_GUIA } from '@capaz/shared';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { ordenesGuiaLineas, ordenesGuias, ordenesPedidoLineas, ordenesPedidos } from '../../../db/esquema/ordenes.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codigoDeGuia, type DatosDeTraslado, type LineaDeGuiaPreparada, type LineaDePedidoParaGuia } from '../domain/guia.js';
import { codigoDePedido } from '../domain/pedido.js';
import { codificarCursor, decodificarCursor, deAlcance, type Alcance } from './pedidos.repository.js';

// Repositorio de guías de remisión. Recibe la transacción del ejecutor (RLS aísla; el `where` por empresa es defensa en
// profundidad). Alcance «propios»: solo las guías que la persona creó.

export type Guia = typeof ordenesGuias.$inferSelect;
export type GuiaConConteo = Guia & { lineas: number };
export type LineaDeGuia = typeof ordenesGuiaLineas.$inferSelect & { pedidoSerie: string | null; pedidoAnio: number | null; pedidoNumero: number | null };
export type Candidato = {
  id: string;
  serie: string | null;
  anio: number | null;
  numero: number | null;
  estado: string;
  fecha: string;
  entregaEl: string | null;
  lineasPendientes: number;
};

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(ordenesGuias.tenantId, ctx.empresaId);
const deAlcanceDeGuias = (ctx: ContextoDeEmpresa, alcance: Alcance): SQL | undefined =>
  alcance === 'propios' ? eq(ordenesGuias.creadoPor, ctx.usuarioId) : undefined;

const conteo = sql<number>`(select count(*)::int from ordenes.guia_lineas l where l.tenant_id = guias.tenant_id and l.guia_id = guias.id)`;

/** `bloquear` toma primero la fila de la guía con `for update` y después la lee. */
export async function verGuia(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, opciones: { alcance: Alcance; bloquear?: boolean }): Promise<GuiaConConteo | null> {
  const donde = and(deEmpresa(ctx), eq(ordenesGuias.id, id), deAlcanceDeGuias(ctx, opciones.alcance));
  if (opciones.bloquear) {
    const tomada = await tx.select({ id: ordenesGuias.id }).from(ordenesGuias).where(donde).for('update');
    if (tomada.length === 0) return null;
  }
  const [fila] = await tx.select({ ...getTableColumns(ordenesGuias), lineas: conteo }).from(ordenesGuias).where(donde);
  return fila ?? null;
}

export async function lineasDeGuia(tx: Transaccion, ctx: ContextoDeEmpresa, guiaId: string): Promise<LineaDeGuia[]> {
  return tx
    .select({ ...getTableColumns(ordenesGuiaLineas), pedidoSerie: ordenesPedidos.serie, pedidoAnio: ordenesPedidos.anio, pedidoNumero: ordenesPedidos.numero })
    .from(ordenesGuiaLineas)
    .leftJoin(ordenesPedidos, and(eq(ordenesPedidos.tenantId, ordenesGuiaLineas.tenantId), eq(ordenesPedidos.id, ordenesGuiaLineas.pedidoId)))
    .where(and(eq(ordenesGuiaLineas.tenantId, ctx.empresaId), eq(ordenesGuiaLineas.guiaId, guiaId)))
    .orderBy(asc(ordenesGuiaLineas.posicion));
}

/** Los pedidos que cita cada guía, sin repetir y ordenados por código. */
export async function pedidosDeGuias(tx: Transaccion, ctx: ContextoDeEmpresa, guiaIds: readonly string[]): Promise<Map<string, { id: string; codigo: string }[]>> {
  const mapa = new Map<string, { id: string; codigo: string }[]>();
  if (guiaIds.length === 0) return mapa;
  const filas = await tx
    .selectDistinct({ guiaId: ordenesGuiaLineas.guiaId, id: ordenesPedidos.id, serie: ordenesPedidos.serie, anio: ordenesPedidos.anio, numero: ordenesPedidos.numero })
    .from(ordenesGuiaLineas)
    .innerJoin(ordenesPedidos, and(eq(ordenesPedidos.tenantId, ordenesGuiaLineas.tenantId), eq(ordenesPedidos.id, ordenesGuiaLineas.pedidoId)))
    .where(and(eq(ordenesGuiaLineas.tenantId, ctx.empresaId), inArray(ordenesGuiaLineas.guiaId, [...guiaIds])));
  for (const f of filas) {
    const lista = mapa.get(f.guiaId) ?? [];
    lista.push({ id: f.id, codigo: codigoDePedido(f.serie, f.anio, f.numero) });
    mapa.set(f.guiaId, lista);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.codigo.localeCompare(b.codigo));
  return mapa;
}

export type DatosDeGuia = DatosDeTraslado & { serie: string; numero: number; clienteId: string; destinatarioNombre: string; fechaEmision: string };

export async function insertarGuia(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeGuia): Promise<string> {
  const [fila] = await tx.insert(ordenesGuias).values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning({ id: ordenesGuias.id });
  if (!fila) throw new Error('No se pudo guardar la guía.');
  return fila.id;
}

export async function insertarLineasDeGuia(tx: Transaccion, ctx: ContextoDeEmpresa, guiaId: string, lineas: readonly LineaDeGuiaPreparada[]): Promise<void> {
  await tx.insert(ordenesGuiaLineas).values(lineas.map((l) => ({ ...l, tenantId: ctx.empresaId, guiaId })));
}

/** Solo las cuatro columnas de la anulación: la base no admite otro cambio. */
export async function marcarGuiaAnulada(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, motivo: string): Promise<void> {
  const r = await tx
    .update(ordenesGuias)
    .set({ estado: 'anulada', anuladoEn: sql`now()`, anuladoPor: ctx.usuarioId, motivoAnulacion: motivo })
    .where(and(deEmpresa(ctx), eq(ordenesGuias.id, id)))
    .returning({ id: ordenesGuias.id });
  if (r.length !== 1) throw new Error('No se pudo anular la guía.');
}

/** Lo enviado por cada línea de pedido (clave: id de la línea), contando solo guías emitidas. */
export async function cantidadesEnviadas(tx: Transaccion, ctx: ContextoDeEmpresa, pedidoIds: readonly string[]): Promise<Map<string, number>> {
  if (pedidoIds.length === 0) return new Map();
  const filas = await tx
    .select({ lineaId: ordenesGuiaLineas.pedidoLineaId, total: sql<string>`sum(${ordenesGuiaLineas.cantidadMilesimas})::bigint` })
    .from(ordenesGuiaLineas)
    .innerJoin(ordenesGuias, and(eq(ordenesGuias.tenantId, ordenesGuiaLineas.tenantId), eq(ordenesGuias.id, ordenesGuiaLineas.guiaId)))
    .where(and(eq(ordenesGuiaLineas.tenantId, ctx.empresaId), inArray(ordenesGuiaLineas.pedidoId, [...pedidoIds]), eq(ordenesGuias.estado, 'emitida')))
    .groupBy(ordenesGuiaLineas.pedidoLineaId);
  return new Map(filas.flatMap((f) => (f.lineaId ? [[f.lineaId, Number(f.total)] as const] : [])));
}

/** Líneas de pedido por pedido o por id de línea, con el código de su pedido. */
export async function lineasDePedidosParaGuia(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  f: { pedidoIds?: readonly string[]; lineaIds?: readonly string[] },
): Promise<LineaDePedidoParaGuia[]> {
  if (!f.pedidoIds?.length && !f.lineaIds?.length) return [];
  const filas = await tx
    .select({
      id: ordenesPedidoLineas.id,
      pedidoId: ordenesPedidoLineas.pedidoId,
      serie: ordenesPedidos.serie,
      anio: ordenesPedidos.anio,
      numero: ordenesPedidos.numero,
      posicion: ordenesPedidoLineas.posicion,
      productoId: ordenesPedidoLineas.productoId,
      descripcion: ordenesPedidoLineas.descripcion,
      unidad: ordenesPedidoLineas.unidad,
      cantidadMilesimas: ordenesPedidoLineas.cantidadMilesimas,
    })
    .from(ordenesPedidoLineas)
    .innerJoin(ordenesPedidos, and(eq(ordenesPedidos.tenantId, ordenesPedidoLineas.tenantId), eq(ordenesPedidos.id, ordenesPedidoLineas.pedidoId)))
    .where(
      and(
        eq(ordenesPedidoLineas.tenantId, ctx.empresaId),
        f.pedidoIds?.length ? inArray(ordenesPedidoLineas.pedidoId, [...f.pedidoIds]) : undefined,
        f.lineaIds?.length ? inArray(ordenesPedidoLineas.id, [...f.lineaIds]) : undefined,
      ),
    )
    .orderBy(asc(ordenesPedidoLineas.pedidoId), asc(ordenesPedidoLineas.posicion));
  return filas.map(({ serie, anio, numero, ...l }) => ({ ...l, pedidoCodigo: codigoDePedido(serie, anio, numero) }));
}

/** Líneas del pedido con algo todavía sin enviar. Dentro de la subconsulta las tablas se nombran a mano: en un `select` de una sola tabla drizzle no califica las columnas. */
const lineasPendientes = sql<number>`(
  select count(*)::int from ordenes.pedido_lineas l
  where l.tenant_id = pedidos.tenant_id and l.pedido_id = pedidos.id
    and l.cantidad_milesimas > coalesce((
      select sum(gl.cantidad_milesimas)::bigint from ordenes.guia_lineas gl
      join ordenes.guias g on g.tenant_id = gl.tenant_id and g.id = gl.guia_id
      where gl.tenant_id = l.tenant_id and gl.pedido_id = l.pedido_id and gl.pedido_linea_id = l.id and g.estado = 'emitida'
    ), 0)
)`;

/** Pedidos del cliente que se pueden agregar a una guía: listos, o entregados hace poco, con algo pendiente. */
export async function candidatosParaGuia(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  alcance: Alcance,
  f: { clienteId: string; excluir: readonly string[] },
): Promise<Candidato[]> {
  return tx
    .select({
      id: ordenesPedidos.id,
      serie: ordenesPedidos.serie,
      anio: ordenesPedidos.anio,
      numero: ordenesPedidos.numero,
      estado: ordenesPedidos.estado,
      fecha: ordenesPedidos.fecha,
      entregaEl: ordenesPedidos.entregaEl,
      lineasPendientes,
    })
    .from(ordenesPedidos)
    .where(
      and(
        eq(ordenesPedidos.tenantId, ctx.empresaId),
        eq(ordenesPedidos.clienteId, f.clienteId),
        sql`(${ordenesPedidos.estado} = 'listo' or (${ordenesPedidos.estado} = 'entregado' and ${ordenesPedidos.entregadoEn} >= now() - make_interval(days => ${DIAS_DE_CANDIDATOS_ENTREGADOS})))`,
        f.excluir.length ? sql`${ordenesPedidos.id} not in (${sql.join(f.excluir.map((i) => sql`${i}::uuid`), sql`, `)})` : undefined,
        deAlcance(ctx, alcance),
        sql`${lineasPendientes} > 0`,
      ),
    )
    .orderBy(desc(ordenesPedidos.fecha), desc(ordenesPedidos.id))
    .limit(MAXIMO_DE_CANDIDATOS_PARA_GUIA);
}

export type FiltrosDeGuias = { limite: number; cursor?: string; estado: 'todas' | 'emitida' | 'anulada'; clienteId?: string; pedidoId?: string };

export async function listarGuias(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  alcance: Alcance,
  f: FiltrosDeGuias,
): Promise<{ items: GuiaConConteo[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = f.cursor ? decodificarCursor(f.cursor) : null;
  if (f.cursor && !pos) return 'cursor_invalido';
  const filas = await tx
    .select({ ...getTableColumns(ordenesGuias), lineas: conteo, instante: sql<string>`${ordenesGuias.creadoEn}::text` })
    .from(ordenesGuias)
    .where(
      and(
        deEmpresa(ctx),
        deAlcanceDeGuias(ctx, alcance),
        f.estado === 'todas' ? undefined : eq(ordenesGuias.estado, f.estado),
        f.clienteId ? eq(ordenesGuias.clienteId, f.clienteId) : undefined,
        f.pedidoId
          ? sql`exists (select 1 from ordenes.guia_lineas gl where gl.tenant_id = guias.tenant_id and gl.guia_id = guias.id and gl.pedido_id = ${f.pedidoId}::uuid)`
          : undefined,
        pos ? sql`(${ordenesGuias.creadoEn}, ${ordenesGuias.id}) < (${pos.instante}::timestamptz, ${pos.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(ordenesGuias.creadoEn), desc(ordenesGuias.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return {
    items: pagina.map(({ instante: _instante, ...g }) => g),
    siguiente: filas.length > f.limite && ultima ? codificarCursor(ultima.instante, ultima.id) : null,
  };
}

/** Códigos de las guías emitidas (no anuladas) que citan el pedido. */
export async function guiasEmitidasDePedido(tx: Transaccion, ctx: ContextoDeEmpresa, pedidoId: string): Promise<string[]> {
  const filas = await tx
    .selectDistinct({ serie: ordenesGuias.serie, numero: ordenesGuias.numero })
    .from(ordenesGuias)
    .innerJoin(ordenesGuiaLineas, and(eq(ordenesGuiaLineas.tenantId, ordenesGuias.tenantId), eq(ordenesGuiaLineas.guiaId, ordenesGuias.id)))
    .where(and(deEmpresa(ctx), eq(ordenesGuias.estado, 'emitida'), eq(ordenesGuiaLineas.pedidoId, pedidoId)))
    .orderBy(asc(ordenesGuias.serie), asc(ordenesGuias.numero));
  return filas.map((f) => codigoDeGuia(f.serie, f.numero));
}

export type ClienteParaGuia = { id: string; nombre: string; documentoTipo: string | null; documentoNumero: string | null; direccion: string | null; vigente: boolean };

export async function clienteParaGuia(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string): Promise<ClienteParaGuia | null> {
  const [fila] = await tx
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      documentoTipo: clientes.documentoTipo,
      documentoNumero: clientes.documentoNumero,
      direccion: clientes.direccion,
      archivadoEn: clientes.archivadoEn,
      fusionadoEn: clientes.fusionadoEn,
    })
    .from(clientes)
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, clienteId)));
  if (!fila) return null;
  const { archivadoEn, fusionadoEn, ...c } = fila;
  return { ...c, vigente: archivadoEn === null && fusionadoEn === null };
}
