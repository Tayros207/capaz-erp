import { and, asc, desc, eq, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import { sucursales } from '../../../db/esquema/core-maestros.js';
import { registroCuentas, registroMovimientos } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Repositorio de cuentas (caja, banco, billetera). Recibe la transacción de `conEmpresa`: la RLS aísla y el
// `where` por empresa es defensa en profundidad. Un choque de nombre se devuelve, no se lanza.

export type Cuenta = typeof registroCuentas.$inferSelect;
export type DatosDeCuenta = { nombre: string; nombreNormalizado: string; tipo: string; sucursalId: string | null; saldoInicialCentimos: number };
export type CambiosDeCuenta = Partial<Pick<DatosDeCuenta, 'nombre' | 'nombreNormalizado' | 'tipo' | 'sucursalId'>>;
/** Lo que entró y lo que salió de una cuenta, en céntimos y en positivo. */
export type Flujo = { ingresos: number; egresos: number; movimientos: number };

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(registroCuentas.tenantId, ctx.empresaId);

export async function listarCuentas(tx: Transaccion, ctx: ContextoDeEmpresa, opciones: { incluirArchivadas: boolean }): Promise<Cuenta[]> {
  const filtros: SQL[] = [deEmpresa(ctx)];
  if (!opciones.incluirArchivadas) filtros.push(isNull(registroCuentas.archivadoEn));
  return tx
    .select()
    .from(registroCuentas)
    .where(and(...filtros))
    .orderBy(desc(registroCuentas.esPrincipal), asc(registroCuentas.nombreNormalizado), asc(registroCuentas.id));
}

export async function verCuenta(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Cuenta | null> {
  const [fila] = await tx.select().from(registroCuentas).where(and(deEmpresa(ctx), eq(registroCuentas.id, id)));
  return fila ?? null;
}

export async function cuentaPrincipal(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<Cuenta | null> {
  const [fila] = await tx.select().from(registroCuentas).where(and(deEmpresa(ctx), eq(registroCuentas.esPrincipal, true)));
  return fila ?? null;
}

async function cuentaConNombre(tx: Transaccion, ctx: ContextoDeEmpresa, nombreNormalizado: string, salvo?: string): Promise<Cuenta | null> {
  const filtros: SQL[] = [deEmpresa(ctx), eq(registroCuentas.nombreNormalizado, nombreNormalizado), isNull(registroCuentas.archivadoEn)];
  if (salvo) filtros.push(ne(registroCuentas.id, salvo));
  const [fila] = await tx.select().from(registroCuentas).where(and(...filtros));
  return fila ?? null;
}

export async function crearCuenta(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  datos: DatosDeCuenta,
): Promise<{ creada: true; cuenta: Cuenta } | { creada: false; existente: Cuenta }> {
  const [fila] = await tx
    .insert(registroCuentas)
    .values({ ...datos, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning();
  if (fila) return { creada: true, cuenta: fila };
  const existente = await cuentaConNombre(tx, ctx, datos.nombreNormalizado);
  if (!existente) throw new Error('Conflicto de unicidad de cuentas sin fila que lo explique.');
  return { creada: false, existente };
}

/** `null` si no existe. Un nombre que ya usa otra cuenta viva se devuelve como conflicto. */
export async function editarCuenta(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  id: string,
  cambios: CambiosDeCuenta,
): Promise<{ cuenta: Cuenta } | { existente: Cuenta } | null> {
  if (cambios.nombreNormalizado !== undefined) {
    const existente = await cuentaConNombre(tx, ctx, cambios.nombreNormalizado, id);
    if (existente) return { existente };
  }
  const [fila] = await tx
    .update(registroCuentas)
    .set(cambios)
    .where(and(deEmpresa(ctx), eq(registroCuentas.id, id)))
    .returning();
  return fila ? { cuenta: fila } : null;
}

/** Archiva (idempotente). La principal no se archiva. */
export async function archivarCuenta(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Cuenta | 'es_principal' | null> {
  const actual = await verCuenta(tx, ctx, id);
  if (!actual) return null;
  if (actual.esPrincipal) return 'es_principal';
  const [fila] = await tx
    .update(registroCuentas)
    .set({ archivadoEn: sql`coalesce(${registroCuentas.archivadoEn}, now())` })
    .where(and(deEmpresa(ctx), eq(registroCuentas.id, id), eq(registroCuentas.esPrincipal, false)))
    .returning();
  return fila ?? 'es_principal';
}

/** Cambia la cuenta principal: primero se quita la marca a la actual (el índice único solo admite una). */
export async function marcarCuentaPrincipal(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Cuenta | 'archivada' | null> {
  const [destino] = await tx.select().from(registroCuentas).where(and(deEmpresa(ctx), eq(registroCuentas.id, id))).for('update');
  if (!destino) return null;
  if (destino.archivadoEn) return 'archivada';
  if (destino.esPrincipal) return destino;
  await tx.update(registroCuentas).set({ esPrincipal: false }).where(and(deEmpresa(ctx), eq(registroCuentas.esPrincipal, true)));
  const [fila] = await tx
    .update(registroCuentas)
    .set({ esPrincipal: true })
    .where(and(deEmpresa(ctx), eq(registroCuentas.id, id), isNull(registroCuentas.archivadoEn)))
    .returning();
  return fila ?? 'archivada';
}

const aEntero = (valor: string | number | null): number => {
  const n = Number(valor ?? 0);
  if (!Number.isSafeInteger(n)) throw new RangeError('Una suma de céntimos salió del rango seguro.');
  return n;
};

/**
 * Ingresos y egresos ACTIVOS por cuenta. `antesDe`: solo con fecha anterior (saldo inicial de un día);
 * `enElDia`: solo los de ese día. Las sumas salen de la base como enteros (`bigint`), nunca como decimales.
 */
export async function flujosPorCuenta(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  opciones: { antesDe?: string; enElDia?: string; cuentaId?: string } = {},
): Promise<Map<string, Flujo>> {
  const m = registroMovimientos;
  const filtros: SQL[] = [eq(m.tenantId, ctx.empresaId), eq(m.estado, 'activo')];
  if (opciones.antesDe) filtros.push(lt(m.fecha, opciones.antesDe));
  if (opciones.enElDia) filtros.push(eq(m.fecha, opciones.enElDia));
  if (opciones.cuentaId) filtros.push(eq(m.cuentaId, opciones.cuentaId));
  const filas = await tx
    .select({
      cuentaId: m.cuentaId,
      ingresos: sql<string>`coalesce(sum(${m.montoCentimos}) filter (where ${m.tipo} = 'ingreso'), 0)::bigint`,
      egresos: sql<string>`coalesce(sum(${m.montoCentimos}) filter (where ${m.tipo} = 'egreso'), 0)::bigint`,
      movimientos: sql<string>`count(*)`,
    })
    .from(m)
    .where(and(...filtros))
    .groupBy(m.cuentaId);
  return new Map(filas.map((f) => [f.cuentaId, { ingresos: aEntero(f.ingresos), egresos: aEntero(f.egresos), movimientos: aEntero(f.movimientos) }]));
}

export const SIN_FLUJO: Flujo = { ingresos: 0, egresos: 0, movimientos: 0 };

/** La sucursal existe en esta empresa y no está archivada. */
export async function existeSucursal(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<boolean> {
  const [fila] = await tx
    .select({ id: sucursales.id })
    .from(sucursales)
    .where(and(eq(sucursales.tenantId, ctx.empresaId), eq(sucursales.id, id), isNull(sucursales.archivadoEn)));
  return fila !== undefined;
}
