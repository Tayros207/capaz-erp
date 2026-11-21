import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { DetalleDeEventoDePedido, FotoDeVersionDto, MotivoDeCorreccion, VersionDePedidoDto } from '@capaz/shared';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { ordenesGuiaLineas, ordenesGuias, ordenesPedidoEventos, ordenesPedidoLineas, ordenesPedidoVersiones, ordenesPedidos } from '../../../db/esquema/ordenes.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codigoDeGuia } from '../domain/guia.js';
import type { LineaResultante } from '../domain/correccion.js';
import { fotoConFicha } from '../domain/ficha.js';
import { codificarCursor, decodificarCursor, deAlcance, nombresDeMiembros, type Alcance } from './pedidos.repository.js';

// Repositorio de «Corregir pedido»: guías por línea, versiones (fotos inmutables), aplicación de líneas en el sitio y la lista de correcciones.

/** Códigos de las guías (de cualquier estado: la llave foránea las conserva) que citan cada línea del pedido. */
export async function guiasPorLinea(tx: Transaccion, ctx: ContextoDeEmpresa, pedidoId: string): Promise<Map<string, string[]>> {
  const filas = await tx
    .select({ lineaId: ordenesGuiaLineas.pedidoLineaId, serie: ordenesGuias.serie, numero: ordenesGuias.numero })
    .from(ordenesGuiaLineas)
    .innerJoin(ordenesGuias, and(eq(ordenesGuias.tenantId, ordenesGuiaLineas.tenantId), eq(ordenesGuias.id, ordenesGuiaLineas.guiaId)))
    .where(and(eq(ordenesGuiaLineas.tenantId, ctx.empresaId), eq(ordenesGuiaLineas.pedidoId, pedidoId)))
    .orderBy(asc(ordenesGuias.serie), asc(ordenesGuias.numero));
  const mapa = new Map<string, string[]>();
  for (const f of filas) {
    if (!f.lineaId) continue;
    const codigo = codigoDeGuia(f.serie, f.numero);
    const lista = mapa.get(f.lineaId) ?? [];
    if (!lista.includes(codigo)) lista.push(codigo);
    mapa.set(f.lineaId, lista);
  }
  return mapa;
}

export async function guardarVersion(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  v: { pedidoId: string; version: number; foto: FotoDeVersionDto; motivoCodigo: MotivoDeCorreccion; motivoTexto: string | null },
): Promise<void> {
  await tx.insert(ordenesPedidoVersiones).values({ ...v, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId });
}

/** Las versiones anteriores del pedido, de la más reciente a la más antigua. */
export async function versionesDe(tx: Transaccion, ctx: ContextoDeEmpresa, pedidoId: string): Promise<VersionDePedidoDto[]> {
  const filas = await tx
    .select()
    .from(ordenesPedidoVersiones)
    .where(and(eq(ordenesPedidoVersiones.tenantId, ctx.empresaId), eq(ordenesPedidoVersiones.pedidoId, pedidoId)))
    .orderBy(desc(ordenesPedidoVersiones.version));
  if (filas.length === 0) return [];
  const nombres = await nombresDeMiembros(tx, [...new Set(filas.map((f) => f.creadoPor))]);
  return filas.map((f) => ({
    version: f.version,
    motivoCodigo: f.motivoCodigo as MotivoDeCorreccion,
    motivoTexto: f.motivoTexto,
    creadoPor: f.creadoPor,
    creadoPorNombre: nombres.get(f.creadoPor) ?? null,
    creadoEn: f.creadoEn.toISOString(),
    foto: fotoConFicha(f.foto as FotoDeVersionDto),
  }));
}

const DESPLAZAMIENTO = 1_000_000;

/**
 * Deja las líneas como pide la corrección SIN reemplazarlas: quita las que no están (la llave de las guías impide borrar las
 * citadas, y ya se comprobó), actualiza en el sitio las conservadas por `id` y agrega las nuevas. La posición es el orden recibido.
 */
export async function aplicarLineas(tx: Transaccion, ctx: ContextoDeEmpresa, pedidoId: string, quitadas: readonly string[], lineas: readonly LineaResultante[]): Promise<string[]> {
  const deLaEmpresa = and(eq(ordenesPedidoLineas.tenantId, ctx.empresaId), eq(ordenesPedidoLineas.pedidoId, pedidoId));
  if (quitadas.length > 0) await tx.delete(ordenesPedidoLineas).where(and(deLaEmpresa, inArray(ordenesPedidoLineas.id, [...quitadas])));
  // Las posiciones son únicas por pedido: se apartan antes de reasignarlas para que reordenar no choque consigo mismo.
  await tx.update(ordenesPedidoLineas).set({ posicion: sql`${ordenesPedidoLineas.posicion} + ${DESPLAZAMIENTO}` }).where(deLaEmpresa);
  const ids: string[] = [];
  for (const l of lineas) {
    const { id, ...campos } = l;
    if (id) {
      const r = await tx.update(ordenesPedidoLineas).set(campos).where(and(deLaEmpresa, eq(ordenesPedidoLineas.id, id))).returning({ id: ordenesPedidoLineas.id });
      if (r.length !== 1) throw new Error('No se pudo actualizar una línea del pedido.');
      ids.push(id);
    } else {
      const [n] = await tx.insert(ordenesPedidoLineas).values({ ...campos, tenantId: ctx.empresaId, pedidoId }).returning({ id: ordenesPedidoLineas.id });
      if (!n) throw new Error('No se pudo agregar una línea al pedido.');
      ids.push(n.id);
    }
  }
  return ids;
}

export type FiltrosDeCorrecciones = { limite: number; cursor?: string; desde?: string; hasta?: string; usuarioId?: string; pedidoId?: string; zona: string };
export type CorreccionLeida = {
  eventoId: string;
  pedidoId: string;
  serie: string | null;
  anio: number | null;
  numero: number | null;
  clienteNombre: string;
  usuarioId: string;
  usuarioNombre: string | null;
  creadoEn: Date;
  detalle: DetalleDeEventoDePedido;
};

/** Correcciones (eventos `corregido`), de la más reciente a la más antigua. `usuarioId` fuerza «solo las de esa persona». */
export async function listarCorrecciones(tx: Transaccion, ctx: ContextoDeEmpresa, alcance: Alcance, f: FiltrosDeCorrecciones): Promise<{ items: CorreccionLeida[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = f.cursor ? decodificarCursor(f.cursor) : null;
  if (f.cursor && !pos) return 'cursor_invalido';
  const e = ordenesPedidoEventos;
  const dia = sql`(${e.creadoEn} at time zone ${f.zona})::date`;
  const donde: (SQL | undefined)[] = [
    eq(e.tenantId, ctx.empresaId),
    eq(e.tipo, 'corregido'),
    deAlcance(ctx, alcance),
    f.usuarioId ? eq(e.usuarioId, f.usuarioId) : undefined,
    f.pedidoId ? eq(e.pedidoId, f.pedidoId) : undefined,
    f.desde ? sql`${dia} >= ${f.desde}::date` : undefined,
    f.hasta ? sql`${dia} <= ${f.hasta}::date` : undefined,
    pos ? sql`(${e.creadoEn}, ${e.id}) < (${pos.instante}::timestamptz, ${pos.id}::uuid)` : undefined,
  ];
  const filas = await tx
    .select({
      eventoId: e.id,
      pedidoId: e.pedidoId,
      serie: ordenesPedidos.serie,
      anio: ordenesPedidos.anio,
      numero: ordenesPedidos.numero,
      clienteNombre: clientes.nombre,
      usuarioId: e.usuarioId,
      creadoEn: e.creadoEn,
      detalle: e.detalle,
      instante: sql<string>`${e.creadoEn}::text`,
    })
    .from(e)
    .innerJoin(ordenesPedidos, and(eq(ordenesPedidos.tenantId, e.tenantId), eq(ordenesPedidos.id, e.pedidoId)))
    .innerJoin(clientes, and(eq(clientes.tenantId, ordenesPedidos.tenantId), eq(clientes.id, ordenesPedidos.clienteId)))
    .where(and(...donde))
    .orderBy(desc(e.creadoEn), desc(e.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  const nombres = await nombresDeMiembros(tx, [...new Set(pagina.map((p) => p.usuarioId))]);
  return {
    items: pagina.map(({ instante: _i, detalle, ...p }) => ({ ...p, usuarioNombre: nombres.get(p.usuarioId) ?? null, detalle: detalle as DetalleDeEventoDePedido })),
    siguiente: filas.length > f.limite && ultima ? codificarCursor(ultima.instante, ultima.eventoId) : null,
  };
}

export async function nombreDeCliente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<string | null> {
  const [f] = await tx.select({ nombre: clientes.nombre }).from(clientes).where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, id)));
  return f?.nombre ?? null;
}
