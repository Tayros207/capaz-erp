import { and, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { cotizadorCotizaciones, cotizadorVersionLineas, cotizadorVersiones } from '../../../db/esquema/cotizador.js';
import { coincideConRaices } from '../../../core/composicion/raices-sql.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { Alcance } from './cotizaciones.repository.js';

// Solo SQL: las líneas de la versión VIGENTE ya emitida de cotizaciones emitidas, enviadas, aceptadas o rechazadas.
// En una cotización aceptada solo cuentan las líneas que el cliente aceptó. No calcula parecidos.

const c = cotizadorCotizaciones;
const v = cotizadorVersiones;
const l = cotizadorVersionLineas;

export const ESTADOS_QUE_ENTRAN = ['emitida', 'enviada', 'aceptada', 'rechazada'] as const;

export type FiltroDePrecios = { clienteId?: string; productoId?: string; raices?: readonly string[]; desde?: string; limiteDocumentos: number };

export type LineaConCotizacion = {
  cotizacionId: string;
  numero: number | null;
  anio: number | null;
  version: number;
  estado: string;
  /** Día local de la emisión de la versión. */
  fecha: string;
  igvPorcentaje: number;
  clienteId: string;
  clienteNombre: string;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  totalCentimos: number;
};

export async function lineasDeCotizacionesParaPrecios(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  alcance: Alcance,
  zona: string,
  f: FiltroDePrecios,
): Promise<LineaConCotizacion[]> {
  const deLinea = or(f.productoId ? eq(l.productoId, f.productoId) : undefined, coincideConRaices(l.descripcion, f.raices));
  // Una aceptada guarda las posiciones que el cliente aceptó (`lineas_aceptadas`); sin lista, entran todas.
  const aceptadas: SQL = sql`(${c.estado} <> 'aceptada' or ${c.lineasAceptadas} is null or jsonb_array_length(${c.lineasAceptadas}) = 0 or ${c.lineasAceptadas} @> to_jsonb(${l.posicion}))`;
  const dia = sql<string>`to_char(${v.emitidaEn} at time zone ${zona}, 'YYYY-MM-DD')`;
  const delDocumento = and(
    eq(c.tenantId, ctx.empresaId),
    inArray(c.estado, [...ESTADOS_QUE_ENTRAN]),
    sql`${v.emitidaEn} is not null`,
    f.clienteId ? eq(c.clienteId, f.clienteId) : undefined,
    f.desde ? sql`(${v.emitidaEn} at time zone ${zona})::date >= ${f.desde}::date` : undefined,
    alcance === 'propios' ? eq(c.creadoPor, ctx.usuarioId) : undefined,
  );
  const lineaConVersion = and(eq(l.tenantId, v.tenantId), eq(l.versionId, v.id));
  const versionVigente = and(eq(v.tenantId, c.tenantId), eq(v.cotizacionId, c.id), eq(v.version, c.versionActual));
  const ids = await tx
    .select({ id: c.id })
    .from(c)
    .innerJoin(v, versionVigente)
    .innerJoin(l, lineaConVersion)
    .where(and(delDocumento, deLinea, aceptadas))
    .groupBy(c.id, v.emitidaEn)
    .orderBy(desc(v.emitidaEn), desc(c.id))
    .limit(f.limiteDocumentos);
  if (ids.length === 0) return [];
  return tx
    .select({
      cotizacionId: c.id,
      numero: c.numero,
      anio: c.anio,
      version: v.version,
      estado: c.estado,
      fecha: dia,
      igvPorcentaje: v.igvPorcentaje,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      productoId: l.productoId,
      descripcion: l.descripcion,
      unidad: l.unidad,
      cantidadMilesimas: l.cantidadMilesimas,
      precioUnitarioMilesimas: l.precioUnitarioMilesimas,
      totalCentimos: l.totalCentimos,
    })
    .from(c)
    .innerJoin(v, versionVigente)
    .innerJoin(l, lineaConVersion)
    .innerJoin(clientes, and(eq(clientes.tenantId, c.tenantId), eq(clientes.id, c.clienteId)))
    .where(and(eq(c.tenantId, ctx.empresaId), inArray(c.id, ids.map((i) => i.id)), deLinea, aceptadas))
    .orderBy(desc(v.emitidaEn), desc(c.id), l.posicion);
}
