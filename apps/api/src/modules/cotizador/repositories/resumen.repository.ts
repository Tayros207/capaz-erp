import { sql } from 'drizzle-orm';
import type { EstadoDeCotizacion } from '../domain/estados.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Cifras del período para `cotizador_resumen`. Los días son los de la zona de la empresa. Sin costos ni márgenes.

export type ResumenDeCotizaciones = {
  porEstado: { estado: EstadoDeCotizacion; cantidad: number; totalCentimos: number }[];
  aceptadas: { cantidad: number; totalCentimos: number };
  vencidas: number;
};

export async function resumenDeCotizaciones(tx: Transaccion, ctx: ContextoDeEmpresa, p: { desde: string; hasta: string; hoy: string; zona: string }): Promise<ResumenDeCotizaciones> {
  const creadas = await tx.execute<{ estado: string; cantidad: number; total: string }>(sql`
    select c.estado, count(*)::int as cantidad, coalesce(sum(v.total_centimos), 0)::text as total
    from cotizador.cotizaciones c
    join cotizador.versiones v on v.tenant_id = c.tenant_id and v.cotizacion_id = c.id and v.version = c.version_actual
    where c.tenant_id = ${ctx.empresaId}
      and (c.creado_en at time zone ${p.zona})::date between ${p.desde}::date and ${p.hasta}::date
    group by c.estado order by c.estado`);
  const aceptadas = await tx.execute<{ cantidad: number; total: string }>(sql`
    select count(*)::int as cantidad, coalesce(sum(total_aceptado_centimos), 0)::text as total
    from cotizador.cotizaciones
    where tenant_id = ${ctx.empresaId} and estado = 'aceptada'
      and (aceptada_en at time zone ${p.zona})::date between ${p.desde}::date and ${p.hasta}::date`);
  const vencidas = await tx.execute<{ n: number }>(sql`
    select count(*)::int as n from cotizador.cotizaciones
    where tenant_id = ${ctx.empresaId} and estado in ('emitida', 'enviada') and valida_hasta < ${p.hoy}::date`);
  return {
    porEstado: creadas.rows.map((r) => ({ estado: r.estado as EstadoDeCotizacion, cantidad: r.cantidad, totalCentimos: Number(r.total) })),
    aceptadas: { cantidad: aceptadas.rows[0]?.cantidad ?? 0, totalCentimos: Number(aceptadas.rows[0]?.total ?? 0) },
    vencidas: vencidas.rows[0]?.n ?? 0,
  };
}
