import { exito, rechazo, type OrdenDeProduccionCompletaDto, type Respuesta } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { eventosDeOrden, itemsDeOrdenes, verOrden } from '../repositories/ordenes.repository.js';
import { aOrdenCompleta } from './mapeo.js';

export const MODULO = 'produccion';
export const NO_EXISTE = 'No existe esa orden de producción.';
export const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000080';
export const ID = { nombre: 'id', queSeAnota: 'Identificador de la orden de producción.', ejemplo: ID_DE_EJEMPLO };

/** Auditoría (R13): identificador, código, estado y cifras. Nunca nombres ni notas. */
export const auditarOrden = (_a: unknown, d: OrdenDeProduccionCompletaDto | null): DatosDeAuditoria => ({
  entidadTipo: 'orden_de_produccion',
  entidadId: d?.id,
  ...(d && { resumen: { codigo: d.codigo, estado: d.estado, totalCentimos: d.totalCentimos, adelantoCentimos: d.adelantoCentimos } }),
});

/** La orden con su historial, tal como la devuelve toda herramienta de escritura. */
export async function responderOrden(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<OrdenDeProduccionCompletaDto>> {
  const o = await verOrden(tx, ctx, id);
  if (!o) return rechazo('no_encontrado', NO_EXISTE);
  const hoy = await hoyDeLaEmpresa(tx);
  const items = (await itemsDeOrdenes(tx, ctx, [id])).get(id) ?? [];
  return exito(aOrdenCompleta(o, items, await eventosDeOrden(tx, ctx, id), hoy.dia));
}
