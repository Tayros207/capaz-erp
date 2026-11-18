import { and, desc, eq, gte, inArray, ne } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { produccionOrdenItems, produccionOrdenes } from '../../../db/esquema/produccion.js';
import { coincideConRaices } from '../../../core/composicion/raices-sql.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Solo SQL: las líneas de órdenes de trabajo no anuladas. Una línea de orden NO tiene producto del catálogo: se busca por
// las raíces de su descripción. No calcula parecidos.

const o = produccionOrdenes;
const i = produccionOrdenItems;

export type FiltroDePrecios = { clienteId?: string; raices?: readonly string[]; desde?: string; limiteDocumentos: number };

export type ItemConOrden = {
  ordenId: string;
  anio: number;
  numero: number;
  estado: string;
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  subtotalCentimos: number;
};

export async function itemsDeOrdenesParaPrecios(tx: Transaccion, ctx: ContextoDeEmpresa, f: FiltroDePrecios): Promise<ItemConOrden[]> {
  const deItem = coincideConRaices(i.descripcion, f.raices);
  const delDocumento = and(
    eq(o.tenantId, ctx.empresaId),
    ne(o.estado, 'anulada'),
    f.clienteId ? eq(o.clienteId, f.clienteId) : undefined,
    f.desde ? gte(o.fecha, f.desde) : undefined,
  );
  const ids = await tx
    .select({ id: o.id })
    .from(o)
    .innerJoin(i, and(eq(i.tenantId, o.tenantId), eq(i.ordenId, o.id)))
    .where(and(delDocumento, deItem))
    .groupBy(o.id)
    .orderBy(desc(o.fecha), desc(o.creadoEn), desc(o.id))
    .limit(f.limiteDocumentos);
  if (ids.length === 0) return [];
  const idsDeOrdenes = ids.map((x) => x.id);
  return tx
    .select({
      ordenId: o.id,
      anio: o.anio,
      numero: o.numero,
      estado: o.estado,
      fecha: o.fecha,
      clienteId: o.clienteId,
      clienteNombre: clientes.nombre,
      descripcion: i.descripcion,
      unidad: i.unidad,
      cantidadMilesimas: i.cantidadMilesimas,
      precioUnitarioMilesimas: i.precioUnitarioMilesimas,
      subtotalCentimos: i.subtotalCentimos,
    })
    .from(i)
    .innerJoin(o, and(eq(o.tenantId, i.tenantId), eq(o.id, i.ordenId)))
    .innerJoin(clientes, and(eq(clientes.tenantId, o.tenantId), eq(clientes.id, o.clienteId)))
    .where(and(eq(i.tenantId, ctx.empresaId), inArray(i.ordenId, idsDeOrdenes), deItem))
    .orderBy(desc(o.fecha), desc(o.creadoEn), desc(o.id), i.posicion);
}
