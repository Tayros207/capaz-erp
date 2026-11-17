import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { registroCategorias, registroDeudas, registroMovimientos } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { DeudaAbierta } from '../domain/antiguedad.js';
import { LIKE_DE_TRANSFERENCIA } from '../domain/transferencia.js';

// Lecturas agregadas del módulo (resumen del periodo y deudas abiertas). No escriben. Las sumas salen de la base
// como enteros (`bigint`) y se convierten comprobando el rango seguro.

const aEntero = (valor: string | number | null): number => {
  const n = Number(valor ?? 0);
  if (!Number.isSafeInteger(n)) throw new RangeError('Una suma de céntimos salió del rango seguro.');
  return n;
};

export type TotalPorCategoria = { categoriaId: string | null; nombre: string | null; tipo: 'ingreso' | 'egreso'; totalCentimos: number };

/** Movimientos ACTIVOS del rango (sin las transferencias entre cuentas), agrupados por tipo y categoría (del total mayor al menor). */
export async function totalesPorCategoria(tx: Transaccion, ctx: ContextoDeEmpresa, desde: string, hasta: string): Promise<TotalPorCategoria[]> {
  const m = registroMovimientos;
  const total = sql<string>`sum(${m.montoCentimos})::bigint`;
  const filas = await tx
    .select({ categoriaId: m.categoriaId, nombre: registroCategorias.nombre, tipo: m.tipo, total })
    .from(m)
    .leftJoin(registroCategorias, and(eq(registroCategorias.tenantId, m.tenantId), eq(registroCategorias.id, m.categoriaId)))
    .where(and(eq(m.tenantId, ctx.empresaId), eq(m.estado, 'activo'), sql`(${m.origenRef} is null or ${m.origenRef} not like ${LIKE_DE_TRANSFERENCIA})`, gte(m.fecha, desde), lte(m.fecha, hasta)))
    .groupBy(m.categoriaId, registroCategorias.nombre, m.tipo)
    .orderBy(m.tipo, sql`${total} desc`, registroCategorias.nombre);
  return filas.map((f) => ({ categoriaId: f.categoriaId, nombre: f.nombre, tipo: f.tipo as 'ingreso' | 'egreso', totalCentimos: aEntero(f.total) }));
}

export type DeudasAbiertas = { saldoCentimos: number; vencidas: number; vencidasCentimos: number };

/** Saldo abierto (pendientes y parciales) por tipo de deuda, y cuánto de eso ya venció respecto de `hoy`. */
export async function deudasAbiertasPorTipo(tx: Transaccion, ctx: ContextoDeEmpresa, hoy: string): Promise<Record<'por_cobrar' | 'por_pagar', DeudasAbiertas>> {
  const d = registroDeudas;
  const saldo = sql`(${d.totalCentimos} - ${d.abonadoCentimos})`;
  const vencida = sql`${d.venceEn} is not null and ${d.venceEn} < ${hoy}::date`;
  const filas = await tx
    .select({
      tipo: d.tipo,
      saldo: sql<string>`coalesce(sum(${saldo}), 0)::bigint`,
      vencidas: sql<string>`count(*) filter (where ${vencida})`,
      vencidasSaldo: sql<string>`coalesce(sum(${saldo}) filter (where ${vencida}), 0)::bigint`,
    })
    .from(d)
    .where(and(eq(d.tenantId, ctx.empresaId), inArray(d.estado, ['pendiente', 'parcial'])))
    .groupBy(d.tipo);
  const vacio = (): DeudasAbiertas => ({ saldoCentimos: 0, vencidas: 0, vencidasCentimos: 0 });
  const r = { por_cobrar: vacio(), por_pagar: vacio() };
  for (const f of filas) {
    if (f.tipo !== 'por_cobrar' && f.tipo !== 'por_pagar') continue;
    r[f.tipo] = { saldoCentimos: aEntero(f.saldo), vencidas: aEntero(f.vencidas), vencidasCentimos: aEntero(f.vencidasSaldo) };
  }
  return r;
}

/** Las deudas abiertas (pendientes y parciales) de un tipo, con el contacto y lo que falta cobrar o pagar. */
export async function deudasAbiertasConContacto(tx: Transaccion, ctx: ContextoDeEmpresa, tipo: 'por_cobrar' | 'por_pagar'): Promise<DeudaAbierta[]> {
  const d = registroDeudas;
  const filas = await tx
    .select({
      contactoId: d.contactoId,
      contactoNombre: clientes.nombre,
      saldo: sql<string>`(${d.totalCentimos} - ${d.abonadoCentimos})::bigint`,
      fecha: sql<string>`${d.fecha}::text`,
      venceEn: sql<string | null>`${d.venceEn}::text`,
    })
    .from(d)
    .innerJoin(clientes, and(eq(clientes.tenantId, d.tenantId), eq(clientes.id, d.contactoId)))
    .where(and(eq(d.tenantId, ctx.empresaId), eq(d.tipo, tipo), inArray(d.estado, ['pendiente', 'parcial'])));
  return filas.map((f) => ({ contactoId: f.contactoId, contactoNombre: f.contactoNombre, saldoCentimos: aEntero(f.saldo), fecha: f.fecha, venceEn: f.venceEn }));
}
