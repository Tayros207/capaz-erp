import { calcularLineasDeMovimiento, formatearSoles, rechazo, type ErrorDeRespuesta, type LineaCalculada, type LineaDeMovimientoDto, type LineaDeMovimientoEntrada, type MovimientoDto } from '@capaz/shared';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { lineasDeMovimientos, productosVivos, type LineaDeMovimiento } from '../repositories/movimiento-lineas.repository.js';

// Productos de un movimiento: validar lo que llega, calcular subtotales y devolverlos en la salida.

type Rechazo = { ok: false; error: ErrorDeRespuesta };

/** Lo que tienen en común las líneas guardadas de un movimiento y las de una deuda. */
type FilaDeLinea = Pick<LineaDeMovimiento, 'id' | 'orden' | 'productoId' | 'descripcion' | 'unidad' | 'cantidadMilesimas' | 'precioUnitarioMilesimas' | 'subtotalCentimos'>;

export const aLineaDto = (l: FilaDeLinea): LineaDeMovimientoDto => ({
  id: l.id,
  orden: l.orden,
  productoId: l.productoId,
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
  precioUnitarioMilesimas: l.precioUnitarioMilesimas,
  subtotalCentimos: l.subtotalCentimos,
});

export const aLineaCalculada = (l: FilaDeLinea): LineaCalculada => ({
  productoId: l.productoId,
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
  precioUnitarioMilesimas: l.precioUnitarioMilesimas,
  subtotalCentimos: l.subtotalCentimos,
});

/** Las líneas guardadas de un movimiento, ya como se calculan. */
export async function lineasGuardadas(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<LineaCalculada[]> {
  return ((await lineasDeMovimientos(tx, ctx, [id])).get(id) ?? []).map(aLineaCalculada);
}

/** A cada DTO le pone sus productos (una sola consulta para todos). */
export async function conLineas(tx: Transaccion, ctx: ContextoDeEmpresa, dtos: readonly MovimientoDto[]): Promise<MovimientoDto[]> {
  const porId = await lineasDeMovimientos(tx, ctx, dtos.map((d) => d.id));
  return dtos.map((d) => ({ ...d, lineas: (porId.get(d.id) ?? []).map(aLineaDto) }));
}

/**
 * Calcula los subtotales y la suma. Los productos del catálogo deben existir y estar vivos, salvo los que la línea
 * original ya traía (`previas`): corregir otra cosa no falla porque el producto se archivó después.
 */
export async function prepararLineas(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  entradas: readonly LineaDeMovimientoEntrada[],
  previas: readonly LineaCalculada[] = [],
): Promise<Rechazo | { ok: true; lineas: LineaCalculada[]; totalCentimos: number }> {
  const conocidos = new Set(previas.flatMap((p) => (p.productoId ? [p.productoId] : [])));
  const pedidos = [...new Set(entradas.flatMap((l) => (l.productoId && !conocidos.has(l.productoId) ? [l.productoId] : [])))];
  const vivos = await productosVivos(tx, ctx, pedidos);
  const falta = entradas.findIndex((l) => l.productoId && !conocidos.has(l.productoId) && !vivos.has(l.productoId));
  if (falta >= 0) return rechazo('no_encontrado', `No existe el producto de la línea ${falta + 1}.`);
  const calculo = calcularLineasDeMovimiento(entradas);
  if (calculo.lineas.length > 0 && calculo.totalCentimos <= 0) return rechazo('argumentos_invalidos', 'La suma de los productos debe ser mayor que cero.');
  return { ok: true, ...calculo };
}

/** Con productos, el monto es la suma de sus subtotales: si llega otro, se rechaza con la diferencia a la vista. */
export function montoDeLasLineas(montoCentimos: number | undefined, totalCentimos: number): Rechazo | { ok: true } {
  if (montoCentimos === undefined || montoCentimos === totalCentimos) return { ok: true };
  return rechazo('argumentos_invalidos', `El monto (${formatearSoles(montoCentimos)}) no coincide con la suma de los productos (${formatearSoles(totalCentimos)}).`);
}
