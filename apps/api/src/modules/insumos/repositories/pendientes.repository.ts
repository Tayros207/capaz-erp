import { sql } from 'drizzle-orm';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { ArticuloBajoMinimo } from '../domain/pendientes.js';

// Lectura de «Mi día»: artículos activos con mínimo cuya existencia (sumadas las sucursales) quedó por debajo. Solo lee.

type Fila = { id: string; nombre: string; unidad: string; minimo: string; cantidad: string };

export async function articulosBajoMinimo(tx: Transaccion, _ctx: ContextoDeEmpresa, limite: number): Promise<ArticuloBajoMinimo[]> {
  const r = await tx.execute<Fila>(sql`
    select a.id, p.nombre, a.unidad, a.minimo_milesimas::text as minimo, coalesce(sum(e.cantidad_milesimas), 0)::text as cantidad
    from insumos.articulos a
    join core.productos p on p.tenant_id = a.tenant_id and p.id = a.producto_id
    left join insumos.existencias e on e.tenant_id = a.tenant_id and e.articulo_id = a.id
    where a.tenant_id = current_setting('app.tenant_id', true) and a.archivado_en is null and a.minimo_milesimas > 0
    group by a.id, p.nombre
    having coalesce(sum(e.cantidad_milesimas), 0) < a.minimo_milesimas
    order by coalesce(sum(e.cantidad_milesimas), 0)::numeric / a.minimo_milesimas, p.nombre
    limit ${limite}`);
  return r.rows.map((f) => ({ id: f.id, nombre: f.nombre, unidad: f.unidad, minimoMilesimas: Number(f.minimo), cantidadMilesimas: Number(f.cantidad) }));
}
