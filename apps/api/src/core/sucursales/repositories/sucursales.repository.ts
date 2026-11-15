import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { sucursales } from '../../../db/esquema/core-maestros.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { CODIGO_SUCURSAL_PRINCIPAL, NOMBRE_SUCURSAL_PRINCIPAL, type DatosDeSucursal } from '../domain/sucursal.js';

// Repositorio de sucursales: recibe la transacción de `conEmpresa`.

export type Sucursal = typeof sucursales.$inferSelect;

export type ResultadoDeCrear = { creada: true; sucursal: Sucursal } | { creada: false; existente: Sucursal };

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(sucursales.tenantId, ctx.empresaId);

export async function crearSucursal(tx: Transaccion, ctx: ContextoDeEmpresa, datos: DatosDeSucursal, opciones: { esPrincipal?: boolean } = {}): Promise<ResultadoDeCrear> {
  const [fila] = await tx
    .insert(sucursales)
    .values({ ...datos, tenantId: ctx.empresaId, esPrincipal: opciones.esPrincipal ?? false })
    .onConflictDoNothing()
    .returning();
  if (fila) return { creada: true, sucursal: fila };
  const [existente] = await tx.select().from(sucursales).where(and(deEmpresa(ctx), eq(sucursales.codigo, datos.codigo)));
  if (!existente) throw new Error('Conflicto de unicidad de sucursales sin fila que lo explique.');
  return { creada: false, existente };
}

export async function verSucursal(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Sucursal | null> {
  const [fila] = await tx.select().from(sucursales).where(and(deEmpresa(ctx), eq(sucursales.id, id)));
  return fila ?? null;
}

/** Todas las de la empresa (son pocas): la principal primero, luego por código. Los archivados solo si se piden. */
export async function listarSucursales(tx: Transaccion, ctx: ContextoDeEmpresa, opciones: { incluirArchivadas?: boolean } = {}): Promise<Sucursal[]> {
  return tx
    .select()
    .from(sucursales)
    .where(and(deEmpresa(ctx), opciones.incluirArchivadas ? undefined : isNull(sucursales.archivadoEn)))
    .orderBy(sql`${sucursales.esPrincipal} desc`, asc(sucursales.codigo));
}

/** Edita nombre, dirección y teléfono. El código no cambia (es la serie de los correlativos). */
export async function editarSucursal(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, datos: Pick<DatosDeSucursal, 'nombre' | 'direccion' | 'telefono'>): Promise<Sucursal | null> {
  const [fila] = await tx
    .update(sucursales)
    .set({ ...datos, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(sucursales.id, id)))
    .returning();
  return fila ?? null;
}

/** Archiva (idempotente). `'es_principal'` si es la principal (no se archiva); `null` si no existe. */
export async function archivarSucursal(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Sucursal | 'es_principal' | null> {
  const actual = await verSucursal(tx, ctx, id);
  if (!actual) return null;
  if (actual.esPrincipal) return 'es_principal';
  const [fila] = await tx
    .update(sucursales)
    .set({ archivadoEn: sql`coalesce(${sucursales.archivadoEn}, now())`, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(sucursales.id, id)))
    .returning();
  return fila!;
}

export async function restaurarSucursal(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Sucursal | null> {
  const [fila] = await tx
    .update(sucursales)
    .set({ archivadoEn: null, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(sucursales.id, id)))
    .returning();
  return fila ?? null;
}

/** Marca como principal (la anterior deja de serlo) en la misma transacción. `'archivada'` si está archivada; `null` si no existe. */
export async function marcarPrincipal(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Sucursal | 'archivada' | null> {
  const destino = await verSucursal(tx, ctx, id);
  if (!destino) return null;
  if (destino.archivadoEn) return 'archivada';
  if (destino.esPrincipal) return destino;
  await tx.update(sucursales).set({ esPrincipal: false, actualizadoEn: sql`now()` }).where(and(deEmpresa(ctx), eq(sucursales.esPrincipal, true)));
  const [fila] = await tx
    .update(sucursales)
    .set({ esPrincipal: true, actualizadoEn: sql`now()` })
    .where(and(deEmpresa(ctx), eq(sucursales.id, id)))
    .returning();
  return fila!;
}

/**
 * Deja a la empresa con una sucursal principal «PRI»: si no tiene ninguna sucursal la crea; idempotente.
 * Si ya tiene alguna (aunque no sea principal) no toca nada.
 */
export async function asegurarSucursalPrincipal(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<void> {
  const [alguna] = await tx.select({ id: sucursales.id }).from(sucursales).where(deEmpresa(ctx)).limit(1);
  if (alguna) return;
  await crearSucursal(tx, ctx, { codigo: CODIGO_SUCURSAL_PRINCIPAL, nombre: NOMBRE_SUCURSAL_PRINCIPAL, direccion: null, telefono: null }, { esPrincipal: true });
}
