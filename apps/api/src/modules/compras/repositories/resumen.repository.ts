import { sql } from 'drizzle-orm';
import { ESTADOS_DE_COMPRA, type EstadoDeCompra } from '@capaz/shared';
import type { Transaccion } from '../../../infra/database/con-empresa.js';

// Cifras de compras y candidatos de la fuente de tiempo. Solo lectura; la RLS de la transacción aísla por empresa.

export type ResumenDeOrdenesDeCompra = {
  porEstado: Array<{ estado: EstadoDeCompra; cantidad: number; totalCentimos: number }>;
  compradas: number;
  totalCompradoCentimos: number;
  recepciones: number;
  recibidoCentimos: number;
  porRecibir: number;
  atrasadas: number;
};

type Periodo = { desde: string; hasta: string; hoy: string };

/**
 * `porEstado`, `compradas` y `totalCompradoCentimos`: órdenes con `fecha` en el período (compradas =
 * enviadas o recibidas, en parte o del todo). `recepciones` y `recibidoCentimos`: recepciones con fecha en
 * el período; el valor es Σ importe(cantidad, costo) por línea, al céntimo y mitad hacia arriba (como
 * `importe`). `porRecibir` y `atrasadas` son de hoy, no del período.
 */
export async function resumenDeCompras(tx: Transaccion, p: Periodo): Promise<ResumenDeOrdenesDeCompra> {
  const grupos = await tx.execute<{ estado: EstadoDeCompra; cantidad: number; total: string }>(
    sql`select estado, count(*)::int as cantidad, coalesce(sum(total_centimos), 0)::text as total
        from compras.ordenes where tenant_id = current_setting('app.tenant_id', true) and fecha between ${p.desde}::date and ${p.hasta}::date
        group by estado`,
  );
  const cifras = await tx.execute<{ compradas: number; total_comprado: string; por_recibir: number; atrasadas: number }>(
    sql`select
          count(*) filter (where estado in ('enviada', 'recibida_parcial', 'recibida') and fecha between ${p.desde}::date and ${p.hasta}::date)::int as compradas,
          coalesce(sum(total_centimos) filter (where estado in ('enviada', 'recibida_parcial', 'recibida') and fecha between ${p.desde}::date and ${p.hasta}::date), 0)::text as total_comprado,
          count(*) filter (where estado in ('enviada', 'recibida_parcial'))::int as por_recibir,
          count(*) filter (where estado in ('enviada', 'recibida_parcial') and entrega_el < ${p.hoy}::date)::int as atrasadas
        from compras.ordenes where tenant_id = current_setting('app.tenant_id', true)`,
  );
  const recibido = await tx.execute<{ recepciones: number; recibido: string }>(
    sql`select count(distinct r.id)::int as recepciones,
          coalesce(sum(floor((2::numeric * rl.cantidad_milesimas * l.costo_unitario_milesimas + 10000) / 20000)), 0)::text as recibido
        from compras.recepciones r
        join compras.recepcion_lineas rl on rl.tenant_id = r.tenant_id and rl.recepcion_id = r.id
        join compras.orden_lineas l on l.tenant_id = rl.tenant_id and l.id = rl.orden_linea_id
        where r.tenant_id = current_setting('app.tenant_id', true) and r.fecha between ${p.desde}::date and ${p.hasta}::date`,
  );
  const porEstado = new Map(grupos.rows.map((g) => [g.estado, g]));
  const c = cifras.rows[0]!;
  const r = recibido.rows[0]!;
  return {
    porEstado: ESTADOS_DE_COMPRA.map((estado) => ({ estado, cantidad: porEstado.get(estado)?.cantidad ?? 0, totalCentimos: Number(porEstado.get(estado)?.total ?? 0) })),
    compradas: c.compradas,
    totalCompradoCentimos: Number(c.total_comprado),
    recepciones: r.recepciones,
    recibidoCentimos: Number(r.recibido),
    porRecibir: c.por_recibir,
    atrasadas: c.atrasadas,
  };
}

export type CompraConEntrega = { id: string; serie: string; anio: number; numero: number; proveedor_id: string; estado: string; total_centimos: string; entrega_el: string };

/** Órdenes por recibir con fecha de entrega: los candidatos de `compras.entrega_vence`. */
export async function comprasConEntrega(tx: Transaccion): Promise<CompraConEntrega[]> {
  const r = await tx.execute<CompraConEntrega>(
    sql`select id, serie, anio, numero, proveedor_id, estado, total_centimos::text as total_centimos, entrega_el::text as entrega_el
        from compras.ordenes
        where tenant_id = current_setting('app.tenant_id', true) and estado in ('enviada', 'recibida_parcial') and entrega_el is not null`,
  );
  return r.rows;
}
