import { sql } from 'drizzle-orm';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { ExistenciaBajoMinimo } from '../domain/pendientes.js';

// Lectura de «Mi día»: las existencias (artículo en una sucursal) de artículos activos que quedaron por debajo del mínimo,
// la más corta primero. Misma regla que `cifrasDeInsumos` y la pantalla de alertas. Solo lee; la RLS aísla por empresa.

type Fila = { id: string; nombre: string; unidad: string; minimo: string; cantidad: string; sucursal: string };

export async function existenciasBajoMinimo(tx: Transaccion, _ctx: ContextoDeEmpresa, limite: number): Promise<ExistenciaBajoMinimo[]> {
  const r = await tx.execute<Fila>(sql`
    select a.id, p.nombre, a.unidad, a.minimo_milesimas::text as minimo, e.cantidad_milesimas::text as cantidad, s.nombre as sucursal
    from insumos.existencias e
    join insumos.articulos a on a.tenant_id = e.tenant_id and a.id = e.articulo_id
    join core.productos p on p.tenant_id = a.tenant_id and p.id = a.producto_id
    join core.sucursales s on s.tenant_id = e.tenant_id and s.id = e.sucursal_id
    where e.tenant_id = current_setting('app.tenant_id', true) and a.archivado_en is null and a.minimo_milesimas > 0
      and e.cantidad_milesimas < a.minimo_milesimas
    order by e.cantidad_milesimas::numeric / a.minimo_milesimas, p.nombre, s.nombre
    limit ${limite}`);
  return r.rows.map((f) => ({ id: f.id, nombre: f.nombre, unidad: f.unidad, minimoMilesimas: Number(f.minimo), cantidadMilesimas: Number(f.cantidad), sucursal: f.sucursal }));
}
