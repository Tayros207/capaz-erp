import { sql } from 'drizzle-orm';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { CotizacionSinRespuesta } from '../domain/pendientes.js';

// Lectura de «Mi día»: cotizaciones emitidas o enviadas, con el día desde el que esperan respuesta. Solo lee; la RLS aísla
// por empresa. No hay marca de «enviada el»: para una enviada se toma la última vez que cambió.

type Fila = {
  id: string; numero: number | null; anio: number | null; version_actual: number; estado: CotizacionSinRespuesta['estado']; titulo: string;
  valida_hasta: string | null; total: string | null; desde: string; cliente_id: string | null; cliente_nombre: string | null; cliente_telefono: string | null;
};

const TOPE = 500;

export async function cotizacionesSinRespuesta(tx: Transaccion, _ctx: ContextoDeEmpresa, zona: string): Promise<CotizacionSinRespuesta[]> {
  const r = await tx.execute<Fila>(sql`
    select c.id, c.numero, c.anio, c.version_actual, c.estado, c.titulo, c.valida_hasta::text as valida_hasta, v.total_centimos::text as total,
           ((case when c.estado = 'enviada' then c.actualizado_en else coalesce(v.emitida_en, c.actualizado_en) end) at time zone ${zona})::date::text as desde,
           c.cliente_id, coalesce(cl.nombre, c.cliente_nombre) as cliente_nombre, cl.telefono as cliente_telefono
    from cotizador.cotizaciones c
    left join cotizador.versiones v on v.tenant_id = c.tenant_id and v.cotizacion_id = c.id and v.version = c.version_actual
    left join core.clientes cl on cl.tenant_id = c.tenant_id and cl.id = c.cliente_id
    where c.tenant_id = current_setting('app.tenant_id', true) and c.estado in ('emitida', 'enviada')
    order by c.creado_en desc
    limit ${TOPE}`);
  return r.rows.map((f) => ({
    id: f.id, numero: f.numero, anio: f.anio, version: f.version_actual, estado: f.estado, titulo: f.titulo, validaHasta: f.valida_hasta,
    totalCentimos: f.total === null ? null : Number(f.total), desde: f.desde, clienteId: f.cliente_id, clienteNombre: f.cliente_nombre, clienteTelefono: f.cliente_telefono,
  }));
}
