import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { registroDeudas, registroMovimientos } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { DatosDeCobertura } from '../domain/cobertura.js';
import { esDiferenciaDeCierre } from './cierres.repository.js';
import { LIKE_DE_TRANSFERENCIA } from '../domain/transferencia.js';

// Lectura de la cobertura del mes. Solo lee; la RLS aísla por empresa.

const aEntero = (v: string | number | null): number => {
  const n = Number(v ?? 0);
  if (!Number.isSafeInteger(n)) throw new RangeError('Una suma de céntimos salió del rango seguro.');
  return n;
};

/** Ingresos activos del rango (sin transferencias ni diferencias de caja del cierre) y deudas por pagar no anuladas que vencen en el rango. */
export async function datosDeCobertura(tx: Transaccion, ctx: ContextoDeEmpresa, desde: string, hasta: string): Promise<DatosDeCobertura> {
  const m = registroMovimientos;
  const d = registroDeudas;
  const [ingresos] = await tx
    .select({ total: sql<string>`coalesce(sum(${m.montoCentimos}), 0)::bigint` })
    .from(m)
    .where(and(eq(m.tenantId, ctx.empresaId), eq(m.estado, 'activo'), eq(m.tipo, 'ingreso'), sql`(${m.origenRef} is null or ${m.origenRef} not like ${LIKE_DE_TRANSFERENCIA})`, sql`not ${esDiferenciaDeCierre}`, gte(m.fecha, desde), lte(m.fecha, hasta)));
  const [deudas] = await tx
    .select({
      total: sql<string>`coalesce(sum(${d.totalCentimos}), 0)::bigint`,
      abonado: sql<string>`coalesce(sum(${d.abonadoCentimos}), 0)::bigint`,
      cantidad: sql<string>`count(*)`,
    })
    .from(d)
    .where(and(eq(d.tenantId, ctx.empresaId), eq(d.tipo, 'por_pagar'), ne(d.estado, 'anulada'), gte(d.venceEn, desde), lte(d.venceEn, hasta)));
  return {
    ingresosCentimos: aEntero(ingresos?.total ?? 0),
    compromisosCentimos: aEntero(deudas?.total ?? 0),
    compromisosPagadosCentimos: aEntero(deudas?.abonado ?? 0),
    compromisos: aEntero(deudas?.cantidad ?? 0),
  };
}
