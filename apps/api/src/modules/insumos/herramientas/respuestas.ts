import { exito, rechazo, type Respuesta, type ResultadoDeMovimientoDeInsumo } from '@capaz/shared';
import type { DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { verExistencia } from '../repositories/existencias.repository.js';
import { verMovimientos } from '../repositories/movimientos.repository.js';
import type { Rechazo } from './comunes.js';
import { aExistenciaDto, aMovimientoDto } from './mapeo.js';
import type { MovimientoRechazado } from './registrar-movimiento.js';

// Respuestas comunes de las herramientas que mueven existencias.

/** El movimiento recién registrado y cómo quedó la existencia de ese artículo en esa sucursal. */
export async function responderMovimiento(tx: Transaccion, ctx: ContextoDeEmpresa, movimientoId: string): Promise<Respuesta<ResultadoDeMovimientoDeInsumo>> {
  const [m] = await verMovimientos(tx, ctx, [movimientoId]);
  if (!m) throw new Error('No se encontró el movimiento recién registrado.');
  const e = await verExistencia(tx, ctx, m.articuloId, m.sucursalId);
  if (!e) throw new Error('No se encontró la existencia recién movida.');
  return exito({ movimiento: aMovimientoDto(m), existencia: aExistenciaDto(e) });
}

export const SIN_CAMBIO = 'La existencia ya es esa cantidad: no hay nada que ajustar.';

/** El rechazo de un movimiento que la regla del dominio o la base no admitieron. Nada se guarda: el ejecutor revierte. */
export function rechazoDeMovimiento(r: MovimientoRechazado): Rechazo {
  if (r.motivo === 'faltante') return rechazo('conflicto', r.mensaje);
  if (r.motivo === 'sin_cambio') return rechazo('conflicto', SIN_CAMBIO);
  return rechazo('conflicto', 'Ese origen ya trajo ese artículo: una recepción no suma dos veces.');
}

/** Auditoría (R13): ids, tipo y cifras; nunca el motivo tecleado ni el nombre del producto. */
export const auditarMovimiento = (d: ResultadoDeMovimientoDeInsumo | null): DatosDeAuditoria => ({
  entidadTipo: 'movimiento_de_inventario',
  entidadId: d?.movimiento.id,
  ...(d && {
    resumen: {
      articuloId: d.movimiento.articuloId,
      sucursalId: d.movimiento.sucursalId,
      tipo: d.movimiento.tipo,
      cantidadMilesimas: d.movimiento.cantidadMilesimas,
      existenciaResultanteMilesimas: d.movimiento.existenciaResultanteMilesimas,
      bajoMinimo: d.existencia.bajoMinimo,
    },
  }),
});
