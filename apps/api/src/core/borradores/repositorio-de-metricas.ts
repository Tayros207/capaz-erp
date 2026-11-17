import { sql } from 'drizzle-orm';
import { SEGUNDOS_DE_MISMA_SESION, type MetricasDeBorradores } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { porcentajeSinCorregir } from './metricas.js';

const MAXIMO_DE_CAMPOS_CORREGIDOS = 20;

export type FiltrosDeMetricas = {
  desde: string;
  hasta: string;
  zona: string;
  origenes: readonly string[];
  modulos: readonly string[];
};

const lista = (valores: readonly string[]) => sql`array[${sql.join(valores.map((v) => sql`${v}`), sql`, `)}]::text[]`;

/** Universo: borradores de captura de esos módulos, propuestos entre las dos fechas (día de la zona de la empresa). */
const universo = (f: FiltrosDeMetricas) => sql`
  from core.borradores b
  where b.origen = any(${lista(f.origenes)})
    and b.modulo = any(${lista(f.modulos)})
    and (b.propuesto_en at time zone ${f.zona})::date between ${f.desde}::date and ${f.hasta}::date`;

export async function metricasDeBorradores(tx: Transaccion, f: FiltrosDeMetricas): Promise<MetricasDeBorradores> {
  const vacio: MetricasDeBorradores = {
    desde: f.desde, hasta: f.hasta, propuestos: 0, aprobadosSinCorregir: 0, aprobadosCorregidos: 0, descartados: 0, pendientes: 0,
    pctSinCorregir: null, enLaMismaSesion: 0, medianaSegundos: null, camposCorregidos: [],
  };
  if (f.modulos.length === 0 || f.origenes.length === 0) return vacio;

  const tiempo = sql`b.estado = 'aprobado' and b.captura_iniciada_en is not null and b.resuelto_en - b.captura_iniciada_en <= make_interval(secs => ${SEGUNDOS_DE_MISMA_SESION})`;
  const conteos = await tx.execute<Record<'propuestos' | 'sin_corregir' | 'corregidos' | 'descartados' | 'pendientes' | 'en_sesion' | 'mediana', number | null>>(sql`
    select count(*)::int as propuestos,
      (count(*) filter (where b.estado = 'aprobado' and not b.corregido))::int as sin_corregir,
      (count(*) filter (where b.estado = 'aprobado' and b.corregido))::int as corregidos,
      (count(*) filter (where b.estado = 'descartado'))::int as descartados,
      (count(*) filter (where b.estado = 'pendiente'))::int as pendientes,
      (count(*) filter (where ${tiempo}))::int as en_sesion,
      round((percentile_cont(0.5) within group (order by extract(epoch from b.resuelto_en - b.captura_iniciada_en)) filter (where ${tiempo}))::numeric)::int as mediana
    ${universo(f)}`);
  const c = conteos.rows[0];
  const campos = await tx.execute<{ campo: string; veces: number }>(sql`
    select k.campo, count(*)::int as veces
    from (select b.args, b.args_originales ${universo(f)} and b.estado = 'aprobado' and b.corregido) b
    cross join lateral (
      select clave as campo from jsonb_object_keys(case when jsonb_typeof(b.args) = 'object' then b.args else '{}'::jsonb end) clave
      union
      select clave from jsonb_object_keys(case when jsonb_typeof(b.args_originales) = 'object' then b.args_originales else '{}'::jsonb end) clave
    ) k
    where (b.args -> k.campo) is distinct from (b.args_originales -> k.campo)
    group by k.campo order by veces desc, k.campo limit ${MAXIMO_DE_CAMPOS_CORREGIDOS}`);

  const sinCorregir = c?.sin_corregir ?? 0;
  const corregidos = c?.corregidos ?? 0;
  const descartados = c?.descartados ?? 0;
  return {
    desde: f.desde,
    hasta: f.hasta,
    propuestos: c?.propuestos ?? 0,
    aprobadosSinCorregir: sinCorregir,
    aprobadosCorregidos: corregidos,
    descartados,
    pendientes: c?.pendientes ?? 0,
    pctSinCorregir: porcentajeSinCorregir({ sinCorregir, corregidos, descartados }),
    enLaMismaSesion: c?.en_sesion ?? 0,
    medianaSegundos: c?.mediana ?? null,
    camposCorregidos: campos.rows.map((r) => ({ campo: r.campo, veces: r.veces })),
  };
}
