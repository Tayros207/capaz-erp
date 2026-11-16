import { sql } from 'drizzle-orm';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Cifras de `crm_resumen`. Ganadas y perdidas cuentan por el día local de `cerrada_en` (zona de la empresa).

export type Periodo = { desde: string; hasta: string; zona: string; hoy: string };
export type CifrasDeCrm = {
  abiertas: number;
  montoAbiertoCentimos: number;
  ganadas: number;
  montoGanadoCentimos: number;
  perdidas: number;
  actividadesVencidas: number;
  porEtapa: Array<{ etapaId: string; nombre: string; cantidad: number; montoCentimos: number }>;
};

type Totales = { abiertas: number; monto_abierto: string; ganadas: number; monto_ganado: string; perdidas: number; vencidas: number };
type PorEtapa = { etapa_id: string; nombre: string; cantidad: number; monto: string };

export async function cifrasDeCrm(tx: Transaccion, ctx: ContextoDeEmpresa, p: Periodo): Promise<CifrasDeCrm> {
  const enPeriodo = sql`(cerrada_en at time zone ${p.zona})::date between ${p.desde}::date and ${p.hasta}::date`;
  const totales = await tx.execute<Totales>(sql`
    select count(*) filter (where estado = 'abierta')::int as abiertas,
           coalesce(sum(monto_estimado_centimos) filter (where estado = 'abierta'), 0)::bigint as monto_abierto,
           count(*) filter (where estado = 'ganada' and ${enPeriodo})::int as ganadas,
           coalesce(sum(monto_estimado_centimos) filter (where estado = 'ganada' and ${enPeriodo}), 0)::bigint as monto_ganado,
           count(*) filter (where estado = 'perdida' and ${enPeriodo})::int as perdidas,
           (select count(*)::int from crm.actividades a
             where a.tenant_id = ${ctx.empresaId} and a.hecha_en is null and a.vence_el < ${p.hoy}::date) as vencidas
      from crm.oportunidades where tenant_id = ${ctx.empresaId}`);
  const etapas = await tx.execute<PorEtapa>(sql`
    select e.id as etapa_id, e.nombre, count(o.id)::int as cantidad, coalesce(sum(o.monto_estimado_centimos), 0)::bigint as monto
      from crm.etapas e
      left join crm.oportunidades o on o.tenant_id = e.tenant_id and o.etapa_id = e.id and o.estado = 'abierta'
     where e.tenant_id = ${ctx.empresaId} and e.tipo = 'abierta' and e.archivado_en is null
     group by e.id, e.nombre, e.orden
     order by e.orden, e.nombre`);
  const t = totales.rows[0]!;
  return {
    abiertas: t.abiertas,
    montoAbiertoCentimos: Number(t.monto_abierto),
    ganadas: t.ganadas,
    montoGanadoCentimos: Number(t.monto_ganado),
    perdidas: t.perdidas,
    actividadesVencidas: t.vencidas,
    porEtapa: etapas.rows.map((e) => ({ etapaId: e.etapa_id, nombre: e.nombre, cantidad: e.cantidad, montoCentimos: Number(e.monto) })),
  };
}
