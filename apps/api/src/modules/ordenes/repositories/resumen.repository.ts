import { sql } from 'drizzle-orm';
import { ESTADOS_DE_PEDIDO, type EstadoDePedido } from '@capaz/shared';
import type { Transaccion } from '../../../infra/database/con-empresa.js';

// Cifras de pedidos y candidatos de la fuente de tiempo. Solo lectura; la RLS de la transacción aísla por empresa.

export type ResumenDePedidos = {
  porEstado: Array<{ estado: EstadoDePedido; cantidad: number; totalCentimos: number }>;
  confirmados: number;
  totalConfirmadoCentimos: number;
  entregados: number;
  atrasados: number;
  entregasDeHoy: number;
};

type Periodo = { desde: string; hasta: string; hoy: string; zona: string };

/**
 * `porEstado`: pedidos con `fecha` dentro del período, por su estado actual. `confirmados` y
 * `entregados`: por el día local (zona de la empresa) en que se confirmaron o entregaron; un pedido
 * confirmado y luego cancelado no cuenta. `atrasados` y `entregasDeHoy` son de hoy, no del período.
 */
export async function resumenDePedidos(tx: Transaccion, p: Periodo): Promise<ResumenDePedidos> {
  const grupos = await tx.execute<{ estado: EstadoDePedido; cantidad: number; total: string }>(
    sql`select estado, count(*)::int as cantidad, coalesce(sum(total_centimos), 0)::text as total
        from ordenes.pedidos where tenant_id = current_setting('app.tenant_id', true) and fecha between ${p.desde}::date and ${p.hasta}::date
        group by estado`,
  );
  const cifras = await tx.execute<{ confirmados: number; total_confirmado: string; entregados: number; atrasados: number; entregas_de_hoy: number }>(
    sql`select
          count(*) filter (where estado <> 'cancelado' and (confirmado_en at time zone ${p.zona})::date between ${p.desde}::date and ${p.hasta}::date)::int as confirmados,
          coalesce(sum(total_centimos) filter (where estado <> 'cancelado' and (confirmado_en at time zone ${p.zona})::date between ${p.desde}::date and ${p.hasta}::date), 0)::text as total_confirmado,
          count(*) filter (where estado = 'entregado' and (entregado_en at time zone ${p.zona})::date between ${p.desde}::date and ${p.hasta}::date)::int as entregados,
          count(*) filter (where estado in ('confirmado', 'en_proceso', 'listo') and entrega_el < ${p.hoy}::date)::int as atrasados,
          count(*) filter (where estado in ('confirmado', 'en_proceso', 'listo') and entrega_el = ${p.hoy}::date)::int as entregas_de_hoy
        from ordenes.pedidos where tenant_id = current_setting('app.tenant_id', true)`,
  );
  const porEstado = new Map(grupos.rows.map((g) => [g.estado, g]));
  const c = cifras.rows[0]!;
  return {
    porEstado: ESTADOS_DE_PEDIDO.map((estado) => ({ estado, cantidad: porEstado.get(estado)?.cantidad ?? 0, totalCentimos: Number(porEstado.get(estado)?.total ?? 0) })),
    confirmados: c.confirmados,
    totalConfirmadoCentimos: Number(c.total_confirmado),
    entregados: c.entregados,
    atrasados: c.atrasados,
    entregasDeHoy: c.entregas_de_hoy,
  };
}

export type PedidoConEntrega = { id: string; serie: string; anio: number; numero: number; cliente_id: string; estado: string; total_centimos: string; entrega_el: string };

/** Pedidos en curso con fecha de entrega: los candidatos de `ordenes.entrega_vence`. */
export async function pedidosConEntrega(tx: Transaccion): Promise<PedidoConEntrega[]> {
  const r = await tx.execute<PedidoConEntrega>(
    sql`select id, serie, anio, numero, cliente_id, estado, total_centimos::text as total_centimos, entrega_el::text as entrega_el
        from ordenes.pedidos
        where tenant_id = current_setting('app.tenant_id', true) and estado in ('confirmado', 'en_proceso', 'listo') and entrega_el is not null`,
  );
  return r.rows;
}
