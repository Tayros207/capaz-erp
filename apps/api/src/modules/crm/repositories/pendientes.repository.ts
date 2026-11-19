import { sql } from 'drizzle-orm';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { ActividadPendiente } from '../domain/pendientes.js';

// Lectura de «Mi día»: actividades sin hacer que vencen a más tardar en `hasta`. Con alcance «propios» salen las que la
// persona creó o tiene a cargo, y las de oportunidades suyas (igual que el resto del módulo). Solo lee.

type Fila = {
  id: string; tipo: string; asunto: string; vence_el: string; oportunidad_id: string; numero: number; anio: number; titulo: string;
  cliente_id: string; cliente_nombre: string; cliente_telefono: string | null;
};

const TOPE = 500;

export async function actividadesPorHacer(tx: Transaccion, ctx: ContextoDeEmpresa, hasta: string, propios: boolean): Promise<ActividadPendiente[]> {
  const u = ctx.usuarioId;
  const alcance = propios ? sql`and (a.creado_por = ${u} or a.responsable_id = ${u} or o.creado_por = ${u} or o.responsable_id = ${u})` : sql``;
  const r = await tx.execute<Fila>(sql`
    select a.id, a.tipo, a.asunto, a.vence_el::text as vence_el, o.id as oportunidad_id, o.numero, o.anio, o.titulo,
           c.id as cliente_id, c.nombre as cliente_nombre, c.telefono as cliente_telefono
    from crm.actividades a
    join crm.oportunidades o on o.tenant_id = a.tenant_id and o.id = a.oportunidad_id
    join core.clientes c on c.tenant_id = o.tenant_id and c.id = o.cliente_id
    where a.tenant_id = current_setting('app.tenant_id', true) and a.hecha_en is null and a.vence_el is not null
      and a.vence_el <= ${hasta}::date and o.estado = 'abierta' ${alcance}
    order by a.vence_el, a.creado_en
    limit ${TOPE}`);
  return r.rows.map((f) => ({
    id: f.id, tipo: f.tipo, asunto: f.asunto, venceEl: f.vence_el, oportunidadId: f.oportunidad_id, oportunidadNumero: f.numero, oportunidadAnio: f.anio,
    oportunidadTitulo: f.titulo, clienteId: f.cliente_id, clienteNombre: f.cliente_nombre, clienteTelefono: f.cliente_telefono,
  }));
}
