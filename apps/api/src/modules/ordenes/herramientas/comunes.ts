import { exito, rechazo, type EstadoDePedido, type LineaDeEntrada, type PedidoCompletoDto, type Respuesta } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import { alcanceDe } from '../../../core/modulos/alcance.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { prepararLineas, type LineasPreparadas } from '../domain/pedido.js';
import {
  clienteVigente,
  esMiembro,
  historialDe,
  lineasDe,
  productosPorId,
  sucursalVigente,
  verPedido,
  type Alcance,
  type Pedido,
} from '../repositories/pedidos.repository.js';
import { aPedidoCompleto } from './pedido-mapeo.js';

// Lo que comparten las herramientas de pedidos.

export const MODULO = 'ordenes';
export const NO_EXISTE = 'No existe ese pedido.';
export const ID = { nombre: 'id', queSeAnota: 'Identificador del pedido.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000010' };

export const alcanceDePedidos = (ctx: ContextoDeHerramienta): Alcance => alcanceDe(ctx, MODULO);
export const estadoDe = (p: Pedido): EstadoDePedido => p.estado as EstadoDePedido;

/** Auditoría (R13): solo identificador, código, estado y cifras. Nunca nombres ni notas. */
export const auditarPedido = (_args: unknown, d: PedidoCompletoDto | null): DatosDeAuditoria => ({
  entidadTipo: 'pedido',
  entidadId: d?.id,
  ...(d && { resumen: { codigo: d.codigo, estado: d.estado, lineas: d.lineas, totalCentimos: d.totalCentimos } }),
});

/** El pedido con sus líneas e historial, tal como lo devuelve toda herramienta de pedidos. */
export async function responderPedido(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<PedidoCompletoDto>> {
  const pedido = await verPedido(tx, ctx, id, { alcance: alcanceDePedidos(ctx) });
  if (!pedido) return rechazo('no_encontrado', NO_EXISTE);
  const [lineas, historial, hoy] = [await lineasDe(tx, ctx, id), await historialDe(tx, ctx, id), await hoyDeLaEmpresa(tx)];
  return exito(aPedidoCompleto(pedido, lineas, historial, hoy.dia));
}

/** Comprueba lo que el pedido cita del núcleo (solo lo que llega). Devuelve el motivo del rechazo o `null`. */
export async function comprobarReferencias(
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  r: { clienteId?: string; sucursalId?: string | null; responsableId?: string | null },
): Promise<string | null> {
  if (r.clienteId && !(await clienteVigente(tx, ctx, r.clienteId))) return 'El cliente no existe o está archivado.';
  if (r.sucursalId && !(await sucursalVigente(tx, ctx, r.sucursalId))) return 'La sucursal no existe o está archivada.';
  if (r.responsableId && !(await esMiembro(tx, r.responsableId))) return 'El responsable no es miembro de la empresa.';
  return null;
}

/** Líneas completas (con lo que falte tomado del producto) y totales del pedido. */
export async function prepararLineasDe(tx: Transaccion, ctx: ContextoDeHerramienta, entradas: readonly LineaDeEntrada[], igvPorcentaje: number): Promise<LineasPreparadas> {
  const ids = entradas.flatMap((l) => (l.productoId ? [l.productoId] : []));
  return prepararLineas(entradas, await productosPorId(tx, ctx, ids), igvPorcentaje);
}
