import { and, eq, inArray, sql } from 'drizzle-orm';
import { clientes, productos, sucursales } from '../../../db/esquema/core-maestros.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { ProductoParaLinea } from '../domain/orden.js';

// Lo que una orden de compra necesita del núcleo (proveedor, sucursal, productos). Solo lectura.

/** El proveedor es un contacto del núcleo (cliente, proveedor o ambos) vigente: ni archivado ni fusionado. */
export async function proveedorVigente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [fila] = await tx
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, id), sql`${clientes.archivadoEn} is null`, sql`${clientes.fusionadoEn} is null`));
  return fila !== undefined;
}

export async function sucursalVigente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [fila] = await tx
    .select({ id: sucursales.id })
    .from(sucursales)
    .where(and(eq(sucursales.tenantId, ctx.empresaId), eq(sucursales.id, id), sql`${sucursales.archivadoEn} is null`));
  return fila !== undefined;
}

/** Código de la sucursal de la orden o, si no tiene, el de la principal: es la serie del correlativo. */
export async function serieDe(tx: Transaccion, ctx: ContextoDeEmpresa, sucursalId: string | null): Promise<string | null> {
  const [fila] = await tx
    .select({ codigo: sucursales.codigo })
    .from(sucursales)
    .where(and(eq(sucursales.tenantId, ctx.empresaId), sucursalId ? eq(sucursales.id, sucursalId) : sql`${sucursales.esPrincipal}`));
  return fila?.codigo ?? null;
}

export async function productosPorId(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Map<string, ProductoParaLinea>> {
  if (ids.length === 0) return new Map();
  const filas = await tx
    .select({ id: productos.id, nombre: productos.nombre, unidad: productos.unidad, afectoIgv: productos.afectoIgv, archivadoEn: productos.archivadoEn })
    .from(productos)
    .where(and(eq(productos.tenantId, ctx.empresaId), inArray(productos.id, [...new Set(ids)])));
  return new Map(filas.map(({ archivadoEn, ...p }) => [p.id, { ...p, archivado: archivadoEn !== null }]));
}
