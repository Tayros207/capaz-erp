import type { EnlaceDeCotizacionDto } from '@capaz/shared';
import { estadoDeEnlace } from '../domain/enlaces.js';
import type { Enlace } from '../repositories/enlaces.repository.js';

/** El enlace tal como lo ve quien administra: sin el hash del token. */
export const aEnlaceDto = (e: Enlace, ahora: Date = new Date()): EnlaceDeCotizacionDto => ({
  id: e.id,
  cotizacionId: e.cotizacionId,
  version: e.version,
  estado: estadoDeEnlace(e, ahora),
  venceEn: e.venceEn.toISOString(),
  revocadoEn: e.revocadoEn?.toISOString() ?? null,
  vistas: e.vistas,
  ultimaVistaEn: e.ultimaVistaEn?.toISOString() ?? null,
  creadoEn: e.creadoEn.toISOString(),
});
