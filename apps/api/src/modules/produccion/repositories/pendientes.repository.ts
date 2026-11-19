import { sql } from 'drizzle-orm';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { OrdenEnCurso } from '../domain/pendientes.js';

// Lectura de «Mi día»: las órdenes de trabajo vivas con fecha de entrega, con su cliente. Solo lee; la RLS aísla por empresa.

type Fila = {
  id: string; anio: number; numero: number; estado: OrdenEnCurso['estado']; entrega_el: string | null; total: string; adelanto: string;
  cliente_id: string; cliente_nombre: string; cliente_telefono: string | null;
};

const TOPE = 500;

/** Vivas (pendiente, en máquina, listo) que vencen a más tardar en `hasta`: atrasadas, de hoy y de mañana. */
export async function ordenesPorEntregar(tx: Transaccion, _ctx: ContextoDeEmpresa, hasta: string): Promise<OrdenEnCurso[]> {
  const r = await tx.execute<Fila>(sql`
    select o.id, o.anio, o.numero, o.estado, o.entrega_el::text as entrega_el, o.total_centimos::text as total, o.adelanto_centimos::text as adelanto,
           c.id as cliente_id, c.nombre as cliente_nombre, c.telefono as cliente_telefono
    from produccion.ordenes o
    join core.clientes c on c.tenant_id = o.tenant_id and c.id = o.cliente_id
    where o.tenant_id = current_setting('app.tenant_id', true) and o.estado in ('pendiente', 'en_maquina', 'listo')
      and o.entrega_el is not null and o.entrega_el <= ${hasta}::date
    order by o.entrega_el, o.numero
    limit ${TOPE}`);
  return r.rows.map((f) => ({
    id: f.id, anio: f.anio, numero: f.numero, estado: f.estado, entregaEl: f.entrega_el, totalCentimos: Number(f.total), adelantoCentimos: Number(f.adelanto),
    clienteId: f.cliente_id, clienteNombre: f.cliente_nombre, clienteTelefono: f.cliente_telefono,
  }));
}
