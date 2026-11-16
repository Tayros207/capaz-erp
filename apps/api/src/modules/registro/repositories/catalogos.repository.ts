import { eq, sql } from 'drizzle-orm';
import { registroCategorias, registroCuentas } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { CATEGORIAS_POR_DEFECTO, CUENTA_POR_DEFECTO, normalizarNombre } from '../domain/catalogos.js';

// Catálogos por defecto (regla R10). Idempotente y segura ante dos primeras escrituras a la vez: los
// `insert … on conflict do nothing` se apoyan en los índices únicos de nombre y de cuenta principal.

export type CatalogosCreados = { cuentasCreadas: number; categoriasCreadas: number };

async function hayFilas(tx: Transaccion, tabla: typeof registroCuentas | typeof registroCategorias, empresaId: string): Promise<boolean> {
  const [fila] = await tx.select({ uno: sql<number>`1` }).from(tabla).where(eq(tabla.tenantId, empresaId)).limit(1);
  return fila !== undefined;
}

/**
 * Deja a la empresa con una cuenta «Caja» principal si no tiene ninguna cuenta, y con las ocho categorías
 * iniciales si no tiene ninguna categoría. Solo siembra sobre vacío: lo que la empresa archivó o renombró
 * después no reaparece. La llaman `registro_iniciar` y las escrituras que necesitan un valor por defecto;
 * las lecturas nunca (con el módulo en baja la base rechazaría la escritura).
 */
export async function asegurarCatalogos(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<CatalogosCreados> {
  const creados: CatalogosCreados = { cuentasCreadas: 0, categoriasCreadas: 0 };
  if (!(await hayFilas(tx, registroCuentas, ctx.empresaId))) {
    const filas = await tx
      .insert(registroCuentas)
      .values({
        tenantId: ctx.empresaId,
        nombre: CUENTA_POR_DEFECTO.nombre,
        nombreNormalizado: normalizarNombre(CUENTA_POR_DEFECTO.nombre),
        tipo: CUENTA_POR_DEFECTO.tipo,
        esPrincipal: true,
        creadoPor: ctx.usuarioId,
      })
      .onConflictDoNothing()
      .returning({ id: registroCuentas.id });
    creados.cuentasCreadas = filas.length;
  }
  if (!(await hayFilas(tx, registroCategorias, ctx.empresaId))) {
    const filas = await tx
      .insert(registroCategorias)
      .values(
        CATEGORIAS_POR_DEFECTO.map((c) => ({
          tenantId: ctx.empresaId,
          nombre: c.nombre,
          nombreNormalizado: normalizarNombre(c.nombre),
          tipo: c.tipo,
          creadoPor: ctx.usuarioId,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: registroCategorias.id });
    creados.categoriasCreadas = filas.length;
  }
  return creados;
}
