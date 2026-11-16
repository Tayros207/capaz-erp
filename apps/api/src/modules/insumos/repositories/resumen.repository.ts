import { sql } from 'drizzle-orm';
import type { Transaccion } from '../../../infra/database/con-empresa.js';

// Cifras del inventario para `insumos_resumen` (y, por él, para Reportes). Solo lectura; la RLS de la transacción
// aísla por empresa y el `where` por `app.tenant_id` es defensa en profundidad.

export type CifrasDeInsumos = {
  articulos: number;
  articulosBajoMinimo: number;
  existenciasBajoMinimo: number;
  entradas: number;
  salidas: number;
  ajustes: number;
};

type Periodo = { desde: string; hasta: string; zona: string };

/**
 * `articulos` y los «bajo mínimo» son de ahora (solo artículos activos). Entradas, salidas y ajustes: cuántos
 * movimientos de cada tipo se registraron en el período, por el día local de la empresa.
 */
export async function cifrasDeInsumos(tx: Transaccion, p: Periodo): Promise<CifrasDeInsumos> {
  const r = await tx.execute<{ articulos: number; articulos_bajo: number; existencias_bajo: number; entradas: number; salidas: number; ajustes: number }>(sql`
    with existencias_bajo as (
      select e.articulo_id from insumos.existencias e
        join insumos.articulos a on a.tenant_id = e.tenant_id and a.id = e.articulo_id
       where e.tenant_id = current_setting('app.tenant_id', true) and a.archivado_en is null and e.cantidad_milesimas < a.minimo_milesimas
    ), movimientos as (
      select tipo, count(*)::int as cantidad from insumos.movimientos
       where tenant_id = current_setting('app.tenant_id', true)
         and (creado_en at time zone ${p.zona})::date between ${p.desde}::date and ${p.hasta}::date
       group by tipo
    )
    select
      (select count(*)::int from insumos.articulos where tenant_id = current_setting('app.tenant_id', true) and archivado_en is null) as articulos,
      (select count(distinct articulo_id)::int from existencias_bajo) as articulos_bajo,
      (select count(*)::int from existencias_bajo) as existencias_bajo,
      coalesce((select cantidad from movimientos where tipo = 'entrada'), 0) as entradas,
      coalesce((select cantidad from movimientos where tipo = 'salida'), 0) as salidas,
      coalesce((select cantidad from movimientos where tipo = 'ajuste'), 0) as ajustes`);
  const c = r.rows[0]!;
  return {
    articulos: c.articulos,
    articulosBajoMinimo: c.articulos_bajo,
    existenciasBajoMinimo: c.existencias_bajo,
    entradas: c.entradas,
    salidas: c.salidas,
    ajustes: c.ajustes,
  };
}
