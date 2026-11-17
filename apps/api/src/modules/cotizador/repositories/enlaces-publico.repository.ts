import { eq } from 'drizzle-orm';
import { empresaConfig } from '../../../db/esquema/core.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { EntradaDeDetalle } from '../domain/enlaces.js';

/** Los datos de la empresa para el encabezado de la página pública (los mismos del documento impreso). */
export async function datosDeEmpresaParaCliente(tx: Transaccion, ctx: ContextoDeEmpresa): Promise<EntradaDeDetalle['empresa']> {
  const [f] = await tx.select().from(empresaConfig).where(eq(empresaConfig.tenantId, ctx.empresaId));
  return f ?? null;
}
