import { sql } from 'drizzle-orm';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { PedidoEnCurso } from '../domain/pendientes.js';
import type { Alcance } from './pedidos.repository.js';

// Lectura de «Mi día»: los pedidos en curso (confirmados, en proceso o listos) con su cliente. Solo lee; la RLS aísla por
// empresa y con alcance «propios» salen los que la persona creó o tiene a cargo.

type Fila = {
  id: string; serie: string | null; anio: number | null; numero: number | null; estado: PedidoEnCurso['estado'];
  entrega_el: string | null; total: string; confirmado_dia: string | null; cliente_id: string; cliente_nombre: string; cliente_telefono: string | null;
};

const TOPE = 500;

/**
 * `hoy` ordena la lectura: con más pedidos en curso que el tope, primero entran los que se entregan hoy o mañana, luego los
 * atrasados (el más antiguo primero) y al final los demás. Así lo de hoy nunca queda fuera por tener muchos atrasados.
 */
export async function pedidosEnCurso(tx: Transaccion, ctx: ContextoDeEmpresa, alcance: Alcance, zona: string, hoy: string): Promise<PedidoEnCurso[]> {
  const propios = alcance === 'propios' ? sql`and (p.creado_por = ${ctx.usuarioId} or p.responsable_id = ${ctx.usuarioId})` : sql``;
  const r = await tx.execute<Fila>(sql`
    select p.id, p.serie, p.anio, p.numero, p.estado, p.entrega_el::text as entrega_el, p.total_centimos::text as total,
           (p.confirmado_en at time zone ${zona})::date::text as confirmado_dia,
           c.id as cliente_id, c.nombre as cliente_nombre, c.telefono as cliente_telefono
    from ordenes.pedidos p
    join core.clientes c on c.tenant_id = p.tenant_id and c.id = p.cliente_id
    where p.tenant_id = current_setting('app.tenant_id', true) and p.estado in ('confirmado', 'en_proceso', 'listo') ${propios}
    order by case when p.entrega_el between ${hoy}::date and ${hoy}::date + 1 then 0 when p.entrega_el < ${hoy}::date then 1 else 2 end,
             p.entrega_el nulls last, p.confirmado_en
    limit ${TOPE}`);
  return r.rows.map((f) => ({
    id: f.id, serie: f.serie, anio: f.anio, numero: f.numero, estado: f.estado, entregaEl: f.entrega_el, totalCentimos: Number(f.total),
    confirmadoDia: f.confirmado_dia, clienteId: f.cliente_id, clienteNombre: f.cliente_nombre, clienteTelefono: f.cliente_telefono,
  }));
}
