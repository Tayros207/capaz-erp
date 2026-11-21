import { sql } from 'drizzle-orm';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { CLAVE_DE_CLIENTE_VARIOS } from '../domain/historial.js';
import type { ClienteConHistorial } from '../domain/recompra.js';

// Lectura del aviso de recompra («Mi día»). Solo lee; la RLS aísla por empresa. Es un dato de toda la empresa: quien lo
// llama decide si la persona tiene alcance «todos».

type Fila = { cliente_id: string; nombre: string; telefono: string | null; fechas: string[]; venta: string };

/**
 * Clientes con al menos 6 días distintos de compra entre hoy−730 y hoy (pedidos confirmados, en proceso, listos o
 * entregados), con sus fechas y su venta de los últimos 365 días. Se excluyen clientes archivados o fusionados y los que
 * ya tienen un pedido en borrador creado en los últimos 30 días (ya se les está atendiendo). Tampoco el comodín «Clientes varios
 * (historial)»: no es una persona a quien llamar.
 */
export async function clientesConHistorial(tx: Transaccion, hoy: string): Promise<ClienteConHistorial[]> {
  const r = await tx.execute<Fila>(sql`
    select c.id as cliente_id, c.nombre, c.telefono,
           array_agg(distinct p.fecha::text order by p.fecha::text) as fechas,
           coalesce(sum(p.total_centimos) filter (where p.fecha >= ${hoy}::date - 365), 0)::text as venta
    from ordenes.pedidos p
    join core.clientes c on c.tenant_id = p.tenant_id and c.id = p.cliente_id
    where p.tenant_id = current_setting('app.tenant_id', true)
      and p.estado in ('confirmado', 'en_proceso', 'listo', 'entregado')
      and p.fecha between ${hoy}::date - 730 and ${hoy}::date
      and c.archivado_en is null and c.fusionado_en is null
      and c.nombre_normalizado <> ${CLAVE_DE_CLIENTE_VARIOS}
      and not exists (
        select 1 from ordenes.pedidos b
        where b.tenant_id = p.tenant_id and b.cliente_id = p.cliente_id and b.estado = 'borrador'
          and b.creado_en >= (${hoy}::date - 30)::timestamptz)
    group by c.id, c.nombre, c.telefono
    having count(distinct p.fecha) >= 6`);
  return r.rows.map((f) => ({ clienteId: f.cliente_id, clienteNombre: f.nombre, clienteTelefono: f.telefono, fechasDeCompra: f.fechas, ventaDe12MesesCentimos: Number(f.venta) }));
}

/** La razón social con la que se firma el mensaje; `null` si no se ha escrito. */
export async function nombreDeLaEmpresa(tx: Transaccion): Promise<string | null> {
  const r = await tx.execute<{ razon_social: string | null }>(sql`select razon_social from core.empresa_config limit 1`);
  return r.rows[0]?.razon_social?.trim() || null;
}
