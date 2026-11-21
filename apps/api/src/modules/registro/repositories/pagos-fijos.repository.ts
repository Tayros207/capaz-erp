import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { registroDeudas } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { claveDePagoFijo, type FuenteDePagoFijo } from '../domain/pagos-fijos.js';

// Lectura de los pagos fijos para copiarlos. Solo lee; la RLS aísla por empresa.

const d = registroDeudas;
export const ORIGEN_DE_PAGO_FIJO = 'pago_fijo';
const LIMITE_DE_FUENTES = 500;

/** Deudas por pagar marcadas «fijo», no anuladas, que vencen entre `desde` y `hasta`. */
export async function fuentesDePagoFijo(tx: Transaccion, ctx: ContextoDeEmpresa, desde: string, hasta: string): Promise<FuenteDePagoFijo[]> {
  const filas = await tx
    .select({ id: d.id, contactoId: d.contactoId, concepto: d.concepto, totalCentimos: d.totalCentimos, venceEn: d.venceEn, sucursalId: d.sucursalId, extra: d.datosExtra, contactoNombre: clientes.nombre })
    .from(d)
    .innerJoin(clientes, and(eq(clientes.tenantId, d.tenantId), eq(clientes.id, d.contactoId)))
    .where(and(eq(d.tenantId, ctx.empresaId), eq(d.tipo, 'por_pagar'), ne(d.estado, 'anulada'), sql`${d.datosExtra} @> '{"fijo": true}'::jsonb`, gte(d.venceEn, desde), lte(d.venceEn, hasta)))
    .orderBy(asc(d.venceEn), asc(d.concepto), asc(d.id))
    .limit(LIMITE_DE_FUENTES);
  return filas.flatMap(({ extra, ...f }) => {
    const dia = (extra as { dia?: unknown } | null)?.dia;
    return f.venceEn ? [{ ...f, venceEn: f.venceEn, dia: typeof dia === 'number' && dia >= 1 && dia <= 31 ? dia : null }] : [];
  });
}

/** Lo que ya existe en el mes destino: claves proveedor+concepto de las deudas por pagar vivas que vencen ahí (con su día de vencimiento) y los orígenes ya copiados. */
export async function existentesDelMes(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  desde: string,
  hasta: string,
  origenIds: string[],
): Promise<{ claves: Set<string>; origenes: Set<string> }> {
  const vivas = await tx
    .select({ contactoId: d.contactoId, concepto: d.concepto, venceEn: d.venceEn })
    .from(d)
    .where(and(eq(d.tenantId, ctx.empresaId), eq(d.tipo, 'por_pagar'), ne(d.estado, 'anulada'), gte(d.venceEn, desde), lte(d.venceEn, hasta)));
  const copiadas =
    origenIds.length === 0
      ? []
      : await tx
          .select({ origenId: d.origenId })
          .from(d)
          .where(and(eq(d.tenantId, ctx.empresaId), ne(d.estado, 'anulada'), eq(d.origenTipo, ORIGEN_DE_PAGO_FIJO), inArray(d.origenId, origenIds)));
  return {
    claves: new Set(vivas.flatMap((v) => (v.venceEn ? [claveDePagoFijo(v.contactoId, v.concepto, v.venceEn)] : []))),
    origenes: new Set(copiadas.flatMap((c) => (c.origenId ? [c.origenId] : []))),
  };
}
