import { eq } from 'drizzle-orm';
import { cotizadorConfiguracion } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Repositorio de la configuración (una fila por empresa). Recibe la transacción de `conEmpresa`.

export type Configuracion = typeof cotizadorConfiguracion.$inferSelect;
export type CambiosDeConfiguracion = Partial<
  Pick<Configuracion, 'utilidadPct' | 'utilidadBase' | 'umbralVerdePct' | 'umbralMinimoPct' | 'redondeoComercial' | 'igvPorcentaje' | 'condiciones' | 'mensajeWhatsapp' | 'unidades'>
>;

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(cotizadorConfiguracion.tenantId, ctx.empresaId);

export async function leerConfiguracion(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<Configuracion | null> {
  const [fila] = await tx.select().from(cotizadorConfiguracion).where(deEmpresa(ctx));
  return fila ?? null;
}

/** R10: crea la fila con los valores por defecto si no existe. `true` si la creó. */
export async function asegurarConfiguracion(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<boolean> {
  const filas = await tx
    .insert(cotizadorConfiguracion)
    .values({ tenantId: ctx.empresaId, actualizadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning({ tenantId: cotizadorConfiguracion.tenantId });
  return filas.length > 0;
}

export async function guardarConfiguracion(tx: Transaccion, ctx: ContextoDeEmpresa, cambios: CambiosDeConfiguracion): Promise<Configuracion> {
  const [fila] = await tx
    .update(cotizadorConfiguracion)
    .set({ ...cambios, actualizadoPor: ctx.usuarioId, actualizadoEn: new Date() })
    .where(deEmpresa(ctx))
    .returning();
  if (!fila) throw new Error('La configuración no existe: falta asegurarla antes de guardar.');
  return fila;
}
