import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AjusteDeDeudaDto, MotivoDeCorreccion } from '@capaz/shared';
import { registroDeudaAjustes, registroDeudas } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { versionDePedidoEnReferencia } from '../domain/ajuste.js';
import { codigoDeDeuda } from '../domain/codigos.js';

// Ajustes del total de una deuda: solo se agregan. La deuda debe estar bloqueada por quien escribe.

const a = registroDeudaAjustes;
type Fila = typeof a.$inferSelect;

export async function ajustePorOrigen(tx: Transaccion, ctx: ContextoDeEmpresa, origenRef: string): Promise<Fila | null> {
  const [f] = await tx.select().from(a).where(and(eq(a.tenantId, ctx.empresaId), eq(a.origenRef, origenRef)));
  return f ?? null;
}

/** Lo que quedó a favor del cliente en el último ajuste (0 si nunca hubo). */
export async function aFavorActual(tx: Transaccion, ctx: ContextoDeEmpresa, deudaId: string): Promise<number> {
  const [f] = await tx.select({ aFavor: a.aFavorCentimos }).from(a).where(and(eq(a.tenantId, ctx.empresaId), eq(a.deudaId, deudaId))).orderBy(desc(a.creadoEn), desc(a.id)).limit(1);
  return f?.aFavor ?? 0;
}

/**
 * La versión más nueva del pedido con que ya se ajustó esta deuda (por las referencias `pedido:<id>:v<n>`), o `null`. Sirve
 * para no aplicar tarde el ajuste de una versión vieja (un borrador aprobado después de otra corrección) y dejar la deuda atrás.
 */
export async function ultimaVersionAjustada(tx: Transaccion, ctx: ContextoDeEmpresa, deudaId: string, pedidoId: string): Promise<number | null> {
  const filas = await tx
    .select({ ref: a.origenRef })
    .from(a)
    .where(and(eq(a.tenantId, ctx.empresaId), eq(a.deudaId, deudaId), sql`${a.origenRef} like ${`pedido:${pedidoId}:v%`}`));
  const versiones = filas.map((f) => versionDePedidoEnReferencia(f.ref)?.version ?? 0);
  return versiones.length ? Math.max(...versiones) : null;
}

export type DatosDeAjuste = {
  deudaId: string;
  montoCentimos: number;
  totalAnteriorCentimos: number;
  totalNuevoCentimos: number;
  aFavorCentimos: number;
  motivoCodigo: MotivoDeCorreccion;
  motivoTexto: string | null;
  origenRef: string | null;
};

export async function insertarAjuste(tx: Transaccion, ctx: ContextoDeEmpresa, d: DatosDeAjuste): Promise<string> {
  const [f] = await tx.insert(a).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning({ id: a.id });
  if (!f) throw new Error('No se pudo guardar el ajuste.');
  return f.id;
}

/** Guarda el total nuevo con su estado (y, si llegan, el vencimiento y el contacto). `abonado ≤ total` lo exige la base. */
export async function guardarTotal(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  id: string,
  cambios: { totalCentimos: number; estado: string; venceEn?: string | null; contactoId?: string },
): Promise<void> {
  const r = await tx.update(registroDeudas).set(cambios).where(and(eq(registroDeudas.tenantId, ctx.empresaId), eq(registroDeudas.id, id))).returning({ id: registroDeudas.id });
  if (r.length !== 1) throw new Error('No se pudo ajustar la deuda.');
}

async function conNombres(tx: Transaccion, filas: { ajuste: Fila; tipo: string; anio: number; numero: number }[]): Promise<AjusteDeDeudaDto[]> {
  const ids = [...new Set(filas.map((f) => f.ajuste.creadoPor))];
  const nombres = new Map<string, string>();
  if (ids.length > 0) {
    const r = await tx.execute<{ usuario_id: string; nombre: string }>(sql`select usuario_id, nombre from core.v_miembros where usuario_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
    for (const f of r.rows) nombres.set(f.usuario_id, f.nombre);
  }
  return filas.map(({ ajuste: f, tipo, anio, numero }) => ({
    id: f.id,
    deudaId: f.deudaId,
    deudaCodigo: codigoDeDeuda(tipo as 'por_cobrar' | 'por_pagar', anio, numero),
    montoCentimos: f.montoCentimos,
    totalAnteriorCentimos: f.totalAnteriorCentimos,
    totalNuevoCentimos: f.totalNuevoCentimos,
    aFavorCentimos: f.aFavorCentimos,
    motivoCodigo: f.motivoCodigo as MotivoDeCorreccion,
    motivoTexto: f.motivoTexto,
    origenRef: f.origenRef,
    creadoPor: f.creadoPor,
    creadoPorNombre: nombres.get(f.creadoPor) ?? null,
    creadoEn: f.creadoEn.toISOString(),
  }));
}

const conDeuda = (tx: Transaccion) =>
  tx
    .select({ ajuste: a, tipo: registroDeudas.tipo, anio: registroDeudas.anio, numero: registroDeudas.numero })
    .from(a)
    .innerJoin(registroDeudas, and(eq(registroDeudas.tenantId, a.tenantId), eq(registroDeudas.id, a.deudaId)));

export async function ajustesDeDeuda(tx: Transaccion, ctx: ContextoDeEmpresa, deudaId: string): Promise<AjusteDeDeudaDto[]> {
  return conNombres(tx, await conDeuda(tx).where(and(eq(a.tenantId, ctx.empresaId), eq(a.deudaId, deudaId))).orderBy(desc(a.creadoEn), desc(a.id)));
}

export async function ajustesPorOrigenes(tx: Transaccion, ctx: ContextoDeEmpresa, origenRefs: readonly string[], propietario: string | null): Promise<AjusteDeDeudaDto[]> {
  const filas = await conDeuda(tx)
    .where(and(eq(a.tenantId, ctx.empresaId), inArray(a.origenRef, [...origenRefs]), propietario === null ? undefined : eq(registroDeudas.creadoPor, propietario)))
    .orderBy(desc(a.creadoEn), desc(a.id));
  return conNombres(tx, filas);
}
