import { and, desc, eq, gte, inArray, or, type SQL } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { ordenesPedidoLineas, ordenesPedidos } from '../../../db/esquema/ordenes.js';
import { coincideConRaices } from '../../../core/composicion/raices-sql.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { Alcance } from './pedidos.repository.js';

// Solo SQL: las líneas de pedidos ya confirmados (de «confirmado» en adelante) que pudieron ser lo que se busca.
// No calcula parecidos: eso es del núcleo. `limiteDocumentos` cuenta pedidos, no líneas.

const p = ordenesPedidos;
const l = ordenesPedidoLineas;

export const ESTADOS_QUE_ENTRAN = ['confirmado', 'en_proceso', 'listo', 'entregado'] as const;

export type FiltroDePrecios = { clienteId?: string; productoId?: string; raices?: readonly string[]; desde?: string; limiteDocumentos: number };

export type LineaConPedido = {
  pedidoId: string;
  serie: string | null;
  anio: number | null;
  numero: number | null;
  estado: string;
  fecha: string;
  igvPorcentaje: number;
  origenTipo: string | null;
  origenId: string | null;
  clienteId: string;
  clienteNombre: string;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  afectoIgv: boolean;
  importeCentimos: number;
};

/** Producto exacto o descripción con alguna de las raíces; sin ninguno de los dos, todas las líneas del cliente. */
function filtroDeLinea(f: FiltroDePrecios): SQL | undefined {
  const porProducto = f.productoId ? eq(l.productoId, f.productoId) : undefined;
  const porTexto = coincideConRaices(l.descripcion, f.raices);
  return or(porProducto, porTexto);
}

export async function lineasDePedidosParaPrecios(tx: Transaccion, ctx: ContextoDeEmpresa, alcance: Alcance, f: FiltroDePrecios): Promise<LineaConPedido[]> {
  const deLinea = filtroDeLinea(f);
  const delPedido = and(
    eq(p.tenantId, ctx.empresaId),
    inArray(p.estado, [...ESTADOS_QUE_ENTRAN]),
    f.clienteId ? eq(p.clienteId, f.clienteId) : undefined,
    f.desde ? gte(p.fecha, f.desde) : undefined,
    alcance === 'propios' ? or(eq(p.creadoPor, ctx.usuarioId), eq(p.responsableId, ctx.usuarioId)) : undefined,
  );
  const ids = await tx
    .select({ id: p.id })
    .from(p)
    .innerJoin(l, and(eq(l.tenantId, p.tenantId), eq(l.pedidoId, p.id)))
    .where(and(delPedido, deLinea))
    .groupBy(p.id)
    .orderBy(desc(p.fecha), desc(p.creadoEn), desc(p.id))
    .limit(f.limiteDocumentos);
  if (ids.length === 0) return [];
  return tx
    .select({
      pedidoId: p.id,
      serie: p.serie,
      anio: p.anio,
      numero: p.numero,
      estado: p.estado,
      fecha: p.fecha,
      igvPorcentaje: p.igvPorcentaje,
      origenTipo: p.origenTipo,
      origenId: p.origenId,
      clienteId: p.clienteId,
      clienteNombre: clientes.nombre,
      productoId: l.productoId,
      descripcion: l.descripcion,
      unidad: l.unidad,
      cantidadMilesimas: l.cantidadMilesimas,
      precioUnitarioMilesimas: l.precioUnitarioMilesimas,
      afectoIgv: l.afectoIgv,
      importeCentimos: l.importeCentimos,
    })
    .from(l)
    .innerJoin(p, and(eq(p.tenantId, l.tenantId), eq(p.id, l.pedidoId)))
    .innerJoin(clientes, and(eq(clientes.tenantId, p.tenantId), eq(clientes.id, p.clienteId)))
    .where(and(eq(l.tenantId, ctx.empresaId), inArray(l.pedidoId, ids.map((i) => i.id)), deLinea))
    .orderBy(desc(p.fecha), desc(p.creadoEn), desc(p.id), l.posicion);
}
