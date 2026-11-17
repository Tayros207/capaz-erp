import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { revocarEnlacesVivos } from '../repositories/enlaces.repository.js';
import { registrarEvento } from '../repositories/versiones.repository.js';

/** Revoca los enlaces vivos de una cotización (al anularla) y deja un `enlace_revocado` por cada uno. Devuelve cuántos. */
export async function revocarEnlacesDeCotizacion(tx: Transaccion, ctx: ContextoDeEmpresa, cotizacionId: string, versionDelEvento: number): Promise<number> {
  const revocados = await revocarEnlacesVivos(tx, ctx, cotizacionId);
  for (const e of revocados) await registrarEvento(tx, ctx, cotizacionId, versionDelEvento, { tipo: 'enlace_revocado', datos: { enlaceId: e.id, enlaceVersion: e.version, motivo: 'cotizacion_anulada' } });
  return revocados.length;
}
