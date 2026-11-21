import { and, desc, eq, ilike, inArray, gte, lte, type SQL } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { comprasOrdenLineas, comprasOrdenes } from '../../../db/esquema/compras.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { MAXIMO_DE_LINEAS_DE_COSTOS, type LineaDeCosto } from '../domain/costos.js';
import type { Alcance } from './compras.repository.js';

// Líneas de órdenes enviadas o recibidas para el comparador de costos. Solo lectura; RLS aísla por empresa.

export type FiltroDeCostos = { desde: string; hasta: string; productoId?: string; proveedorId?: string; buscar?: string };

const l = comprasOrdenLineas;
const o = comprasOrdenes;
const ESTADOS_CON_COSTO = ['enviada', 'recibida_parcial', 'recibida'];
const escaparLike = (t: string): string => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/** De la más antigua a la más nueva. Si hay más de 5,000 se queda con las más recientes y `truncado` es verdadero. */
export async function lineasParaCostos(tx: Transaccion, ctx: ContextoDeEmpresa, alcance: Alcance, f: FiltroDeCostos): Promise<{ lineas: LineaDeCosto[]; truncado: boolean }> {
  const condiciones: Array<SQL | undefined> = [
    eq(o.tenantId, ctx.empresaId),
    inArray(o.estado, ESTADOS_CON_COSTO),
    gte(o.fecha, f.desde),
    lte(o.fecha, f.hasta),
    alcance === 'propios' ? eq(o.creadoPor, ctx.usuarioId) : undefined,
    f.productoId ? eq(l.productoId, f.productoId) : undefined,
    f.proveedorId ? eq(o.proveedorId, f.proveedorId) : undefined,
    f.buscar ? ilike(l.descripcion, `%${escaparLike(f.buscar)}%`) : undefined,
  ];
  const filas = await tx
    .select({ productoId: l.productoId, descripcion: l.descripcion, unidad: l.unidad, costoUnitarioMilesimas: l.costoUnitarioMilesimas, fecha: o.fecha, proveedorId: o.proveedorId, proveedorNombre: clientes.nombre })
    .from(l)
    .innerJoin(o, and(eq(o.tenantId, l.tenantId), eq(o.id, l.ordenId)))
    .innerJoin(clientes, and(eq(clientes.tenantId, o.tenantId), eq(clientes.id, o.proveedorId)))
    .where(and(...condiciones))
    .orderBy(desc(o.fecha), desc(o.creadoEn), desc(l.posicion))
    .limit(MAXIMO_DE_LINEAS_DE_COSTOS + 1);
  const truncado = filas.length > MAXIMO_DE_LINEAS_DE_COSTOS;
  return { lineas: filas.slice(0, MAXIMO_DE_LINEAS_DE_COSTOS).reverse(), truncado };
}
