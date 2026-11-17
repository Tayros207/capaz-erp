import { and, asc, eq, isNull } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { cotizadorAjustesDeCliente } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Repositorio de ajustes por cliente (un porcentaje con signo por cliente). El tope del listado es 500.

const a = cotizadorAjustesDeCliente;
export type AjusteDeCliente = typeof a.$inferSelect;
export type AjusteConCliente = AjusteDeCliente & { clienteNombre: string };
export const MAXIMO_DE_AJUSTES = 500;

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(a.tenantId, ctx.empresaId);

export async function listarAjustes(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<AjusteConCliente[]> {
  const filas = await tx
    .select({ fila: a, clienteNombre: clientes.nombre })
    .from(a)
    .innerJoin(clientes, and(eq(clientes.tenantId, a.tenantId), eq(clientes.id, a.clienteId)))
    .where(deEmpresa(ctx))
    .orderBy(asc(clientes.nombreNormalizado), asc(a.id))
    .limit(MAXIMO_DE_AJUSTES);
  return filas.map((x) => ({ ...x.fila, clienteNombre: x.clienteNombre }));
}

export async function ajusteDe(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string): Promise<AjusteDeCliente | null> {
  const [fila] = await tx.select().from(a).where(and(deEmpresa(ctx), eq(a.clienteId, clienteId)));
  return fila ?? null;
}

export async function existeCliente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<{ nombre: string } | null> {
  const [fila] = await tx
    .select({ nombre: clientes.nombre })
    .from(clientes)
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, id), isNull(clientes.fusionadoEn)));
  return fila ?? null;
}

/** Crea o cambia el ajuste del cliente. */
export async function fijarAjuste(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string, porcentaje: string, nota: string | null): Promise<AjusteDeCliente> {
  const [fila] = await tx
    .insert(a)
    .values({ tenantId: ctx.empresaId, clienteId, porcentaje, nota, creadoPor: ctx.usuarioId })
    .onConflictDoUpdate({ target: [a.tenantId, a.clienteId], set: { porcentaje, nota, actualizadoEn: new Date() } })
    .returning();
  if (!fila) throw new Error('El ajuste no se pudo guardar.');
  return fila;
}

export async function quitarAjuste(tx: Transaccion, ctx: ContextoDeEmpresa, clienteId: string): Promise<void> {
  await tx.delete(a).where(and(deEmpresa(ctx), eq(a.clienteId, clienteId)));
}
