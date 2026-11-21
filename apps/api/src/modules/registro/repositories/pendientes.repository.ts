import { and, desc, eq, inArray, isNotNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { MAXIMO_DE_ANOTACIONES, sumarDias } from '@capaz/shared';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { registroDeudas } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { DeudaConOrigen, DeudaPorCobrar } from '../domain/cobros-pendientes.js';
import { DIAS_DE_AVISO_DE_PAGO, type DeudaPorPagar } from '../domain/pagos-pendientes.js';

// Lecturas de «Mi día» para el módulo `registro`. Solo leen; la RLS de la transacción aísla por empresa y, con alcance
// «propios», `propietario` limita a las deudas que la persona creó.

const d = registroDeudas;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(d.tenantId, ctx.empresaId);
const delPropietario = (propietario: string | null): SQL | undefined => (propietario === null ? undefined : eq(d.creadoPor, propietario));
const aEntero = (v: string | number): number => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new RangeError('Una suma de céntimos salió del rango seguro.');
  return n;
};

/** Las deudas por cobrar con saldo (pendientes y parciales), con el nombre y el teléfono del cliente. */
export async function deudasPorCobrarAbiertas(tx: Transaccion, ctx: ContextoDeEmpresa, propietario: string | null): Promise<DeudaPorCobrar[]> {
  const filas = await tx
    .select({
      contactoId: d.contactoId,
      contactoNombre: clientes.nombre,
      contactoTelefono: clientes.telefono,
      saldo: sql<string>`(${d.totalCentimos} - ${d.abonadoCentimos})::bigint`,
      fecha: sql<string>`${d.fecha}::text`,
      venceEn: sql<string | null>`${d.venceEn}::text`,
    })
    .from(d)
    .innerJoin(clientes, and(eq(clientes.tenantId, d.tenantId), eq(clientes.id, d.contactoId)))
    .where(and(deEmpresa(ctx), eq(d.tipo, 'por_cobrar'), inArray(d.estado, ['pendiente', 'parcial']), delPropietario(propietario)));
  return filas.map((f) => ({ contactoId: f.contactoId, contactoNombre: f.contactoNombre, contactoTelefono: f.contactoTelefono, saldoCentimos: aEntero(f.saldo), fecha: f.fecha, venceEn: f.venceEn }));
}

/**
 * Las deudas por cobrar que nacieron de un pedido o una orden de trabajo: las abiertas y las saldadas en los últimos
 * `diasPagadas` días. Alimentan las anotaciones «Pagado» y «Debe S/ X». Van primero las abiertas (de ellas depende «sin
 * adelanto» y el saldo) y luego lo más reciente, para que el tope no deje fuera una abierta por una ya pagada.
 */
export async function deudasConOrigen(tx: Transaccion, ctx: ContextoDeEmpresa, propietario: string | null, diasPagadas = 120): Promise<DeudaConOrigen[]> {
  const filas = await tx
    .select({ origenTipo: d.origenTipo, origenId: d.origenId, estado: d.estado, total: d.totalCentimos, abonado: d.abonadoCentimos })
    .from(d)
    .where(
      and(
        deEmpresa(ctx),
        eq(d.tipo, 'por_cobrar'),
        ne(d.estado, 'anulada'),
        isNotNull(d.origenId),
        inArray(d.origenTipo, ['pedido', 'produccion']),
        or(inArray(d.estado, ['pendiente', 'parcial']), sql`${d.actualizadoEn} >= now() - make_interval(days => ${diasPagadas})`),
        delPropietario(propietario),
      ),
    )
    .orderBy(sql`(${d.estado} in ('pendiente', 'parcial')) desc`, desc(d.actualizadoEn), desc(d.id))
    .limit(MAXIMO_DE_ANOTACIONES);
  return filas.flatMap((f) => (f.origenTipo && f.origenId ? [{ origenTipo: f.origenTipo, origenId: f.origenId, estado: f.estado, totalCentimos: f.total, abonadoCentimos: f.abonado }] : []));
}

/** El nombre con el que se firma un cobro: la razón social de la empresa; `null` si no se ha escrito. */
export async function nombreDeLaEmpresa(tx: Transaccion): Promise<string | null> {
  const r = await tx.execute<{ razon_social: string | null }>(sql`select razon_social from core.empresa_config limit 1`);
  return r.rows[0]?.razon_social?.trim() || null;
}

/** Las deudas por pagar con saldo (pendientes y parciales) que vencen hasta `hoy` + días de aviso, vencidas incluidas. */
export async function deudasPorPagarProximas(tx: Transaccion, ctx: ContextoDeEmpresa, propietario: string | null, hoy: string): Promise<DeudaPorPagar[]> {
  const filas = await tx
    .select({
      id: d.id, anio: d.anio, numero: d.numero, proveedorId: d.contactoId, proveedorNombre: clientes.nombre, concepto: d.concepto,
      saldo: sql<string>`(${d.totalCentimos} - ${d.abonadoCentimos})::bigint`,
      venceEn: sql<string>`${d.venceEn}::text`,
    })
    .from(d)
    .innerJoin(clientes, and(eq(clientes.tenantId, d.tenantId), eq(clientes.id, d.contactoId)))
    .where(and(deEmpresa(ctx), eq(d.tipo, 'por_pagar'), inArray(d.estado, ['pendiente', 'parcial']), isNotNull(d.venceEn), sql`${d.venceEn} <= ${sumarDias(hoy, DIAS_DE_AVISO_DE_PAGO)}::date`, delPropietario(propietario)))
    .orderBy(d.venceEn, d.id)
    .limit(MAXIMO_DE_ANOTACIONES);
  return filas.map((f) => ({ id: f.id, anio: f.anio, numero: f.numero, proveedorId: f.proveedorId, proveedorNombre: f.proveedorNombre, concepto: f.concepto, saldoCentimos: aEntero(f.saldo), venceEn: f.venceEn }));
}
