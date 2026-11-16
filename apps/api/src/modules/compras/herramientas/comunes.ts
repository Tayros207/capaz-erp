import { exito, rechazo, type CompraCompletaDto, type EstadoDeCompra, type LineaDeCompraEntrada, type Respuesta } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import { alcanceDe } from '../../../core/modulos/alcance.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { prepararLineas, type LineasPreparadas } from '../domain/orden.js';
import { lineasDe, verCompra, type Alcance, type Compra } from '../repositories/compras.repository.js';
import { productosPorId, proveedorVigente, sucursalVigente } from '../repositories/nucleo.repository.js';
import { recepcionesDe } from '../repositories/recepciones.repository.js';
import { aCompraCompleta } from './compra-mapeo.js';

// Lo que comparten las herramientas de compras.

export const MODULO = 'compras';
export const NO_EXISTE = 'No existe esa orden de compra.';
export const ID = { nombre: 'id', queSeAnota: 'Identificador de la orden de compra.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' };

export const alcanceDeCompras = (ctx: ContextoDeHerramienta): Alcance => alcanceDe(ctx, MODULO);
export const estadoDe = (c: Compra): EstadoDeCompra => c.estado as EstadoDeCompra;

/** Auditoría (R13): solo identificador, código, estado y cifras. Nunca nombres ni notas. */
export const auditarCompra = (_args: unknown, d: CompraCompletaDto | null): DatosDeAuditoria => ({
  entidadTipo: 'compra',
  entidadId: d?.id,
  ...(d && { resumen: { codigo: d.codigo, estado: d.estado, lineas: d.lineas, totalCentimos: d.totalCentimos } }),
});

/** La orden con sus líneas y recepciones, tal como la devuelve toda herramienta de compras. */
export async function responderCompra(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<CompraCompletaDto>> {
  const compra = await verCompra(tx, ctx, id, { alcance: alcanceDeCompras(ctx) });
  if (!compra) return rechazo('no_encontrado', NO_EXISTE);
  const [lineas, recepciones, hoy] = [await lineasDe(tx, ctx, id), await recepcionesDe(tx, ctx, id), await hoyDeLaEmpresa(tx)];
  return exito(aCompraCompleta(compra, lineas, recepciones, hoy.dia));
}

/** Comprueba lo que la orden cita del núcleo (solo lo que llega). Devuelve el motivo del rechazo o `null`. */
export async function comprobarReferencias(tx: Transaccion, ctx: ContextoDeHerramienta, r: { proveedorId?: string; sucursalId?: string | null }): Promise<string | null> {
  if (r.proveedorId && !(await proveedorVigente(tx, ctx, r.proveedorId))) return 'El proveedor no existe o está archivado.';
  if (r.sucursalId && !(await sucursalVigente(tx, ctx, r.sucursalId))) return 'La sucursal no existe o está archivada.';
  return null;
}

/** Líneas completas (con lo que falte tomado del producto) y totales de la orden. */
export async function prepararLineasDe(tx: Transaccion, ctx: ContextoDeHerramienta, entradas: readonly LineaDeCompraEntrada[], igvPorcentaje: number): Promise<LineasPreparadas> {
  const ids = entradas.flatMap((l) => (l.productoId ? [l.productoId] : []));
  return prepararLineas(entradas, await productosPorId(tx, ctx, ids), igvPorcentaje);
}
