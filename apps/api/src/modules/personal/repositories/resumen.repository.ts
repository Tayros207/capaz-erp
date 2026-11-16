import { sql } from 'drizzle-orm';
import { ESTADOS_DE_ASISTENCIA, type EstadoDeAsistencia } from '@capaz/shared';
import type { Transaccion } from '../../../infra/database/con-empresa.js';

// Cifras del módulo. Solo lectura; la RLS de la transacción aísla por empresa.

export type ResumenDePersonalFilas = {
  colaboradoresActivos: number;
  hoy: { fecha: string; marcados: number; sinMarcar: number };
  asistenciasPorEstado: Array<{ estado: EstadoDeAsistencia; cantidad: number }>;
  adelantos: { cantidad: number; totalCentimos: number; anulados: number };
};

/**
 * `asistenciasPorEstado` y `adelantos`: dentro del período por la fecha del registro; los adelantos vigentes suman
 * en `cantidad` y `totalCentimos`, los anulados solo cuentan en `anulados`. `hoy`: de los colaboradores activos,
 * cuántos tienen marca hoy y cuántos faltan (una marca de un archivado no cuenta).
 */
export async function resumenDePersonal(tx: Transaccion, p: { desde: string; hasta: string; hoy: string }): Promise<ResumenDePersonalFilas> {
  const t = sql`tenant_id = current_setting('app.tenant_id', true)`;
  const activos = await tx.execute<{ total: number; marcados: number }>(
    sql`select count(*)::int as total,
          count(*) filter (where exists (select 1 from personal.asistencias a where a.tenant_id = c.tenant_id and a.colaborador_id = c.id and a.fecha = ${p.hoy}::date))::int as marcados
        from personal.colaboradores c where c.tenant_id = current_setting('app.tenant_id', true) and c.archivado_en is null`,
  );
  const estados = await tx.execute<{ estado: EstadoDeAsistencia; cantidad: number }>(
    sql`select estado, count(*)::int as cantidad from personal.asistencias
        where ${t} and fecha between ${p.desde}::date and ${p.hasta}::date group by estado`,
  );
  const adelantos = await tx.execute<{ cantidad: number; total: string; anulados: number }>(
    sql`select count(*) filter (where estado = 'registrado')::int as cantidad,
          coalesce(sum(monto_centimos) filter (where estado = 'registrado'), 0)::text as total,
          count(*) filter (where estado = 'anulado')::int as anulados
        from personal.adelantos where ${t} and fecha between ${p.desde}::date and ${p.hasta}::date`,
  );
  const porEstado = new Map(estados.rows.map((e) => [e.estado, e.cantidad]));
  const a = activos.rows[0]!;
  const d = adelantos.rows[0]!;
  return {
    colaboradoresActivos: a.total,
    hoy: { fecha: p.hoy, marcados: a.marcados, sinMarcar: a.total - a.marcados },
    asistenciasPorEstado: ESTADOS_DE_ASISTENCIA.map((estado) => ({ estado, cantidad: porEstado.get(estado) ?? 0 })),
    adelantos: { cantidad: d.cantidad, totalCentimos: Number(d.total), anulados: d.anulados },
  };
}
